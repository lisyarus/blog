---
layout: post
title:  "Compute shaders in graphics: Gaussian blur"
date:   2022-04-21 20:02:06 +0300
categories: graphics
---

### Why am I doing this? 

I started learning real-time 3D graphics as soon as I started programming -- that is, about 12 years ago. At the time, OpenGL 3 was still new, and most online tutorials covered the (now ancient)
immediate mode commands (`glBegin`/`glEnd` and friends). Over the years, I've learned a lot: VBOs & VAOs, shaders, deferred shading, various optimization techniques. Here's a shameless plug of what I got for one of those scope-is-too-large-for-me-to-ever-finish-it projects with my own pure C++ & OpenGL engine:

<center><iframe width="560" height="315" src="https://www.youtube.com/embed/lopVLHXKWXA" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></center>

OpenGL 4.3 which appeared in 2012 introduced a new shiny thing: compute shaders. Despite this having happened 10 years ago, I've still never actually done anything with them. However, they've become an essential part of modern rendering: all modern solutions for overdraw (visibility buffer, software rasterization), order-independent transparency (per-pixel linked lists), fast convolutions, etc. use compute shaders, while I'm still stuck to OpenGL 3.3!

In my recent [twitter post](https://twitter.com/lisyarus/status/1515213774743126017?s=20&t=ZFkgjesn6hAp2w2n2qW2Zg) I asked for some beginner-friendly graphics-oriented resources for learning compute shaders, and unfortunately there aren't many. Most resources are either too advanced, or are dedicated to general computing (GPGPU), which isn't a problem by itself, but is less favourable when one's main interest is graphics.

So, I dediced I'll document my own attempts at learning this stuff in the form of a blog post series, in the hope that it helps someone like me. In this post, I'll try to implement Gaussian blur using compute shaders and compare the performance to classic fragment shader-based implementation (_spoiler: the results aren't great at all_). All the code for this post is available at [this repository](https://github.com/lisyarus/compute/tree/master/blur). I'm using [my pet C++ engine](https://bitbucket.org/lisyarus/psemek/src/master), but the OpenGL-related stuff should be clear for the most part. I'm using CMake as a build system, so you should be able to easily clone the repo and run the examples.

I'm testing everything on my GeForce GTX 1060, with a screen resolution of 1920x1080, without any downsampling.

_**Disclaimer:** as I've said, I'm only learning all this stuff, and this is literally the first time I'm writing compute serious shaders and analyzing their performance. Beware of dramatic ignorance ahead :)_

### Preparing the scene

First, let's render something cheap & animated that we will blur later. It doesn't matter much what to blur, since the algorithm is exactly the same whatever pixel values we have. I think a bunch of shiny rotating icosahedra would do:

<center><video width="600" autoplay muted loop><source src="{{site.url}}/blog/media/blur/raw.mp4" type="video/mp4"></video></center>

### Naive implementation

The first (and the simplest) way to implement blur is a full-screen post-process single-pass effect:

1. Render the scene into a framebuffer (with color & depth attachments)
2. Render a fullscreen quad on the screen with a fragment shader that reads color from that framebuffer and averages pixels

I'll take a 33×33 Gaussian kernel with σ=10. The kernel size is chosen to be nice for future compute implementations (33 = one pixel + 16 on the left + 16 on the right).

The shader looks relatively simple: we loop over all pixels in a 33×33 square centered at the current pixel and average them with appropriate weights:

```glsl
uniform sampler2D u_input_texture;
uniform vec2 u_texture_size_inv;

layout (location = 0) out vec4 out_color;

in vec2 texcoord;

const int M = 16;
const int N = 2 * M + 1;

const float coeffs[N] = float[N](...); // generated kernel coefficients

void main()
{
  vec4 sum = vec4(0.0);

  for (int i = 0; i < N; ++i)
  {
    for (int j = 0; j < N; ++j)
    {
      vec2 tc = texcoord + u_texture_size_inv * vec2(float(i - M), float(j - M));
      sum += coeffs[i] * coeffs[j] * texture(u_input_texture, tc);
    }
  }

  out_color = sum;
}
```

and this is what the result looks like:

<center><video width="600" autoplay muted loop><source src="{{site.url}}/blog/media/blur/blurred.mp4" type="video/mp4"></video></center>

(the full code is available [here](https://github.com/lisyarus/compute/tree/master/blur/source/naive.cpp)).

Doesn't look that impressive, but it doesn't need to -- making the original image less interesting is exactly what blur does :)

_Note that we don't do anything special about transparency here. For transparency-aware blur, you might want to additionally weight the colors by their alpha channel and normalize (divide by total accumulated alpha)._

Let's measure how well it performs. The cheap and dirty way to measure your rendering performance is just to disable vsync and look at the time you spend from frame to frame.
A better way is to use OpenGL timer queries, which are a little tricky due to asynchronous nature of the GPU -- you don't know when a particular query result will be ready.
Thankfully, this can be easily dealt with by using a [pool of queries](https://bitbucket.org/lisyarus/psemek/src/master/libs/gfx/source/query.cpp) that creates a new query object if all others are still busy.
I'll use both methods: timer queries for measurement, and frame durations for sanity checks (e.g. to make sure that I'm measuring the right thing and there's nothing else occupying half the frame time).

The performance turns out to be pretty sad: **15ms** for the whole blur. This is clearly unsatisfactory (we typically have just 16ms for the whole frame!), so let's move on to a better approach.

### Separable kernel

If you've ever read any resources on Gaussian blur, you know that this single-pass implementation is the **wrong** way of doing it. It so happens that Gaussian filters are separable, meaning that the corresponding weight matrix has rank one and can be expressed as an outer product of two vectors:

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B150%7D%20C_%7Bij%7D%3Dx_i%20%5Ccdot%20y_j" alt="C[i,j] = x[i] * y[j]"></center>

In the case of a Gaussian filter, the corresponding decomposition is

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B150%7D%20%5Cexp%5Cleft%28-%5Cfrac%7Bi%5E2&plus;j%5E2%7D%7B%5Csigma%5E2%7D%5Cright%29%20%3D%20%5Cexp%5Cleft%28-%5Cfrac%7Bi%5E2%7D%7B%5Csigma%5E2%7D%5Cright%29%5Ccdot%20%5Cexp%5Cleft%28-%5Cfrac%7Bj%5E2%7D%7B%5Csigma%5E2%7D%5Cright%29" alt="exp(-(i^2+j^2)/sigma^2) = exp(-i^2/sigma^2) * exp(-j^2/sigma^2)"></center>

(I'm ignoring normalization here).

In fact, this is exactly how the weights were defined in the naive implementation: a single array of N coefficients is enough to reconstruct the full N×N coefficient matrix.

What it means is that we can replace out single-pass algorithm with a two-pass algorithm: instead of replacing every pixel with a weighted average of all N×N neigbouring pixels, we do
1. Horizontal blur: replace every pixel with the average of neigbouring N×1 pixels
2. Vertical blur: replace every pixel with the average of neighbouring 1×N pixels.

This way, vertical averaging deals with pixels that have already been averaged horizontally, thus producing a full blur. Specifically, say `W[i]` is the one-dimensional weight vector, meaning that
`W[i]*W[j]` is the coefficient of some pixel's `P[x,y]` contribution to its neighbour `P[x+i,y+j]` when performing full blur. Then, the horizontal pass will add `W[i]*P[x,y]` to the value of `P[x+i,y]`, then the vertical blur will add `W[j]*P[x+i,y]` to `P[x+i,y+j]`, so the value of `P[x,y]` will get multiplied by `W[i]*W[j]` upon reaching `P[x+i,y+j]`, which is exactly what we want. _Not sure who needs another explanation of separable filters, but, hey, it never hurts._

The point of this separation is that, compared to the naive version, which uses N² texture accesses (per fragment), this version only uses 2N texture accessed (2 passes, each having N accesses per pixel). This sounds like a drastic increase in performance: assuming everything else is negligible compared to texture access, for N=33 we'll get about N²/2N = 33/2 = 16.5 times better performance! Of course, things aren't that simple, but we still can hope for a huge improvement.

On the OpenGL side, we'll have to use two framebuffers this time. The algorithm is as follows:
1. Render the scene to framebuffer 1
2. Use framebuffer 1 color texture as input to horizontal blur that outputs to framebuffer 2
3. Use framebuffer 2 color texture as input to vertical blur that outputs to target framebuffer (e.g. the screen)
Note that we don't need a depth attachment for the second framebuffer.

Implementing a separable kernel is even easier than the full blur: we only need a single loop over neighbouring pixels, and the direction of blur can be constrolled by a uniform variable:

```glsl
uniform sampler2D u_input_texture;
uniform vec2 u_direction;

layout (location = 0) out vec4 out_color;

in vec2 texcoord;

const int M = 16;
const int N = 2 * M + 1;

// sigma = 10
const float coeffs[N] = float[N](...); // generated kernel coefficients

void main()
{
  vec4 sum = vec4(0.0);

  for (int i = 0; i < N; ++i)
  {
    vec2 tc = texcoord + u_direction * float(i - M);
    sum += coeffs[i] * texture(u_input_texture, tc);
  }

  out_color = sum;
}
```

(the full code is [here](https://github.com/lisyarus/compute/tree/master/blur/source/separable.cpp)).

The result is significally better: **1ms** for the whole blur. A 15x improvement, meaning our 16.5x estimate wasn't that bad after all :)

### Separable kernel with hardware filtering

There's this neat trick that I've [learnt long ago](https://www.rastergrid.com/blog/2010/09/efficient-gaussian-blur-with-linear-sampling) but didn't have the opportunity to try. See, we're still bound by memory accesses: all the shader does is fetch texture data and do a pitiful amount of arithmetics. Modern GPUs are famously superior in terms of computing performance while not so in terms of memory speeds, so anything that decreases our texture access counts is a win.

What we've been ignoring up to now is that GPUs have a whole zoo of special hardware dedicated to various graphics needs. In particular, it can do linear filtering on textures almost for free! Linear filtering is just averaging neighbouring pixels, -- sounds a lot like what we're trying to do!

So, the idea goes like this: when doing a weighted average of neighbouring pixels, instead of computing `W[i]*P[i] + W[i+1]*P[i+1]`, let's ask the GPU to mix `P[i]` and `P[i+1]` with appropriate weights and return the result to us via a single texture fetch. What happens when we read a texture with linear filtering at coordinate `i+t` (where `t` is in the range `[0..1)`) is it returns `lerp(P[i], P[i+1], t) = P[i] * (1-t) + P[i+1] * t`, which we'll have to scale by some weight `W`. This gives us a system of equations:

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B150%7D%20%5Cbegin%7Bmatrix%7D%20W%20%5Ccdot%20%281-t%29%20%3D%20W_i%20%5C%5C%20W%20%5Ccdot%20t%20%3D%20W_%7Bi&plus;1%7D%20%5Cend%7Bmatrix%7D"></center>

which leads to

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B150%7D%20%5Cbegin%7Bmatrix%7D%20W%20%3D%20W_i%20&plus;%20W_%7Bi&plus;i%7D%20%5C%5C%20t%20%3D%20W_%7Bi&plus;1%7D/W%20%5Cend%7Bmatrix%7D"></center>

Given this values of `W` and `t`, we can compute the full contribution of **two** neighbouring pixels with a **single** texture fetch! The only change happens in the shader. Since the kernel size is odd (N=33), I chose to always fetch the pixel with offset `0` independently, and group other pixels in pairs to apply the aforementioned trick:

```glsl
uniform sampler2D u_input_texture;
uniform vec2 u_direction;

layout (location = 0) out vec4 out_color;

in vec2 texcoord;

const int M = 16;

// sigma = 10
const float coeffs[M + 1] = float[M + 1](...); // generated kernel coefficients

void main()
{
  vec4 sum = coeffs[0] * texture(u_input_texture, texcoord);

  for (int i = 1; i < M; i += 2)
  {
    float w0 = coeffs[i];
    float w1 = coeffs[i + 1];

    float w = w0 + w1;
    float t = w1 / w;

    sum += w * texture(u_input_texture, texcoord + u_direction * (float(i) + t));
    sum += w * texture(u_input_texture, texcoord - u_direction * (float(i) + t));
  }

  out_color = sum;
}
```

So, instead of N=33 texture fetches we now have 1+(N-1)/2=17 of them, leading to a theoretical 1.95x performance increase. Indeed, what I got was **0.54ms** for the whole blur, about 1.85x increase! It always facinates me when theoretical performance predictions match reality. I wish this happened more often :)

### Compute naive

Now that we've settled on our baseline OpenGL 3.3 implementation, let's start doing compute shaders! For these, you need either OpenGL 4.3 or the `ARB_compute_shader` extension (I'm using the latter since I want the engine to work on older devices that only support OpenGL 3.3).

I won't dive deep into explaining how compute shaders work, but the TL;DR is:
1. They are a completely separate shader stage, like vertex or fragment shader
2. They don't have any special inputs (like vertex attributes) or outputs (like output color for fragment shaders)
3. All data read & write happens using special GLSL functions
4. Compute shaders operate in so-called workgroups; a single compute dispatch (compute analogue of drawing commands, i.e. the command that issues shader invocations) is composed of a set of workgroups of equal size (predetermined by the shader itself)
5. Workgroups are useful due to having *shared memory* (LDS, Local Data Store, something around 16K..64K per workgroup) -- fast-access data that can be shared between shader invocations *in the same workgroup* (but **not** between different workgroups!)

At first, let's write a naive implementation: a full N×N loop that does averaging with Gaussian weights. Instead of reading a texture via the `texture` GLSL function, we'll use the `imageLoad` function. Instead of writing pixels to the framebuffer as part of the usual rendering pipeline, we'll manually write pixels to the output texture with the `imageStore` function.

Note that this functions have `image` in their name, not `texture`. OpenGL makes a difference between images and textures: an image is just that, an array of pixels, while a texture is a *set* of images (mipmap levels) together with a whole bunch of sampling options (linear/nearest/trilinear filtering, swizzling, clamping/repeating, anisotropy, etc). One can use textures in compute shaders, but we simply don't need that now since we're foing to read & write single pixels without any filtering or other special effects. Binding images to shaders is done using `glBindImageTexture`.

So, we're going to select some workgroup size (say, 16×16), and have each shader invocation write exactly one pixel. For a screen resolution `W×H` We'll dispatch a grid of `ceil(W/16) × ceil(H/16)` workgroups to make sure that these workgrous cover the whole screen. Additionally, if, say, the screen height is not a multiple of 16, we'll insert some checks in the shader so that the shader invocations corresponding to off-screen pixels won't do anything (most importantly, they won't try to write to the output image).

So, here's the full compute shader:

```glsl
layout(local_size_x = 16, local_size_y = 16) in;
layout(rgba8, binding = 0) uniform restrict readonly image2D u_input_image;
layout(rgba8, binding = 1) uniform restrict writeonly image2D u_output_image;

const int M = 16;
const int N = 2 * M + 1;

// sigma = 10
const float coeffs[N] = float[N](...); // generated kernel coefficients

void main()
{
  ivec2 size = imageSize(u_input_image);
  ivec2 pixel_coord = ivec2(gl_GlobalInvocationID.xy);

  if (pixel_coord.x < size.x && pixel_coord.y < size.y)
  {
    vec4 sum = vec4(0.0);

    for (int i = 0; i < N; ++i)
    {
      for (int j = 0; j < N; ++j)
      {
        ivec2 pc = pixel_coord + ivec2(i - M, j - M);
        if (pc.x < 0) pc.x = 0;
        if (pc.y < 0) pc.y = 0;
        if (pc.x >= size.x) pc.x = size.x - 1;
        if (pc.y >= size.y) pc.y = size.y - 1;

        sum += coeffs[i] * coeffs[j] * imageLoad(u_input_image, pc);
      }
    }

    imageStore(u_output_image, pixel_coord, sum);
  }
}
```

(the full code is [here](https://github.com/lisyarus/compute/tree/master/blur/source/compute.cpp)).

On the CPU side, we'll do the following:

1. Render the scene to a framebuffer 1
2. Insert a memory barrier
3. Dispatch the compute shader that reads from framebuffer 1 color texture and writes to framebuffer 2 color texture
4. Insert a memory barrier
5. Blit from framebuffer 2 to the screen

As far as I know, we can't use the compute shader to write directly onto the screen, so we write to a framebuffer-attached texture, and then use `glBlitFramebuffer` to copy the result onto the screen.

Let's talk about memory barriers. Normally, OpenGL is designed in such a way that it's pretty obvious to the driver what commands read/write what data (e.g. a draw command reads vertex buffers & bound textures and writes to currently bound framebuffer, etc). Even if the GPU decides to shuffle around user's commands (and it certainly will), it can use that knowledge about data dependence to prevent erroneous ordering of commands. It basically means that OpenGL guarantees that all data written by a command will be seen by any following command that tries to read that data, and it happens magically, and you don't even need to think about that.

Unfortunatelly, compute shaders are a bit trickier: they can read and write arbitrary portions of arbitrary bound objects, so the GPU has a hard time trying to guess the exact data dependencies. That's what memory barriers are for: they tell the GPU what data depends on what. For example, we want all the data renderered at step 1 to be visible to the image load-store operations perfomed at step 3. This is what `GL_SHADER_IMAGE_ACCESS_BARRIER_BIT` is for. Next, we want the pixels written by step 3 to be visible for the framebuffer blit operation at step 5, this is what `GL_FRAMEBUFFER_BARRIER_BIT`. I hope I didn't mess that up :)

Combining all this, I got the following performance for various workgroup sizes:

|:----------------:|:----------------:|:----------------:|:----------------:|:----------------:|
|4x4: **40ms**     |4x8: **25.3ms**   |4x16: **25.7ms**  |4x32: **26ms**    |4x64: **26.5ms**  |
|                  |8x8: **24.2ms**   |8x16: **24.7ms**  |8x32: **25.2ms**  |8x64: **25.4ms**  |
|                  |                  |16x16: **25ms**   |16x32: **25.5ms** |16x64: **26ms**   |
|                  |                  |                  |32x32: **30.7ms** |                  |

(there's no 32x64 or 64x64 workgroup size since this exceeds the maximum workgroup size for my GPU).

Performance is bad for 4x4, but it stays pretty much the same for all other workgroup sizes, although there are some trends. This correlates nicely with my understanding that Nvidia GPUs typically execute shaders in groups of 32 (so-called warps): any workgroup size with at least 32 threads is fine, while 4x4 occupies only half of the warp and thus a lot of computational power is wasted (*serious handwaving here!*).

Anyways, that's still about 1.6 times worse than the non-compute naive implementation. Let's get deeper.

### Compute naive + LDS

My first instinct for improving the naive compute implementation was to use workgroup shared memory. After all, that's one of the unique features of compute shaders!

The general idea of using LDS is to exploit data locality, i.e. that many threads in the same workgroup require the same data. Instead of each thread reading the memory it needs, we'd make the threads read all the data they all need into shared memory, then proceed the computations as usual using this shared memory instead (which is supposedly very fast!).

Specifically for a convolution filter with size `N = 2*M+1` (like Gaussian blur), a single thread accesses `NxN` pixels, while a whole workgroup of size `GxG` accesses `(G+2*M)x(G+2*M)` pixels:

<center><img src="{{site.url}}/blog/media/blur/shared.png"></center>

(here, `M = 2`, `N = 5` and `G = 4`; red is a single pixel or a 4x4 workgroup, blue are accessed pixels).

So, the new algorithm is:
1. Create a shared array in the compute shader with an appropriate size
2. Compute shader first loads all the pixels accessed by the workgroup into the shared memory
3. A memory barrier (in the shader, not on the CPU side!) makes sure shared memory writes are synchronized between threads within workgroup
4. Compute shader does the usual Gaussian blur, reading the input from shared memory

There are a lot of details here, including
* Properly computing the shared array size
* Balancing work - we want all the threads to fetch about the same number of pixels into shared memory (this can be done by dividing the total number of fetched pixels by the workgroup size)
* Making sure nothing reads or writes out of bounds (shared array bounds or input image bounds)
* Properly indexing into shared array

I won't go into much detail, the full code is [here](https://github.com/lisyarus/compute/tree/master/blur/source/compute_lds.cpp). Sad news -- this variant has incredibly poor performance:

|:----------------:|:----------------:|:----------------:|
|4x4: **175ms**    |8x8: **134ms**    |16x16: **117ms**  |

It didn't let me create a 32x32 workgroup since the shared array size would exceed available shared workgroup memory size.

### Compute + separable kernel

Fine, probably compute shaders aren't as miraculously fast as I thought! Let's try the first optimization we did -- doing two-pass blur -- with compute shaders. Nothing essentially new here, except that this time we need three framebuffers:

1. Render the scene into framebuffer 1
2. Apply horizontal blur to framebuffer 1 color buffer and write to framebuffer 2 color buffer
3. Apply vertical blur to framebuffer 2 color buffer and write to framebuffer 3 color buffer
4. Blit from framebuffer 3 to the screen

In fact, framebuffer 2 is optional, since we don't use it as a framebuffer -- only write to and read from its color texture.

The shader is relatively simple:

```glsl
layout(local_size_x = 16, local_size_y = 16) in;
layout(rgba8, binding = 0) uniform restrict readonly image2D u_input_image;
layout(rgba8, binding = 1) uniform restrict writeonly image2D u_output_image;

uniform ivec2 u_direction;

const int M = 16;
const int N = 2 * M + 1;

// sigma = 10
const float coeffs[N] = float[N](...); // generated kernel coefficients

void main()
{
  ivec2 size = imageSize(u_input_image);
  ivec2 pixel_coord = ivec2(gl_GlobalInvocationID.xy);

  if (pixel_coord.x < size.x && pixel_coord.y < size.y)
  {
    vec4 sum = vec4(0.0);

    for (int i = 0; i < N; ++i)
    {
      ivec2 pc = pixel_coord + u_direction * (i - M);
      if (pc.x < 0) pc.x = 0;
      if (pc.y < 0) pc.y = 0;
      if (pc.x >= size.x) pc.x = size.x - 1;
      if (pc.y >= size.y) pc.y = size.y - 1;

      sum += coeffs[i] * imageLoad(u_input_image, pc);
    }

    imageStore(u_output_image, pixel_coord, sum);
  }
}
```

(the full code is [here](https://github.com/lisyarus/compute/tree/master/blur/source/compute_separable.cpp)).

And here are the timings for different workgroup sizes:

|:----------------:|:----------------:|:----------------:|:----------------:|
|4x4: **2.79ms**   |8x8: **1.59ms**   |16x16: **1.66ms** |32x32: **2.3ms**  |

We're finally close to the performance we had with the non-compute implementation, although still about 3x slower.

### Compute + separable kernel + LDS

Let's combine both optimizations! A two-pass blur, with each pass using a shared array to prefetch all the accessed input pixels. This time, I'm using Gx1 workgroups for horizontal blur, and 1xG for the vertical pass, since e.g. during a horizontal pass a pixel shares a lot of accessed input pixels with its horizontal heighbours, but none with its vertical neighbours.

The code is [here](https://github.com/lisyarus/compute/tree/master/blur/source/compute_separable_lds.cpp) and the results are reasonably satisfying:

|:----------------:|:----------------:|:----------------:|:----------------:|:----------------:|:----------------:|:----------------:|
|4x1: **10.8ms**   |8x1: **4.5ms**    |16x1: **2.15ms**  |32x1: **1.08ms**  |64x1: **1.07ms**  |128x1: **1.06ms** |256x1: **1.06ms** |

This is still slower than our non-compute implementation, though :)

### Compute + separable kernel + single-pass + LDS

The final idea I wanted to give a try is to get rid of the intermediary buffer used to store the result of horizontal blur. We have workgroup shared memory, why not use it? The algorithm is:
1. Fetch all input pixels accessed by workgroup threads into shared array
2. Issue a barrier to make sure all data is in shared memory
3. Perform a horizontal blur
4. Issue a barrier to make sure all threads finished the horizontal pass
5. Write the result into shared array
6. Issue a barrier to make sure all threads have written their results
7. Perform a vertical blur, this time outputing directly to the output texture

The code is [here](https://github.com/lisyarus/compute/tree/master/blur/source/compute_separable_single_lds.cpp) and here are the numbers:

|:----------------:|:----------------:|:----------------:|
|4x4: **75ms**     |8x8: **29ms**     |16x16: **16ms**   |

Well, either I did something really wrong, or it was a bad idea.

### Conclusion?

So, what's happening here? The problem is I genuinely have no idea. Maybe I'm doing something really wrong in my compute shaders. Maybe the texture cache is actully so good that it outperforms clever manual optimizations. Maybe the rasterizer orders it's own fragment shader workgroups in some clever way (e.g. using [Hilbert](https://en.wikipedia.org/wiki/Hilbert_curve) or [Morton](https://en.wikipedia.org/wiki/Z-order_curve) curves) to improve data locality (there are ways to do this with compute shaders as well, see [this paper](https://developer.nvidia.com/blog/optimizing-compute-shaders-for-l2-locality-using-thread-group-id-swizzling)). Anyways, what this definitely does prove is that GPU optimization is a hard topic! Who would have thought.

If you have any corrections, suggestions, or explanations, feel free to reach me in any convenient way (though email or twitter would probably be the easiest). And, well, thanks for reading :)
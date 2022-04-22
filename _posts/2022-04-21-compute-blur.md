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

The performance on my GeForce GTX 1060 turns out to be pretty sad: **15ms** for the whole blur. This is clearly unsatisfactory (we typically have just 16ms for the whole frame!), so let's move on to a better approach.

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

So, instead of N=33 texture fetches we now have 1+(N-1)/2=17 of them, leading to a theoretical ~1.95x performance increase. Indeed, what I got was **0.54ms** for the whole blur, about 1.85x increase! It always facinates me when theoretical performance predictions match reality. I wish this happened more often :)
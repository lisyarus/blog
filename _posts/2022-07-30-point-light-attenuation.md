---
layout: post
title:  "A better point light attenuation function"
date:   2022-07-30 11:00:00 +0300
categories: graphics
---

### The problem

So, recently I was adding lights support to the martian-droid-colony-building project I've been working on for a while. I used CPU-based [clustered shading](https://www.aortiz.me/2018/12/21/CG.html), storing the lights & clusters data in [buffer textures](https://www.khronos.org/opengl/wiki/Buffer_Texture), and managed to support about 4K lights at 60 FPS on my machine. [Here's](https://twitter.com/lisyarus/status/1552566798649802753?s=20&t=yo_3FRluSchtarf5SwKc5g) a twitter thread with some intermediate results, and here are some final screenshots:

<center><img src="{{site.url}}/blog/media/light/many.png"></center><br/>
<center><img src="{{site.url}}/blog/media/light/spot.png"></center><br/>
<center><img src="{{site.url}}/blog/media/light/iron.png"></center><br/>
<center><img src="{{site.url}}/blog/media/light/copper.png"></center><br/>
<br/>

For light clustering to work, I need to clip the light's area of influence by a certain distance. The physically correct point light attenuation function (how much light some point in scene receives) is

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20%5Cfrac%7BA%7D%7Bd%5E2%7D"></center><br/>

where A is the light's amplitude (intensity) and d is the distance from the light to an illuminated point. However, this function introduces a singularity at d = 0, meaning that points too close to the light will receive unbounded amounts of lighting. This is an artefact of the point light abstraction: real lights are not points, they are physical objects of nonzero size. We don't want to throw away this nice abstraction, though, so we add a fake term that removes this singularity:

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20%5Cfrac%7BA%7D%7B1&plus;d%5E2%7D"></center><br/>

This has the added benefit that A is now the maximal light intensity (achieved at d = 0). This function (red) isn't physically correct at small values of d, but is close to the correct one (blue) for large distances:

<center><img src="{{site.url}}/blog/media/light/plot1.png"></center><br/>

However, this attenuation formula doesn't let us control the fallof, i.e. how fast does the intensity decrease with distance. This won't be physically correct either, but it allows for a greater artistic flexibility. So, introduce another parameter R:

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20%5Cfrac%7BA%7D%7B1&plus;%28%5Cfrac%7Bd%7D%7BR%7D%29%5E2%7D"></center><br/>

R is precisely the distance where the light intensity is half the maximal intensity. Larger values of R make the light attenuate (decrease in intensity) slower, increasing the effective light's area of influence. Here, the green function has R = 1 and the purple one has R = 3:

<center><img src="{{site.url}}/blog/media/light/plot2.png"></center><br/>

Finally, we can add another parameter Q, for which I don't have an intuitive explanation, but it allows us to control the shape of attenuation more precisely:

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20%5Cfrac%7BA%7D%7B1&plus;%5Cfrac%7Bd%7D%7BQ%7D&plus;%28%5Cfrac%7Bd%7D%7BR%7D%29%5E2%7D"></center><br/>

Small values of Q introduce a cusp at d = 0, producing a faster fallof and a slightly different shape for the attenuation function (the blue one has Q = 1):

<center><img src="{{site.url}}/blog/media/light/plot3.png"></center><br/>

Use can play with all this functions [here](https://www.desmos.com/calculator/3si5gqopde).

This type of function is usually presented in APIs/engines in a slightly different, arguably cleaner form (but with less intuitive parameters):

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20%5Cfrac%7B1%7D%7BC_0%20&plus;%20C_1%20d%20&plus;%20C_2%20d%5E2%7D"></center><br/>

I.e. light attenuation is the inverse of a quadratic function of distance. See e.g. [here](http://learnwebgl.brown37.net/09_lights/lights_attenuation.html) or the docs for [OpenGL 1.0 lighting model](https://registry.khronos.org/OpenGL-Refpages/es1.1/xhtml/glLight.xml).

There are other popular attenuation functions: some [introduce a sharp cutoff](https://geom.io/bakery/wiki/index.php?title=Point_Light_Attenuation) near d = 0, some [replace the point light with a spherical area light](http://www.cemyuksel.com/research/pointlightattenuation), etc. What I don't like about all these options is that no formula gives a good way of constraining the light's influence to a certain radius: all these formulas are non-zero for arbirtarily large distances!

### The solution

So, I set off to find a different formula that

* Looks a bit like the physically correct <img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20%5Cfrac%7B1%7D%7Bd%5E2%7D">
* Is exactly zero at a certain distance R, so that I can use that distance for light-cluster intersections
* Has zero derivative at distance R (otherwise the lightness will have a C^1 discontinuity, leading to a noticeable gradient edge)

What I came up with looks incredibly simple:

<center><img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20A%5Cfrac%7B%281-s%5E2%29%5E2%7D%7B1&plus;s%5E2%7D"></center><br/>

where <img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20s%3D%5Cfrac%7Bd%7D%7BR%7D"> is the normalized distance. It allows to separately control the maximum intensity A and the maximum radius R. You can play with this formula [here](https://www.desmos.com/calculator/zemezoyn1c). It is also fast to compute, since it doesn't use square roots, exponents, and other stuff, just a bit of arithmetic. Here's how it looks like for A = 2 and R = 5:

<center><img src="{{site.url}}/blog/media/light/plot4.png"></center><br/>

For distances less than R/2 this function looks about the same as <img src="https://latex.codecogs.com/png.latex?%5Cdpi%7B120%7D%20%5Clarge%20%5Cfrac%7BA%7D%7B1&plus;4%28%5Cfrac%7Bd%7D%7BR%7D%29%5E2%7D">, while for larger values it gradually goes to zero and is exactly zero at distance R. Note that it doesn't have a sharp cusp at d = 0, for artistic reasons: I want the attenuation to behave roughly like a spherical area light source near the light.

For the sake of completeness, here's a GLSL implementation. Note that we need to check for d < R, otherwise we'd get wrong lightness values at larger distances.

```
float sqr(float x)
{
	return x * x;
}

float attenuate(float distance, float radius, float max_intensity)
{
	float s = distance / radius;
	
	if (s >= 1.0)
		return 0.0;

	float s2 = sqr(s);

	return max_intensity * sqr(1 - s2) / (1 + s2);
}
```

That's it! Hope you'll find it usefull and thanks for reading.
---
layout: page
title: Projects
permalink: /projects
steamwidgets: yes
---

<style>

table, tr, td {
	border: none!important;
	table-layout: fixed;
	border-spacing: 20px!important;
	text-align: justify;
	vertical-align: top;
}

</style>

---
<center><a href="https://lisyarus.itch.io/particle-simulator"><h2>Costa Verde Transport Department</h2></a></center>

<table><tr>
<td>
A road building & traffic simulation game I'm working on. It's my first commercial game project, and I'm determined to release it in October, 2023. Most probably it won't be a great game, but I'll be happy with an OK game for a start :)
<br><br>
You can watch devlogs about it on my <a href="https://youtube.com/@lisyarus">YouTube channel</a>. It also has a dedicated <a href="https://discord.gg/Ab58J2rE2">Discord server</a>.
<br><br>
By the way, I'm quite struggling with marketing stuff (logos, Steam capsules, advertising, etc), so if you can offer me some help, be sure to write to <a href="mailto:lisyarus@gmail.com">lisyarus@gmail.com</a>.
</td>
<td>
<steam-app appid="2403100"></steam-app>
</td>
</tr></table>

---
<center><a href="https://lisyarus.itch.io/particle-simulator"><h2>Particle simulator</h2></a></center>

<table><tr>
<td>
A particle simulator supporting charges, gravity, springs, and external force fields. It's quite simple but powerful and fun to play with.
<br><br>
It uses a simple JSON format to serialize the simulation state, so you can generate your own simulations to feed into it, or save the simulation results and load them in your own tool.
<br><br>
The simulator's code is <a href="https://bitbucket.org/lisyarus/particle-simulator/src/master/">open-sourced here</a>.
</td>
<td>
<img src="{{site.url}}/blog/media/projects/particle-simulator.png">
</td>
</tr></table>

---
<center><a href="https://github.com/lisyarus/chembook"><h2>Quantum Chemistry Done Wrong</h2></a></center>

<table><tr>
<td>
An extremely introductory book on quantum chemistry, with a fairly low amount of prerequisite knowledge required (mostly linear algebra & Python).
<br><br>
It gradually builds up a simple framework for solving quantum mechanical problems, explaining what's going on along the way. All the resulting code is available <a href="https://github.com/lisyarus/chembook/tree/master/code">in the same repository</a>, and all the nasty integral computations are <a href="https://github.com/lisyarus/chembook/blob/master/code/hgto.py">already done for you</a>.
</td>
<td>
<img src="{{site.url}}/blog/media/projects/chembook.png">
</td>
</tr></table>

---
<center><a href="https://github.com/lisyarus/opengl-loader-generator"><h2>OpenGL Loader Generator</h2></a></center>

<table><tr>
<td>
Heavily influenced by (now obsolete) glLoadGen, a python script that takes a simple configuration file and produces an <a href="https://www.khronos.org/opengl/wiki/OpenGL_Loading_Library">OpenGL loader</a>, i.e. a pair of C++ header &amp; source files that contain all OpenGL constants & function definitions for the specified OpenGL version, and the routines for loading them.
<br><br>
It is highly configurable, and supports different OpenGL-based APIs, versions, extensions, and even code styles :)
</td>
<td>
<img src="https://www.khronos.org/assets/images/api_logos/opengl.svg">
</td>
</tr></table>

---
<center><a href="https://github.com/lisyarus/voxelizer"><h2>OBJ Voxelizer</h2></a></center>

<table><tr>
<td>
A tool that converts 3D models in Wavefront OBJ format to a 3D RGBA texture, with the alpha channel containing the volume of intersection of the object with this voxel. Useful for e.g. <a href="https://en.wikipedia.org/wiki/Volume_rendering">volume rendering</a>.
</td>
<td>
<img src="{{site.url}}/blog/media/projects/voxelizer.png">
</td>
</tr></table>
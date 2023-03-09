---
layout: page
title: Projects
permalink: /projects
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
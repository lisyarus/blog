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
	vertical-align: top!important;
	background-color: #ffffff00!important;
}

</style>

---
<center><a href="https://store.steampowered.com/app/2403100/Costa_Verde_Transport_Department"><h2>Costa Verde Transport Department</h2></a></center>

<table class="project_table"><tr>
<td>
A road building & traffic simulation game I've released in 2023. It's my first commercial game project, and the first big enough released game. A lot of things went wrong during development, and I'm not happy with the final result, but at least I've learned a lot. The game still managed to find a thankful audience, though :)
<br><br>
You can watch devlogs about it on my <a href="https://youtube.com/@lisyarus">YouTube channel</a>.
</td>
<td>
<center><steam-app appid="2403100"></steam-app></center>
</td>
</tr></table>

---
<center><a href="https://lisyarus.itch.io/particle-simulator"><h2>Particle simulator</h2></a></center>

<table class="project_table"><tr>
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

<table class="project_table"><tr>
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

<table class="project_table"><tr>
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

<table class="project_table"><tr>
<td>
A tool that converts 3D models in Wavefront OBJ format to a 3D RGBA texture, with the alpha channel containing the volume of intersection of the object with this voxel. Useful for e.g. <a href="https://en.wikipedia.org/wiki/Volume_rendering">volume rendering</a>.
</td>
<td>
<img src="{{site.url}}/blog/media/projects/voxelizer.png">
</td>
</tr></table>


<script type="text/javascript">

function isMobile() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
}

if (isMobile()) {
	for (var table of document.getElementsByClassName('project_table')) {
		let tbody = table.children[0];
		let image = tbody.rows[0].cells[1].children[0];

		tbody.rows[0].deleteCell(1);
		let cell = tbody.insertRow().insertCell();
		cell.style = "text-align: center";
		cell.appendChild(image);
	}
}

</script>
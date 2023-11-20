---
layout: post
title:  "Computing forces in a system of beams"
date:   2023-10-15 18:00:00 +0300
categories: physics
mathjax: yes
steamwidgets: yes
image:
  path: /media/beams/cover.png
  width: 520
  height: 240
---

<style>
p {
	text-align: justify;
}

table, tbody, tr, td {
    border: none!important;
    background: transparent!important;
}
</style>

<script async src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

<script>

function smoothstep(t)
{
    return t * t * (3 - 2 * t);
}

function isMobile()
{
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function prepareCanvas(canvas, width, height)
{
    const ctx = canvas.getContext('2d');

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const scale = window.devicePixelRatio;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    ctx.scale(scale, scale);

    return ctx;
}

function isVisible(element) {
    const rect = element.getBoundingClientRect();

    return (
        rect.bottom >= 0 &&
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.left >= 0 &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

function denseGauss(matrix, rhs) {
	// Forward pass

	for (let i = 0; i < matrix.length; ++i)
	{
		// Find pivot

		let maxRow = i;
		for (let j = i + 1; j < matrix.length; ++j)
		{
			if (Math.abs(matrix[j][i]) > Math.abs(matrix[maxRow][i]))
			{
				maxRow = j;
			}
		}

		// Check for singularity

		if (Math.abs(matrix[maxRow][i]) < 1e-6)
			return null;

		// Swap rows i and maxRow

		let temp = matrix[i];
		matrix[i] = matrix[maxRow];
		matrix[maxRow] = temp;

		temp = rhs[i];
		rhs[i] = rhs[maxRow];
		rhs[maxRow] = temp;

		// Perform elimination

		for (let j = i + 1; j < matrix.length; ++j)
		{
			let factor = matrix[j][i] / matrix[i][i];
			for (let k = i; k < matrix.length; ++k)
			{
				matrix[j][k] -= matrix[i][k] * factor;
			}

			rhs[j] -= rhs[i] * factor;
		}
	}

	// Backward pass

	for (let i = matrix.length; i --> 0;)
	{
		rhs[i] /= matrix[i][i];
		matrix[i][i] = 1;

		for (let j = 0; j < i; ++j)
		{
			rhs[j] -= matrix[j][i] * rhs[i];
			matrix[j][i] = 0;
		}
	}

	// Done

	return rhs;
}

function chooseColor(id)
{
	const colors = [
		'#ff7f7f',
		'#7fcf7f',
		'#7f7fff',
		'#7fdfef',
		'#df7fef',
		'#ffef7f',
	];

	return colors[id % colors.length];
}

function toRGB(color)
{
	let num = Number('0x' + color.substr(1));
	const r = Math.floor(num / 65536) % 256;
	const g = Math.floor(num / 256) % 256;
	const b = num % 256;
	return [r, g, b];
}

function fromRGB(triple)
{
	return '#' + triple[0].toString(16).padStart(2) + triple[1].toString(16).padStart(2) + triple[2].toString(16).padStart(2);
}

function lighten(color, amount)
{
	let rgb = toRGB(color);
	rgb[0] = Math.round(rgb[0] * (1 - amount) + 255 * amount);
	rgb[1] = Math.round(rgb[1] * (1 - amount) + 255 * amount);
	rgb[2] = Math.round(rgb[2] * (1 - amount) + 255 * amount);
	return fromRGB(rgb);
}

function makeWhiteboardState(cellsX, cellsY)
{
	const state = {
		'cellsX': cellsX,
		'cellsY': cellsY,
		'interactive': false,
		'damping': 1.0,
		'debug': false,
		'addingBeam': false,
		'mouse': null,
		'selectedBeam': null,
		'beams': [],
		'solver': 'gauss',
		'density': 1,
		'gravity': 0.25,
		'forceScale': 40.0,
		'leftWall': true,
		'rightWall': true,
		'topWall': true,
		'bottomWall': true,
		'display': 'forces',
		'extraForces': [],
		'wrongUnderdetermined': false,
	};

	state.addBeam = (x0, y0, x1, y1) => {
		state.beams.push({
			'start': [x0, y0],
			'end': [x1, y1],
			'color': chooseColor(state.beams.length),
			'startForce': [0, 0],
			'endForce': [0, 0],
		});
	};

	state.isWall = (x, y) => {
    	return (state.leftWall && x == 0)
    		|| (state.topWall && y == 0)
    		|| (state.rightWall && x == state.cellsX)
    		|| (state.bottomWall && y == state.cellsY);
    };

	return state;
}

function resetForces(id)
{
    const canvas = document.getElementById(id);
    const state = canvas.whiteBoardState;
    for (let beam of state.beams)
    {
    	beam.startForce = [0, 0];
    	beam.endForce = [0, 0];
    }
}

function makeWhiteboard(id, state)
{
	const cellSize = 20;

	const width = (state.cellsX + 2) * cellSize;
	const height = (state.cellsY + 2) * cellSize;

    const canvas = document.getElementById(id);
    const ctx = prepareCanvas(canvas, width, height);

    canvas.whiteBoardState = state;

    // canvas.style.cursor = 'none';

	const topHatchGradient = ctx.createLinearGradient(0, cellSize, 0, 0);
	topHatchGradient.addColorStop(0, 'rgba(127,127,127,255)');
	topHatchGradient.addColorStop(1, 'rgba(127,127,127,0)');

	const leftHatchGradient = ctx.createLinearGradient(cellSize, 0, 0, 0);
	leftHatchGradient.addColorStop(0, 'rgba(127,127,127,255)');
	leftHatchGradient.addColorStop(1, 'rgba(127,127,127,0)');

	const rightHatchGradient = ctx.createLinearGradient(width - cellSize, 0, width, 0);
	rightHatchGradient.addColorStop(0, 'rgba(127,127,127,255)');
	rightHatchGradient.addColorStop(1, 'rgba(127,127,127,0)');

	const bottomHatchGradient = ctx.createLinearGradient(0, height - cellSize, 0, height);
	bottomHatchGradient.addColorStop(0, 'rgba(127,127,127,255)');
	bottomHatchGradient.addColorStop(1, 'rgba(127,127,127,0)');

	const topWallGradient = ctx.createLinearGradient(0, cellSize, 0, 0);
	topWallGradient.addColorStop(0, 'rgba(63,63,63,255)');
	topWallGradient.addColorStop(1, 'rgba(63,63,63,0)');

	const leftWallGradient = ctx.createLinearGradient(cellSize, 0, 0, 0);
	leftWallGradient.addColorStop(0, 'rgba(63,63,63,255)');
	leftWallGradient.addColorStop(1, 'rgba(63,63,63,0)');

	const rightWallGradient = ctx.createLinearGradient(width - cellSize, 0, width, 0);
	rightWallGradient.addColorStop(0, 'rgba(63,63,63,255)');
	rightWallGradient.addColorStop(1, 'rgba(63,63,63,0)');

	const bottomWallGradient = ctx.createLinearGradient(0, height - cellSize, 0, height);
	bottomWallGradient.addColorStop(0, 'rgba(63,63,63,255)');
	bottomWallGradient.addColorStop(1, 'rgba(63,63,63,0)');

    const draw = () => {
        ctx.clearRect(0, 0, width, height);

        // Hatching

    	ctx.lineWidth = 1;

    	// Top hatch

    	ctx.strokeStyle = topHatchGradient;

    	ctx.beginPath();
    	ctx.moveTo(cellSize * 0.25, cellSize * 0.25);
    	ctx.lineTo(cellSize * 0.5, 0);
    	ctx.stroke();

    	ctx.beginPath();
    	ctx.moveTo(cellSize * 0.5, cellSize * 0.5);
    	ctx.lineTo(cellSize, 0);
    	ctx.stroke();

    	ctx.beginPath();
    	ctx.moveTo(cellSize * 0.75, cellSize * 0.75);
    	ctx.lineTo(cellSize * 1.5, 0);
    	ctx.stroke();

        for (let tx = 0; tx <= 2 * state.cellsX; ++tx)
        {
        	ctx.beginPath();
        	ctx.moveTo((tx * 0.5 + 1) * cellSize, cellSize);
        	ctx.lineTo((tx * 0.5 + 2) * cellSize, 0);
        	ctx.stroke();
        }

        // Left hatch

    	ctx.strokeStyle = leftHatchGradient;

    	ctx.beginPath();
    	ctx.moveTo(cellSize * 0.25 - 0.5, cellSize * 0.25 + 0.5);
    	ctx.lineTo(0, cellSize * 0.5);
    	ctx.stroke();

    	ctx.beginPath();
    	ctx.moveTo(cellSize * 0.5 - 0.5, cellSize * 0.5 + 0.5);
    	ctx.lineTo(0, cellSize);
    	ctx.stroke();

    	ctx.beginPath();
    	ctx.moveTo(cellSize * 0.75 - 0.5, cellSize * 0.75 + 0.5);
    	ctx.lineTo(0, cellSize * 1.5);
    	ctx.stroke();

        for (let ty = 0; ty < 2 * state.cellsY; ++ty)
        {
        	ctx.beginPath();
        	ctx.moveTo(cellSize, (ty * 0.5 + 1) * cellSize);
        	ctx.lineTo(0, (ty * 0.5 + 2) * cellSize);
        	ctx.stroke();
        }

        // Right hatch

    	ctx.strokeStyle = rightHatchGradient;

    	ctx.beginPath();
    	ctx.moveTo(width - cellSize * 0.75 + 0.5, height - cellSize * 0.75 - 0.5);
    	ctx.lineTo(width, height - cellSize * 1.5);
    	ctx.stroke();

    	ctx.beginPath();
    	ctx.moveTo(width - cellSize * 0.5 + 0.5, height - cellSize * 0.5 - 0.5);
    	ctx.lineTo(width, height - cellSize);
    	ctx.stroke();

    	ctx.beginPath();
    	ctx.moveTo(width - cellSize * 0.25 + 0.5, height - cellSize * 0.25 - 0.5);
    	ctx.lineTo(width, height - cellSize * 0.5);
    	ctx.stroke();

        for (let ty = 1; ty <= 2 * state.cellsY; ++ty)
        {
        	ctx.beginPath();
        	ctx.moveTo(width - cellSize, (ty * 0.5 + 1) * cellSize);
        	ctx.lineTo(width, (ty * 0.5) * cellSize);
        	ctx.stroke();
        }

        // Bottom hatch

    	ctx.strokeStyle = bottomHatchGradient;

    	ctx.beginPath();
    	ctx.moveTo(width - cellSize * 0.75, height - cellSize * 0.75);
    	ctx.lineTo(width - cellSize * 1.5, height);
    	ctx.stroke();

    	ctx.beginPath();
    	ctx.moveTo(width - cellSize * 0.5, height - cellSize * 0.5);
    	ctx.lineTo(width - cellSize, height);
    	ctx.stroke();

    	ctx.beginPath();
    	ctx.moveTo(width - cellSize * 0.25, height - cellSize * 0.25);
    	ctx.lineTo(width - cellSize * 0.5, height);
    	ctx.stroke();

        for (let tx = 0; tx <= 2 * state.cellsX; ++tx)
        {
        	ctx.beginPath();
        	ctx.moveTo((tx * 0.5 + 1) * cellSize, height - cellSize);
        	ctx.lineTo((tx * 0.5) * cellSize, height);
        	ctx.stroke();
        }

        // Hide hatching based on walls

        if (!state.topWall)
        {
        	ctx.clearRect(cellSize, 0, width - 2 * cellSize, cellSize + 1);
        }

        if (!state.leftWall)
        {
        	ctx.clearRect(0, cellSize, cellSize + 1, height - 2 * cellSize);
        }

        if (!state.rightWall)
        {
        	ctx.clearRect(width - cellSize - 1, cellSize, cellSize + 1, height - 2 * cellSize);
        }

        if (!state.bottomWall)
        {
        	ctx.clearRect(cellSize, height - cellSize - 1, width - 2 * cellSize, cellSize + 1);
        }

        if (!state.topWall && !state.leftWall)
        {
        	ctx.clearRect(0, 0, cellSize + 1, cellSize + 1);
        }

        if (!state.topWall && !state.rightWall)
        {
        	ctx.clearRect(width - cellSize - 1, 0, cellSize + 1, cellSize + 1);
        }

        if (!state.bottomWall && !state.leftWall)
        {
        	ctx.clearRect(0, height - cellSize - 1, cellSize + 1, cellSize + 1);
        }

        if (!state.bottomWall && !state.rightWall)
        {
        	ctx.clearRect(width - cellSize - 1, height - cellSize - 1, cellSize + 1, cellSize + 1);
        }

        // Grid

        ctx.fillStyle = '#cfcfcf';
        for (let x = 0; x <= state.cellsX; ++x)
        {
            for (let y = 0; y <= state.cellsY; ++y)
            {
            	ctx.beginPath();
        		ctx.arc((x + 1) * cellSize, (y + 1) * cellSize, 1, 2 * Math.PI, false);
        		ctx.fill();
            }
        }

        // Borders

        ctx.strokeStyle = '#3f3f3f';
        ctx.lineWidth = 2;

        if (state.topWall)
        {
	        ctx.beginPath();
	        ctx.moveTo(cellSize, cellSize);
	        ctx.lineTo(width - cellSize, cellSize);
	        ctx.stroke();
	    }

        if (state.bottomWall)
        {
	        ctx.beginPath();
	        ctx.moveTo(cellSize, height - cellSize);
	        ctx.lineTo(width - cellSize, height - cellSize);
	        ctx.stroke();
	    }

        if (state.leftWall)
        {
	        ctx.beginPath();
	        ctx.moveTo(cellSize, cellSize);
	        ctx.lineTo(cellSize, height - cellSize);
	        ctx.stroke();
	    }

        if (state.rightWall)
        {
	        ctx.beginPath();
	        ctx.moveTo(width - cellSize, cellSize);
	        ctx.lineTo(width - cellSize, height - cellSize);
	        ctx.stroke();
	    }

	    if (!state.topWall)
	    {
	    	ctx.strokeStyle = topWallGradient;

	    	if (state.leftWall)
	    	{
	    		ctx.beginPath();
	    		ctx.moveTo(cellSize, cellSize);
	    		ctx.lineTo(cellSize, 0);
	    		ctx.stroke();
	    	}

	    	if (state.rightWall)
	    	{
	    		ctx.beginPath();
	    		ctx.moveTo(width - cellSize, cellSize);
	    		ctx.lineTo(width - cellSize, 0);
	    		ctx.stroke();
	    	}
	    }

	    if (!state.leftWall)
	    {
	    	ctx.strokeStyle = leftWallGradient;

	    	if (state.topWall)
	    	{
	    		ctx.beginPath();
	    		ctx.moveTo(cellSize, cellSize);
	    		ctx.lineTo(0, cellSize);
	    		ctx.stroke();
	    	}

	    	if (state.bottomWall)
	    	{
	    		ctx.beginPath();
	    		ctx.moveTo(cellSize, height - cellSize);
	    		ctx.lineTo(0, height - cellSize);
	    		ctx.stroke();
	    	}
	    }

	    if (!state.rightWall)
	    {
	    	ctx.strokeStyle = rightWallGradient;

	    	if (state.topWall)
	    	{
	    		ctx.beginPath();
	    		ctx.moveTo(width - cellSize, cellSize);
	    		ctx.lineTo(width, cellSize);
	    		ctx.stroke();
	    	}

	    	if (state.bottomWall)
	    	{
	    		ctx.beginPath();
	    		ctx.moveTo(width - cellSize, height - cellSize);
	    		ctx.lineTo(width, height - cellSize);
	    		ctx.stroke();
	    	}
	    }

	    if (!state.bottomWall)
	    {
	    	ctx.strokeStyle = bottomWallGradient;

	    	if (state.leftWall)
	    	{
	    		ctx.beginPath();
	    		ctx.moveTo(cellSize, height - cellSize);
	    		ctx.lineTo(cellSize, height);
	    		ctx.stroke();
	    	}

	    	if (state.rightWall)
	    	{
	    		ctx.beginPath();
	    		ctx.moveTo(width - cellSize, height - cellSize);
	    		ctx.lineTo(width - cellSize, height);
	    		ctx.stroke();
	    	}
	    }

        // Mouse anchor

        if (!(state.mouse === null))
        {
        	const cx = (state.mouse[0] + 1) * cellSize;
        	const cy = (state.mouse[1] + 1) * cellSize;
        	const s = 5;

        	ctx.strokeStyle = '#000000';
        	ctx.lineWidth = 2;
        	ctx.beginPath();
        	ctx.moveTo(cx - s, cy);
        	ctx.lineTo(cx + s, cy);
        	ctx.moveTo(cx, cy - s);
        	ctx.lineTo(cx, cy + s);
        	ctx.stroke();
        }

        // Beams

    	const owidth = 8;
    	const iwidth = 6;

        for (let i in state.beams)
        {
        	const beam = state.beams[i];

        	const sx = (beam.start[0] + 1) * cellSize;
        	const sy = (beam.start[1] + 1) * cellSize;
        	const ex = (beam.end[0] + 1) * cellSize;
        	const ey = (beam.end[1] + 1) * cellSize;

        	let ow = owidth;
        	let iw = iwidth;

        	if (state.selectedBeam == i)
        	{
        		ow = ow + 4;
        		iw = iw + 2;
        	}

        	ctx.lineWidth = ow;
        	ctx.strokeStyle = '#000000';
        	ctx.fillStyle = '#000000';
        	ctx.beginPath();
        	ctx.moveTo(sx, sy);
        	ctx.lineTo(ex, ey);
        	ctx.stroke();
        	ctx.beginPath();
        	ctx.arc(sx, sy, ow / 2, 2 * Math.PI, false);
        	ctx.arc(ex, ey, ow / 2, 2 * Math.PI, false);
        	ctx.fill();

        	ctx.lineWidth = iw;
        	ctx.strokeStyle = beam.color;
        	ctx.fillStyle = beam.color;
        	ctx.beginPath();
        	ctx.moveTo(sx, sy);
        	ctx.lineTo(ex, ey);
        	ctx.stroke();
        	ctx.beginPath();
        	ctx.arc(sx, sy, iw / 2, 2 * Math.PI, false);
        	ctx.arc(ex, ey, iw / 2, 2 * Math.PI, false);
        	ctx.fill();
        }

        const drawHinge = (p) => {
        	const cx = (p[0] + 1) * cellSize;
        	const cy = (p[1] + 1) * cellSize;

        	ctx.fillStyle = '#000000';
        	ctx.beginPath();
        	ctx.arc(cx, cy, owidth / 2 + 1, 2 * Math.PI, false);
        	ctx.fill();

        	ctx.fillStyle = '#ffffff';
        	ctx.beginPath();
        	ctx.arc(cx, cy, iwidth / 2 + 1, 2 * Math.PI, false);
        	ctx.fill();
        };

        // Border hinges

        for (let beam of state.beams)
        {
        	for (let p of [beam.start, beam.end])
        	{
        		if (state.isWall(p[0], p[1]))
        		{
		        	drawHinge(p);
        		}
        	}
        }

        // Beam hinges

        for (let i in state.hingeMap)
        {
        	if (state.hingeMap[i].length >= 2)
        	{
        		drawHinge([i % (state.cellsX + 1), Math.floor(i / (state.cellsX + 1))]);
        	}
        }

        // Beam forces

    	const drawForce = (origin, force, color, offset) => {
    		const sx = (origin[0] + 1) * cellSize;
    		const sy = (origin[1] + 1) * cellSize;

    		const fl = Math.sqrt(force[0] * force[0] + force[1] * force[1]);

    		const tx = force[0] / fl;
    		const ty = force[1] / fl;

    		const nx = -ty;
    		const ny =  tx;

    		const arrow = 10;

    		// if (fl * state.forceScale < 10) return;

    		for (let i = 0; i < 2; ++i)
    		{
    			if (i == 0)
    			{
		    		ctx.strokeStyle = '#000000';
		    		ctx.fillStyle = '#000000';
		    		ctx.lineWidth = 4;
		    	}
		    	else
		    	{
		    		ctx.strokeStyle = color;
		    		ctx.fillStyle = color;
		    		ctx.lineWidth = 2;	
		    	}

		    	const ex = sx + tx * fl * state.forceScale;
		    	const ey = sy + ty * fl * state.forceScale;

		    	const n = 2 / 3;
		    
	    		ctx.beginPath();
	    		ctx.moveTo(sx + tx * (offset + i), sy + ty * (offset + i));
	    		ctx.lineTo(ex, ey);
	    		ctx.moveTo(ex, ey);
	    		ctx.lineTo(ex + nx * (arrow - i) * n - tx * (arrow - i), ey + ny * (arrow - i) * n - ty * (arrow - i));
	    		ctx.moveTo(ex, ey);
	    		ctx.lineTo(ex - nx * (arrow - i) * n - tx * (arrow - i), ey - ny * (arrow - i) * n - ty * (arrow - i));
	    		ctx.stroke();

	    		ctx.beginPath();
	    		ctx.arc(ex, ey, ctx.lineWidth / 2, 2 * Math.PI, false);
	    		ctx.fill();
	    	}
    	};

        for (let i in state.beams)
        {
        	const beam = state.beams[i];

        	if (state.display == 'forces')
        	{
	        	drawForce(beam.start, beam.startForce, beam.color, 10);
	        	drawForce(beam.end, beam.endForce, beam.color, 10);
	        }
	        else if (state.display == 'stress')
	        {
	        	let dx = beam.end[0] - beam.start[0];
	        	let dy = beam.end[1] - beam.start[1];
	        	let L = Math.sqrt(dx * dx + dy * dy);

	        	if (L > 0.5)
	        	{
	        		let tx = dx / L;
	        		let ty = dy / L;

	        		let sx = beam.endForce[0] - beam.startForce[0];
	        		let sy = beam.endForce[1] - beam.startForce[1];

	        		let s = sx * tx + sy * ty;

	        		if (s > 0)
	        		{
	        			let center = [beam.start[0] + dx / 2, beam.start[1] + dy / 2];
	        			drawForce(center, [tx * s, ty * s], '#ffffff', 5);
	        			drawForce(center, [-tx * s, -ty * s], '#ffffff', 5);
	        		}
	        		else
	        		{
	        			drawForce(beam.start, [-tx * s, -ty * s], '#ffffff', 10);
	        			drawForce(beam.end, [tx * s, ty * s], '#ffffff', 10);
	        		}
	        	}
	        }
        }

        // Info

        if (state.debug)
        {
        	let variables = 4 * state.beams.length;
        	let equations = 3 * state.beams.length + 2 * state.activeHinges;

        	let lines = [];
        	lines.push([(variables > equations ? "Underdetermined" : variables < equations ? "Overdetermined" : "Square") + ": " + variables + " unknowns, " + equations + " equations", '#000000']);
        	lines.push(["Error: " + state.error.toFixed(5), state.error > 0.01 ? '#ff0000' : '#000000']);
        	if (state.singular)
        		lines.push(["Singular system", '#ff0000']);

        	ctx.font = '12px monospace';
        	ctx.textAlign = 'start';
        	ctx.textBaseline = 'top';
        	for (let i in lines)
        	{
        		ctx.fillStyle = lines[i][1];
        		ctx.fillText(lines[i][0], cellSize * 1.5, cellSize * 1.5 + 12 * Number(i));
        	}
        }
    };

    if (state.interactive)
    {
	    canvas.onmousemove = (e) => {
	        let mx = Math.round(e.offsetX / cellSize) - 1;
	        let my = Math.round(e.offsetY / cellSize) - 1;

	        if (mx < 0) mx = 0;
	        if (my < 0) my = 0;
	        if (mx > state.cellsX) mx = state.cellsX;
	        if (my > state.cellsY) my = state.cellsY;

        	state.mouse = [mx, my];

	        if (state.addingBeam)
	        {
	        	state.beams[state.beams.length - 1].end = [state.mouse[0], state.mouse[1]];
	        }

	        state.selectedBeam = null;
	        if (!state.addingBeam)
	        {
		        const mx = (e.offsetX / cellSize) - 1;
		        const my = (e.offsetY / cellSize) - 1;

	        	let minDistance = 0.5;
	        	for (let i in state.beams)
	        	{
	        		const beam = state.beams[i];
	        		const sx = beam.start[0];
	        		const sy = beam.start[1];
	        		const ex = beam.end[0];
	        		const ey = beam.end[1];
	        		const dx = ex - sx;
	        		const dy = ey - sy;

	        		const rx = mx - sx;
	        		const ry = my - sy;
	        		const t = (rx * dx + ry * dy) / (dx * dx + dy * dy);

	        		var dist;

	        		if (t <= 0)
	        		{
	        			dist = Math.sqrt(rx * rx + ry * ry);
	        		}
	        		else if (t >= 1)
	        		{
	        			const qx = mx - ex;
	        			const qy = my - ey;
	        			dist = Math.sqrt(qx * qx + qy * qy);
	        		}
	        		else
	        		{
	        			const qx = rx - t * dx;
	        			const qy = ry - t * dy;
	        			dist = Math.sqrt(qx * qx + qy * qy);
	        		}

	        		if (dist < minDistance)
	        		{
	        			minDistance = dist;
	        			state.selectedBeam = i;
	        		}
	        	}
	        }
	    };

	    canvas.addEventListener('contextmenu', (e) => {
	    	e.preventDefault();
	    });

	    canvas.onmouseleave = () => {
        	state.mouse = null;
	    };

	    canvas.onmousedown = (e) => {
        	e.preventDefault();

	    	if (state.addingBeam) return;

	    	if (e.button == 0 && !(state.mouse === null))
	    	{
		    	state.addBeam(state.mouse[0], state.mouse[1], state.mouse[0], state.mouse[1]);
		    	state.addingBeam = true;
		    }

	    	if (e.button == 2 && !(state.selectedBeam === null))
	    	{
	    		state.beams.splice(state.selectedBeam, 1);
	    		state.selectedBeam = null;
	    	}
	    };

	    canvas.onmouseup = (e) => {
        	e.preventDefault();

	    	if (e.button == 0 && state.addingBeam)
	    	{
	    		state.addingBeam = false;

	    		const beam = state.beams[state.beams.length - 1];
	    		if (beam.start[0] == beam.end[0] && beam.start[1] == beam.end[1])
	    			state.beams.pop();
	    	}
	    };
    }

    const prepare = () => {
		state.hingeMap = Array((state.cellsX + 1) * (state.cellsY + 1)).fill(null);

        const cellId = (p) => { return p[0] + p[1] * (state.cellsX + 1); };

        for (let i in state.hingeMap)
        {
        	state.hingeMap[i] = [];
        }

        for (let i in state.beams)
        {
        	const beam = state.beams[i];

        	if (beam.start[0] == beam.end[0] && beam.start[1] === beam.end[1]) continue;

        	state.hingeMap[cellId(beam.start)].push({'index': i, 'side': 0});
        	state.hingeMap[cellId(beam.end)].push({'index': i, 'side': 1});
        }

        state.error = 0;
        state.activeHinges = 0;

        state.singular = false;

        // Damping

        for (let beam of state.beams)
        {
        	beam.startForce[0] *= state.damping;
        	beam.startForce[1] *= state.damping;
        	beam.endForce[0] *= state.damping;
        	beam.endForce[1] *= state.damping;
        }
    };

    const solveStupid = (doDraw) => {
        // Beam force & moment

        for (let beam of state.beams)
        {
        	const dx = beam.end[0] - beam.start[0];
        	const dy = beam.end[1] - beam.start[1];
        	const L = Math.sqrt(dx * dx + dy * dy);

        	if (L < 0.5) continue;

        	const density = 1;
        	const gravity = 0.25;

        	const fx = (beam.startForce[0] + beam.endForce[0]) / 2;
        	const fy = (beam.startForce[1] + beam.endForce[1] + state.density * state.gravity * L) / 2;

        	state.error += (fx * fx + fy * fy) * 4;

        	beam.startForce[0] -= fx;
        	beam.startForce[1] -= fy;
        	beam.endForce[0] -= fx;
        	beam.endForce[1] -= fy;

        	const tx = dx / L;
        	const ty = dy / L;

        	const nx = -ty;
        	const ny =  tx;

        	const M0 = beam.startForce[0] * nx + beam.startForce[1] * ny;
        	const M1 = beam.endForce[0] * nx + beam.endForce[1] * ny;

        	const dM = (M1 - M0) / 2;

        	state.error += dM * dM * 4;

        	beam.startForce[0] += nx * dM;
        	beam.startForce[1] += ny * dM;
        	beam.endForce[0] -= nx * dM;
        	beam.endForce[1] -= ny * dM;
        }

        // Hinge force

        for (let i in state.hingeMap)
        {
        	if (state.hingeMap[i].length == 0) continue;

        	{
        		const x = (Number(i) % (state.cellsX + 1));
        		const y = Math.floor(Number(i) / (state.cellsX + 1));

        		if (state.isWall(x, y)) continue;
        	}

        	state.activeHinges += 1;

        	let fx = 0;
        	let fy = 0;
        	for (let h of state.hingeMap[i])
        	{
        		const beam = state.beams[h.index];
        		const force = (h.side == 0) ? beam.startForce : beam.endForce;

    			fx += force[0];
    			fy += force[1];
        	}

        	state.error += fx * fx + fy * fy;

        	fx /= state.hingeMap[i].length;
        	fy /= state.hingeMap[i].length;

        	for (let h of state.hingeMap[i])
        	{
        		const beam = state.beams[h.index];
        		const force = (h.side == 0) ? beam.startForce : beam.endForce;

        		force[0] -= fx;
        		force[1] -= fy;
        	}
        }
    };

    const solveGradient = () => {
    	let matrix = [];
    	let rhs = [];
        let vars = [];

        // Beam force & moment

        for (let i in state.beams)
        {
        	const beam = state.beams[i];

        	const dx = beam.end[0] - beam.start[0];
        	const dy = beam.end[1] - beam.start[1];
        	const L = Math.sqrt(dx * dx + dy * dy);

        	vars.push(beam.startForce[0]);
        	vars.push(beam.startForce[1]);
        	vars.push(beam.endForce[0]);
        	vars.push(beam.endForce[1]);

        	if (L < 0.5) continue;

        	const density = 1;
        	const gravity = 0.25;

        	matrix.push([[4 * i + 0, 1], [4 * i + 2, 1]]);
        	rhs.push(0);

        	matrix.push([[4 * i + 1, 1], [4 * i + 3, 1]]);
        	rhs.push(-state.density * state.gravity * L);

        	const tx = dx / L;
        	const ty = dy / L;

        	const nx = -ty;
        	const ny =  tx;

        	matrix.push([[4 * i + 0, -nx], [4 * i + 1, -ny], [4 * i + 2, nx], [4 * i + 3, ny]]);
        	rhs.push(0);
        }

        // Hinge force

        for (let i in state.hingeMap)
        {
        	if (state.hingeMap[i].length == 0) continue;

        	{
        		const x = (Number(i) % (state.cellsX + 1));
        		const y = Math.floor(Number(i) / (state.cellsX + 1));

        		if (state.isWall(x, y)) continue;
        	}

        	state.activeHinges += 1;

        	let rowx = [];
        	let rowy = [];
        	for (let h of state.hingeMap[i])
        	{
        		rowx.push([4 * h.index + 2 * h.side + 0, 1]);
        		rowy.push([4 * h.index + 2 * h.side + 1, 1]);
        	}

        	matrix.push(rowx);
        	rhs.push(0);
        	matrix.push(rowy);
        	rhs.push(0);
        }

        // Compute the error term Ax-b

        let error = Array(matrix.length).fill(0);
        for (let row = 0; row < matrix.length; ++row)
        {
        	for (let el of matrix[row])
        	{
        		error[row] += el[1] * vars[el[0]];
        	}

        	error[row] -= rhs[row];

    		state.error += error[row] * error[row];
        }

        // Compute the gradient A^T * (Ax-b)

        let gradient = Array(vars.length).fill(0);
        for (let column = 0; column < matrix.length; ++column)
        {
        	for (let el of matrix[column])
        	{
        		gradient[el[0]] += el[1] * error[column];
        	}
        }

        // Emulate wrong underdetermined least-squares

        if (state.wrongUnderdetermined)
        {
	        for (let i = 0; i < vars.length; ++i)
	        {
	        	gradient[i] += vars[i];
	        }
        }

        // Apply descent step

        const step = 0.25;

        for (let i in state.beams)
        {
        	const beam = state.beams[i];

        	beam.startForce[0] -= step * gradient[4 * i + 0];
        	beam.startForce[1] -= step * gradient[4 * i + 1];
        	beam.endForce[0] -= step * gradient[4 * i + 2];
        	beam.endForce[1] -= step * gradient[4 * i + 3];
        }
    };

    const solveGauss = () => {
    	let matrix = [];
    	let rhs = [];
        let vars = [];

        // Beam force & moment

        for (let i in state.beams)
        {
        	const beam = state.beams[i];

        	const dx = beam.end[0] - beam.start[0];
        	const dy = beam.end[1] - beam.start[1];
        	const L = Math.sqrt(dx * dx + dy * dy);

        	vars.push(beam.startForce[0]);
        	vars.push(beam.startForce[1]);
        	vars.push(beam.endForce[0]);
        	vars.push(beam.endForce[1]);

        	if (L < 0.5) continue;

        	const density = 1;
        	const gravity = 0.25;

        	matrix.push([[4 * i + 0, 1], [4 * i + 2, 1]]);
        	rhs.push(0);

        	matrix.push([[4 * i + 1, 1], [4 * i + 3, 1]]);
        	rhs.push(-state.density * state.gravity * L);

        	const tx = dx / L;
        	const ty = dy / L;

        	const nx = -ty;
        	const ny =  tx;

        	matrix.push([[4 * i + 0, -nx], [4 * i + 1, -ny], [4 * i + 2, nx], [4 * i + 3, ny]]);
        	rhs.push(0);
        }

        // Hinge force

        for (let i in state.hingeMap)
        {
        	if (state.hingeMap[i].length == 0) continue;

        	{
        		const x = (Number(i) % (state.cellsX + 1));
        		const y = Math.floor(Number(i) / (state.cellsX + 1));

        		if (state.isWall(x, y)) continue;
        	}

        	state.activeHinges += 1;

        	let rowx = [];
        	let rowy = [];
        	for (let h of state.hingeMap[i])
        	{
        		rowx.push([4 * h.index + 2 * h.side + 0, 1]);
        		rowy.push([4 * h.index + 2 * h.side + 1, 1]);
        	}

        	matrix.push(rowx);
        	rhs.push(0);
        	matrix.push(rowy);
        	rhs.push(0);
        }

        // Compute error
        // NB: can't do it after solving the system because
        // the solver can alter rhs in-place
        for (let i = 0; i < matrix.length; ++i)
        {
        	let value = 0;
        	for (let el of matrix[i])
        	{
        		value += el[1] * vars[el[0]];
        	}
        	value -= rhs[i];

        	state.error += value * value;
        }

        if (matrix.length == vars.length)
        {
        	// Square system, convert to dense and solve directly

        	let denseMatrix = [];
        	for (let row of matrix)
        	{
        		let denseRow = Array(matrix.length).fill(0);
        		for (let el of row)
        			denseRow[el[0]] = el[1];
        		denseMatrix.push(denseRow);
        	}

        	let result = denseGauss(denseMatrix, rhs);
        	if (!(result === null))
        	{
        		vars = result;
        	}
        	else
        	{
				state.singular = true;
        	}
        }
        else if (matrix.length < vars.length)
        {
        	// Underdetermined system
        	// Solve A A^T z = b, then set x = A^T z

        	// Compute dense A A^T
        	let denseMatrix = Array(matrix.length);
        	for (let i = 0; i < matrix.length; ++i)
        	{
        		denseMatrix[i] = Array(matrix.length).fill(0);

        		for (let j = 0; j < matrix.length; ++j)
        		{
        			let it = 0;
        			let jt = 0;

        			while (it < matrix[i].length && jt < matrix[j].length)
        			{
        				if (matrix[i][it][0] < matrix[j][jt][0])
        				{
        					++it;
        				}
        				else if (matrix[i][it][0] > matrix[j][jt][0])
        				{
        					++jt;
        				}
        				else // if (matrix[i][it][0] == matrix[j][jt][0])
        				{
        					denseMatrix[i][j] += matrix[i][it][1] * matrix[j][jt][1];
        					++it;
        					++jt;
        				}
        			}
        		}
        	}

        	// Solve A A^T z = b
        	let result = denseGauss(denseMatrix, rhs);
        	if (!(result === null))
        	{
        		// Compute x = A^T z
        		vars.fill(0);
        		for (let i = 0; i < matrix.length; ++i)
        		{
        			for (let el of matrix[i])
        			{
        				vars[el[0]] += el[1] * result[i];
        			}
        		}
        	}
        	else
        	{
				state.singular = true;
        	}
        }
        else // if (matrix.length > vars.length)
        {
        	// Overdetermined system
        	// Solve A^T A x = A^T b

        	// Compute A^T b
        	let atrhs = Array(vars.length).fill(0);
    		for (let i = 0; i < matrix.length; ++i)
    		{
    			for (let el of matrix[i])
    			{
    				atrhs[el[0]] += el[1] * rhs[i];
    			}
    		}

    		// Compute dense A
    		let denseA = Array(matrix.length);
    		for (let i = 0; i < matrix.length; ++i)
    		{
    			denseA[i] = Array(vars.length).fill(0);

    			for (let el of matrix[i])
    			{
    				denseA[i][el[0]] = el[1];
    			}
    		}

    		// Compute dense A^T A
    		let denseMatrix = Array(vars.length);
    		for (let i = 0; i < vars.length; ++i)
    		{
    			denseMatrix[i] = Array(vars.length).fill(0);

    			for (let j = 0; j < vars.length; ++j)
    			{
    				for (let k = 0; k < matrix.length; ++k)
    				{
    					denseMatrix[i][j] += denseA[k][i] * denseA[k][j];
    				}
    			}
    		}

    		// Solve A^T A x = A^T b
    		let result = denseGauss(denseMatrix, atrhs);
    		if (!(result === null))
    		{
    			vars = result;
    		}
        	else
        	{
				state.singular = true;
        	}
        }

        if (state.singular)
        	vars.fill(0);

        // Restore state

        for (let i in state.beams)
        {
        	const beam = state.beams[i];

        	beam.startForce[0] = vars[4 * i + 0];
        	beam.startForce[1] = vars[4 * i + 1];
        	beam.endForce[0] = vars[4 * i + 2];
        	beam.endForce[1] = vars[4 * i + 3];
        }
    };

    const update = () => {
        if (document.hidden) return;
    	if (!isVisible(canvas)) return;

    	prepare();

    	if (state.solver == 'stupid')
    		solveStupid();
    	else if (state.solver == 'gradient')
    		solveGradient();
    	else if (state.solver == 'gauss')
    		solveGauss();

        window.requestAnimationFrame(() => { draw(); });
    };

    setInterval(update, 16);
    update();
}

</script>

There is one idea I've been passively tinkering with in my head for years without any success. Imagine a game where you have some building blocks (cubes, walls, platforms, pillars, whatever), and you want them to be able to break under load. Imagine Minecraft, where you build a horizontal beam of blocks in the air, attached to some mountain, and the beam breaks if you build it too far. Or, say, the Sims, where a small wooden pillar breaks because your whole 5-floor concrete house was supported by this only pillar. You get the idea.

Game design issues aside, how do you even calculate this *load* on some supporting structure? We could probably do something simple, like if you have 5 pillars connecting the house to the ground, and the house weighs 50 tons, the load is 10 tons per pillar. This, however, ignores a lot of detail: what about supports that are not connected to the ground and instead connect different floors of the house? What about uneven mass distribution across the house? What about the center of gravity and how it affects the distribution of load? Etc, etc.

After thinking about Minecraft-like blocks for a while, I realized this is already too complicated, and I don't understand a lot of things involved here. *(Though, I've managed to come up with a really nice model, which I'll probably describe in a follow-up post.*) Then I decided to constrain myself to a hopefully much simpler case of *beams*.

By the way, of course I tried to research the topic from some physics books and didn't understand anything. I also tried to ask something related to this [on physics.stackexchange](https://physics.stackexchange.com/questions/788654/computing-cauchy-stress-tensor-in-a-static-cube-of-uniform-isotropic-material), got three answers, and didn't understand a single one of them either.

* TOC
{:toc}

# The beams

So, I have some configuration of beams. They can connect to walls, or the floor, or to each other. Something like this:

<center><canvas id="canvas1"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.display = 'none';
	state.topWall = false;
	state.rightWall = false;
	state.addBeam(0, 5, 5, 10);
	state.addBeam(0, 5, 10, 5);
	state.addBeam(5, 10, 10, 5);
	state.addBeam(10, 5, 10, 10);
	state.forceScale = 20;
	makeWhiteboard('canvas1', state);
}
</script>
<br>

Let's say they are all uniformly dense, and have the same density. We treat them as one-dimensional, so the density is in units mass per length. They are all affected by gravity.

Whenever a beam touches a wall/floor, or whenever two beams connect to each other via their ends, let's say this connection is done via an incredibly strong glue, so that the beams cannot rotate or somehow move around this connection. This connections are rigid and massless. I'm calling them *hinges* in my code, and despite them not being hinges, I'll still call them hinges throughout this post.

We also assume that the beams are static --- they don't move, and are in an *equillibrium* (even if it is an unstable one).

What we want to compute are *the forces acting on each beam's two ends*. Something like this:

<center><canvas id="canvas2"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.addBeam(0, 5, 5, 10);
	state.addBeam(0, 5, 10, 5);
	state.addBeam(5, 10, 10, 5);
	state.addBeam(10, 5, 10, 10);
	state.forceScale = 20;
	makeWhiteboard('canvas2', state);
}
</script>
<br>

From that, as we'll see later, we can compute how the beam is stretched or contracted, how much is it bent, and so on.

You might say: there is nothing simpler! Just write down the equations for these forces, solve them, and you're done! Well, you'd be mostly right, except for the *solving* part.

But before we discuss why is it so hard to solve these equations, let's look at some examples first.

# Examples

Say we have a single perfectly straight vertical beam. Its lower end touches the ground, while its upper end doesn't touch anything. The force on the upper end must be equal to zero, because there is nothing at this end acting on the beam (we ignore things like air pressure, wind, etc). Thus, the force at the lower end must point upwards and completely compensate the gravity force:

<center><canvas id="canvas3"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(8, 10, 8, 5);
	makeWhiteboard('canvas3', state);
}
</script>
<br>

A similar example, but this time the beam is glued to the ceiling. The bottom force must be zero, and the top force must again point upwards to compensate for gravity:

<center><canvas id="canvas4"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 5);
	state.bottomWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(8, 0, 8, 2);
	makeWhiteboard('canvas4', state);
}
</script>
<br>

Another, somewhat silly, example: a beam is simply lying on the floor. However, in our model it can only glue to the floor on its ends, while the middle section of the beams is kind of above the floor by an infinitely small amount. In this case, the gravity must be compensated by two forces on the left and right ends, which should probably be equal due to symmetry:

<center><canvas id="canvas5"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 5);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(4, 5, 12, 5);
	makeWhiteboard('canvas5', state);
}
</script>
<br>

Ok fine, but what if our beam is sitting diagonally between a floor and a wall? Honestly, I don't have a good intuition about what should happen in this case. The forces must compensate the gravity, but other than that I'm pretty lost concerning how they should look like. Here's a fairly reasonable arrangement of forces:

<center><canvas id="canvas6"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.addBeam(0, 5, 10, 10);
	makeWhiteboard('canvas6', state);
}
</script>
<br>

Note that the forces don't have to be orthogonal to the walls, as would happen if the beam was touching the wall without any glue.

What about more than one beam? Say we have two beams arranged in an upside-down V shape. They must be pushing each other sideways at the connection point, and they probably push the ground sideways as well, and the ground pushes them back. Something like this:

<center><canvas id="canvas7"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(4, 10, 8, 5);
	state.addBeam(12, 10, 8, 5);
	makeWhiteboard('canvas7', state);
}
</script>
<br>

Or consider this nice symmetric triangular arrangement of beams, kind of like a triangular house of cards:

<center><canvas id="canvas9"></canvas></center>
<script>
{
	const state = makeWhiteboardState(24, 16);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;

	state.addBeam(4, 16, 6, 12);
	state.addBeam(8, 16, 6, 12);
	state.addBeam(8, 16, 10, 12);
	state.addBeam(12, 16, 10, 12);
	state.addBeam(12, 16, 14, 12);
	state.addBeam(16, 16, 14, 12);
	state.addBeam(16, 16, 18, 12);
	state.addBeam(20, 16, 18, 12);

	state.addBeam(6, 12, 10, 12);
	state.addBeam(10, 12, 14, 12);
	state.addBeam(14, 12, 18, 12);

	state.addBeam(6, 12, 8, 8);
	state.addBeam(10, 12, 8, 8);
	state.addBeam(10, 12, 12, 8);
	state.addBeam(14, 12, 12, 8);
	state.addBeam(14, 12, 16, 8);
	state.addBeam(18, 12, 16, 8);

	state.addBeam(8, 8, 12, 8);
	state.addBeam(12, 8, 16, 8);

	state.addBeam(8, 8, 10, 4);
	state.addBeam(12, 8, 10, 4);
	state.addBeam(12, 8, 14, 4);
	state.addBeam(16, 8, 14, 4);

	state.addBeam(10, 4, 14, 4);

	state.addBeam(10, 4, 12, 0);
	state.addBeam(14, 4, 12, 0);

	state.forceScale = 10;

	makeWhiteboard('canvas9', state);
}
</script>
<br>

Or maybe we go crazy and make a whole bunch of beams all touching the ground and connected to a single point:

<center><canvas id="canvas8"></canvas></center>
<script>
{
	const state = makeWhiteboardState(36, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	for (let i = -9; i <= 9; ++i)
	{
		state.addBeam(18 + i * 2, 10, 18, 5);
	}
	state.forceScale = 10;
	makeWhiteboard('canvas8', state);
}
</script>
<br>

I hope you have an idea of what we're trying to calculate by now. Let's try making our model precise now.

# The model

So, we want to compute the forces at both ends for each beam. This means that for each beam we have two unknown 2-dimensional force vectors $$F_a$$ and $$F_b$$.

We need some equations for these forces, which come from the assumption that our system is in a static equillibrium. We have three types of equations:

1. The sum of the forces acting on each beam is zero.
2. The sum of the torques of the forces acting on each beam is zero.
3. The sum of the forces acting on each hinge is zero.

There are only three forces acting on each beam: the two forces $$F_a, F_b$$ acting on the beam's ends, and the gravity force $$mg$$. So, the first equation tells us that

\\[ F_a + F_b + mg = 0 \\]

The torque, i.e. rotational moment, of a force $$F$$ is computed as $$r \times F$$, where $$r$$ is the vector from the center of the body to the point where the force is applied to, and $$\times$$ is a cross product. The gravitational force never does any rotation (*this is actually a nontrivial result from mechanics; we can think that gravity always acts on the body's center, in which case $$r = 0$$*), so we're only left with the forces acting on the beam ends. Since the ends are symmetric with respect to the center of the beam, the $$r$$ vectors are opposite for $$F_a$$ and $$F_b$$, and we get something like

\\[ F_a \times (-r) + F_b \times r = 0 \\]

or

\\[ (F_b - F_a) \times r = 0 \\]

Now, in 2D the cross product can be replaced with a dot product with a vector, orthogonal to $$r$$. In our case $$r$$ is the vector from the beam center to the beam's end, so an orthogonal vector is, for example, a vector $$n$$ which is normal to the beam. We don't care about it's length, because our equation has a $$= 0$$ in the right-hand side. So, our equation becomes

\\[ (F_b - F_a) \cdot n = 0 \\]

or 

\\[ F_a \cdot n = F_b \cdot n \\]

which means that in order not to rotate the beam, the two forces must coincide in the normal direction. This makes total sense: if one force was stronger than the other, it would overcome it and rotate the beam. This also has the added benefit that the torque balance equation has the dimension of *forces* instead of *forces times lengths*, which [will be useful later](#least-squares).

The last equation is the sum of all the forces for each hinge. When a set of beams are connected in a single point, the sum of the forces acting this point must be zero. For example, if three beams are connected to a single hinge, with the first two being connected via their first end (where $$F_a$$ acts), and the third being connected via its second end (where $$F_b$$ acts), this gives us the equation

$$F_{a1} + F_{a2} + F_{b3} = 0$$

where $$F_{a1}$$ is the $$F_a$$ force of the first beam, and so on.

I've glossed over two special cases:

1. The hinge connects the beam to the ground. In this case, there is an extra unknown ground force, which we don't care about, so this connection doesn't produce a useful equation. We could add both the unknown force and the balance equation to the system, which would only increase the computational efforts without adding any useful information.
2. A beam end doesn't connect to anything and simply floats in space. In this case it isn't a hinge or a connection of any sort, but it is still useful to consider it as a single-beam hinge, and the hinge equation would tell us that the force at this beam's free end must be zero (because it is static and isn't connected to anything).

So, here's our final mathematical model of a set of beams:

* For each beam, we have 2 unknown 2D vectors $$F_a, F_b$$ representing the forces acting on the beam's ends
* For each beam, we have a vector equation $$F_a + F_b + mg = 0$$
* For each beam, we have a scalar equation $$F_a \cdot n = F_b \cdot n$$
* For each hinge, we have a vector equation $$\sum F_i = 0$$ (*for this equation, wall connections aren't hinges, while free-floating beam ends are hinges*)

Now let's talk about how we'd solve this equation.

# Counting equations

The first thing that comes to mind about this set of equations is that it looks stupidly simple. A few sums here and there are equal to zero, that's it. Don't let these equations fool you: they are cursed as hell. *Well, maybe not that cursed, but still far from being completely tame.*

The second thing that comes to mind about this set of equations is that it is *linear*. The components of our unknown forces are only added up and multiplied by scalars, that's it. This is *insanely* good: linear systems are basically the only thing humanity knowns how to reliably solve. If the system is good enough, that is. Is it?

For a linear system to be good, it must be *square*: the number of unknowns must be equal to the number of equations. Let's count how many of these we have:

* For each beam, we have 2 unknown 2D vectors, thus 4 scalar unknowns
* For each beam, we have 1 vector equation and 1 scalar equation, so 3 scalar equations in total
* For each hinge, we have 1 vector equation, which is 2 scalar equations

In total, if we have $$B$$ beams and $$H$$ hinges, we have $$4B$$ unknowns and $$3B+2H$$ equations. Solving $$4B=3B+2H$$ gives us $$B=2H$$, i.e. there must be twice as many beams as there are hinges. Must this always be the case? Hardly so!

Look at our first example, a beam standing vertically on the ground.

<center><canvas id="canvas10"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(8, 10, 8, 5);
	state.debug = true;
	makeWhiteboard('canvas10', state);
}
</script>
<br>

We have $$B=1$$ and $$H=1$$ (the free top end of the beam is a virtual hinge, remember?). In this case, we get $$4B = 4$$ unknowns and $$3B+2H=5$$ equations. Tsk-tsk.

Consider another example of a diagonal beam supported at both ends.

<center><canvas id="canvas11"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.addBeam(0, 5, 10, 10);
	state.debug = true;
	makeWhiteboard('canvas11', state);
}
</script>
<br>

$$B=1$$ beam and no hinges (the wall hinges don't lead to useful equations), so we get $$4B=4$$ unknowns and only $$3B+2H=3$$ equations.

Ok, but can we get a square system? Yes, sometimes, like in the upside-down V shape:

<center><canvas id="canvas12"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(4, 10, 8, 5);
	state.addBeam(12, 10, 8, 5);
	state.debug = true;
	makeWhiteboard('canvas12', state);
}
</script>
<br>

Here, $$B=2$$ and $$H=1$$, leading to $$4B=8$$ unknowns and $$3B+2H=6+2=8$$ equations. Hooray!

Why is the number of unknowns and equations so important, you might ask? Well, because it tells us how *determined* our system is.

# Determinacy

*I'm not even sure if "determinacy" is a word, but I like it.*

*Update: I googled it. It is, in fact, a word.*

If the system is square, i.e. the number of equations is the same as the number of unknowns, basic linear algebra tells us that there is *usually* a single solution to the system. (*We'll talk about this "usually" in a bit.*)

If the number of equations is smaller than the number of unknowns, we have an *underdetermined* system: we didn't constrain our unknowns enough, and they have some wiggle room. In this case, *usually* there are many different solutions. Infinitely many, even.

If, however, the number of equations is larger than the number of unknowns, the system is *overdetermined*: we have more constraints than we can possibly satisfy. In this case, the system *usually* doesn't have a solution *at all*. Like, at all. No solution, period. Well, *usually*.

This is all somewhat shady, because we're talking about a physical system. Surely, it is a *model* of a system, but a seemingly good model nevertheless (*if you know a better model of the same thing --- email me immediately*). Surely the physical world can compute some forces, but for some reason we can't? That's pants, if you ask me.

The case of an *underdetermined* system is easy to justify: probably the exact force distribution depends on the specific materials, on some friction coefficients, and so on. We don't include them in our model, hence there is no unique solution to the problem.

The case of an *overdetermined* system is harder. I mean, I have no idea why a system like this would be overdetermined, yet most interesting systems seem to be of that type. Somehow we included more equations that *physics itself allows for*, and I'm struggling to find a reasonable interpretation for that, except that maybe our model is just bad and wrong.

*Or maybe I'm just not that good at physics.*

# Usually?

What's up with that *usually* in the previous section? Well, even if a system is square, it might still be bad if the determinant of the matrix of the system is zero, or, equivalently, if the equations are not independent. In this case, we call the system *singular*, and the system can have no solutions (like for an overdetermined system), or have many solutions (like in an underdetermined system). Here's an example of how this might happen:

\\[ \begin{matrix} x+y=1 \\\\ 2x+2y=2 \end{matrix} \\]

Clearly, the second equation *follows from* the first one, so we could as well just throw it away and be left with 1 equation for two unknowns, which has infinitely many solutions.

For another example, consider a system

\\[ \begin{matrix} x+y=1 \\\\ 2x+2y=3 \end{matrix} \\]

Clearly, the second equation *contradicts* the first one, and there can be no solutions.

This only happens when the system has zero determinant, though, and a random system in the wild typically has a non-zero determinant.

However, this can also happen to an underdetermined or an overdetermined system, in which case the determinant doesn't make sense and we talk about the system having or not having a *full rank*.

Our systems come from a set of beams, and whether they are full-rank or not depends on a particular system, i.e. a particular arrangement of beams.

# Solution methods

So, we have a system of linear equations, which might or might not have a solution, and which might have one or infinitely many solutions. Great.

What we want is to solve it, i.e. to find some arrangement of forces that satisfies all the equations, or at least satisfies them as much as possible. We have a few options to achieve this:

1. Improve our model to better reflect reality, so that it always produces a non-singular square system of equations
2. Solve our system in a least-squares sense, finding an arrangement of forces that is as close as possible to satisfying the equations
3. Slap a stupid iterative equation solver and hope for the best

Guess what I tried first.

# A stupid solver

There's a really funny way of solving linear systems which works far more often than you'd think it should. Here's the recipe:

1. Take an initial guess of the solution (setting all unknowns to zero works fine)
2. Iterate over all equations you have
3. For each equation of the form $$X+Y+Z=A$$, compute the *current* value $$A' = X+Y+Z$$, compute the *error* $$A - A'$$, and change the values of the unknowns by evenly redistributing the error $$X \leftarrow X + (A-A')/3$$ (and so on for $$Y$$ and $$Z$$), forcing this particular equation to be true
4. Repeate 2-3 until your unknowns converge to a solution

As far as I've heard, this is called *iterative relaxation* or something like that. In some cases, like solving a [Laplace's equation](https://en.wikipedia.org/wiki/Laplace%27s_equation) on a square grid, it directly corresponds to iterations of the [Gauss-Seidel method](https://en.wikipedia.org/wiki/Gauss%E2%80%93Seidel_method) (*or at least I think it does...*).

This solver doesn't take any assumptions about our system of equations, and is extremely easy to implement. The only problem is the torque balance equation, which is of the form

\\[ (F_b-F_a)\cdot n = 0 \\]

instead of being a simple sum. In this case, I'm computing the current value $$M = (F_b - F_a)\cdot n$$, and alter the forces like this:

\\[ \begin{matrix} F_a \leftarrow F_a + \frac{M}{2} n \\\\ F_b \leftarrow F_b - \frac{M}{2} n  \end{matrix} \\]

If we compute the new value, we get

\\[ \left[\left(F_b-\frac{M}{2}n\right) - \left(F_a+\frac{M}{2}n\right)\right]\cdot n = (F_b-F_a)\cdot n - 2\frac{M}{2}(n\cdot n) = M - M = 0 \\]

*(We used the fact that $$n$$ is normalized).*

So, this is an iterative method, and on each step it tries to force each equation to be true, one by one. Let's see how well it works.

First, a square system: it seems to converge to a reasonable solution pretty quickly:

<center>
<div>
<canvas id="canvas13"></canvas>
<br>
<button type="button" onclick='resetForces("canvas13");'>Reset</button>
</div>
</center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(4, 10, 8, 5);
	state.addBeam(12, 10, 8, 5);
	state.debug = true;
	state.solver = 'stupid';
	makeWhiteboard('canvas13', state);
}
</script>
<br>

Let's look at a few overdetermined systems --- one that has a solution (a straight vertical beam), and one that doesn't (a beam that is diagonal but is still supported only by the floor):

<center>
<table>
<tr>
<td><canvas id="canvas14"></canvas></td>
<td><canvas id="canvas15"></canvas></td>
</tr>
<tr>
<td><center><button type="button" onclick='resetForces("canvas14");'>Reset</button></center></td>
<td><center><button type="button" onclick='resetForces("canvas15");'>Reset</button></center></td>
</tr>
</table>
</center>

<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(8, 10, 8, 5);
	state.debug = true;
	state.solver = 'stupid';
	makeWhiteboard('canvas14', state);
}
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(7, 10, 9, 5);
	state.debug = true;
	state.solver = 'stupid';
	makeWhiteboard('canvas15', state);
}
</script>
<br>

The method manages to find a solution when it exists, even though the system is overdetermined, and also finds *some* solution if no proper solution is possible.

Let's have a look at an underdetermined system: a beam supported both by the floor and the wall. In fact, let's have two such beams simultaneously.

<center>
<div>
<canvas id="canvas16"></canvas>
<br>
<button type="button" onclick='resetForces("canvas16");'>Reset</button>
</div>
</center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.addBeam(0, 5, 5, 10);
	state.addBeam(11, 10, 16, 5);
	state.debug = true;
	state.solver = 'stupid';
	makeWhiteboard('canvas16', state);
}
</script>
<br>

The method seems to find a good enough solution! But, by the nature of the method, if we start from a different initial force arrangement, it will converge to a different solution. Here, I've manually set the starting forces to something non-zero:

<center><canvas id="canvas17"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.addBeam(0, 5, 5, 10);
	state.addBeam(11, 10, 16, 5);
	state.beams[0].startForce = [1, 0];
	state.beams[1].startForce = [-1, 0];
	state.debug = true;
	state.solver = 'stupid';
	state.interactive = true;
	makeWhiteboard('canvas17', state);
}
</script>
<br>

This example is interactive, by the way! Click and drag to add new beams, right-click to remove beams. You can try to recreate the exact same beams and you'll see that the solution will depend on how exactly did you create this beams.

Let's also stress-test this method:

<center>
<div>
<canvas id="canvas18"></canvas>
<br>
<button type="button" onclick='resetForces("canvas18");'>Reset</button>
</div>
</center>
<script>
{
	const state = makeWhiteboardState(24, 16);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;

	state.addBeam(4, 16, 6, 12);
	state.addBeam(8, 16, 6, 12);
	state.addBeam(8, 16, 10, 12);
	state.addBeam(12, 16, 10, 12);
	state.addBeam(12, 16, 14, 12);
	state.addBeam(16, 16, 14, 12);
	state.addBeam(16, 16, 18, 12);
	state.addBeam(20, 16, 18, 12);

	state.addBeam(6, 12, 10, 12);
	state.addBeam(10, 12, 14, 12);
	state.addBeam(14, 12, 18, 12);

	state.addBeam(6, 12, 8, 8);
	state.addBeam(10, 12, 8, 8);
	state.addBeam(10, 12, 12, 8);
	state.addBeam(14, 12, 12, 8);
	state.addBeam(14, 12, 16, 8);
	state.addBeam(18, 12, 16, 8);

	state.addBeam(8, 8, 12, 8);
	state.addBeam(12, 8, 16, 8);

	state.addBeam(8, 8, 10, 4);
	state.addBeam(12, 8, 10, 4);
	state.addBeam(12, 8, 14, 4);
	state.addBeam(16, 8, 14, 4);

	state.addBeam(10, 4, 14, 4);

	state.addBeam(10, 4, 12, 0);
	state.addBeam(14, 4, 12, 0);

	state.forceScale = 10;

	state.debug = true;
	state.solver = 'stupid';

	makeWhiteboard('canvas18', state);
}
</script>
<br>

It does something reasonable (again, provided we zero-initialize all the forces), but it takes some time to converge.

I was still generally happy with this method, except for how it handles non-square systems:

* For overdetermined systems with no proper solution, it produces some set of forces, with no guarantee on how good this forces are
* For underdetermined systems it produces some solution which might look pretty random if the initial guess is bad, or if we're adding beams on-the-fly

Can we do something better?

# Least squares

There's a well-known trick of turning any equation into a minimization problem: instead of solving $$f(x)=0$$, you minimize $$f(x)^2$$. We square the thing so that it becomes positive and $$f(x)=0$$ will be the true minimum, and we don't do something like $$\|f(x)\|$$ because squaring is a simple algebraic operation with nice properties. The benefit is that even if the original problem didn't have a solution, the minimization problem almost always has some solution.

So, in our case, instead of solving the overdetermined linear equation $$Ax=b$$ which might not even have a solution, we try to minimize $$\|Ax-b\|^2$$. Note that this is a sum of squares of all the coordinates of the vector $$Ax-b$$, and if these coordinates have different units, adding them up doesn't quite make sense. Here, though, we've already transformed the torque balance equations to have the same units as the force balance equations.

There are explicit formulas for that, which, however, require us to solve a square linear system in the process (using e.g. Gauss elimination), and I wanted to implement something in like 15 minutes to see if the whole idea can work at all. So, instead I decided to try gradient descent.

# Least squares: gradient descent

If you stare long enough into the formula $$\|Ax-b\|^2$$, you can figure out that the gradient of this scalar function with respect to vector $$x$$ is equal to $$2 A^T (Ax-b)$$. Thus, we can try doing the usual gradient descent with a fixed step size (I used 0.25) and see what solution we get. This seems to work better (right image) for overdetermined systems that the stupid solver (left image):

<center>
<table>
<tr>
<td><canvas id="canvas19"></canvas></td>
<td><canvas id="canvas20"></canvas></td>
</tr>
<tr>
<td><center><button type="button" onclick='resetForces("canvas19");'>Reset</button></center></td>
<td><center><button type="button" onclick='resetForces("canvas20");'>Reset</button></center></td>
</tr>
</table>
</center>

<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(7, 10, 9, 5);
	state.debug = true;
	state.solver = 'stupid';
	makeWhiteboard('canvas19', state);
}
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(7, 10, 9, 5);
	state.debug = true;
	state.solver = 'gradient';
	makeWhiteboard('canvas20', state);
}
</script>
<br>

This method found a better solution (i.e. the total error $$\|Ax-b\|^2$$ was smaller) at the expense of ignoring the physical reality and assigning some force to the free-floating top beam end.

For square systems, this method performs as good as the previous one, though it seems to converge a bit slower:

<center>
<div>
<canvas id="canvas21"></canvas>
<br>
<button type="button" onclick='resetForces("canvas21");'>Reset</button>
</div>
</center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(4, 10, 8, 5);
	state.addBeam(12, 10, 8, 5);
	state.debug = true;
	state.solver = 'gradient';
	makeWhiteboard('canvas21', state);
}
</script>
<br>

And for underdetermined systems this method is still sensitive to the initial guess or dynamic modifications of the system:


<center><canvas id="canvas22"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.addBeam(0, 5, 5, 10);
	state.addBeam(11, 10, 16, 5);
	state.beams[0].startForce = [1, 0];
	state.beams[1].startForce = [-1, 0];
	state.debug = true;
	state.solver = 'gradient';
	state.interactive = true;
	makeWhiteboard('canvas22', state);
}
</script>
<br>

(This simulation is also interactive.)

And, as usual, a stress-test:

<center>
<div>
<canvas id="canvas23"></canvas>
<br>
<button type="button" onclick='resetForces("canvas23");'>Reset</button>
</div>
</center>
<script>
{
	const state = makeWhiteboardState(24, 16);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;

	state.addBeam(4, 16, 6, 12);
	state.addBeam(8, 16, 6, 12);
	state.addBeam(8, 16, 10, 12);
	state.addBeam(12, 16, 10, 12);
	state.addBeam(12, 16, 14, 12);
	state.addBeam(16, 16, 14, 12);
	state.addBeam(16, 16, 18, 12);
	state.addBeam(20, 16, 18, 12);

	state.addBeam(6, 12, 10, 12);
	state.addBeam(10, 12, 14, 12);
	state.addBeam(14, 12, 18, 12);

	state.addBeam(6, 12, 8, 8);
	state.addBeam(10, 12, 8, 8);
	state.addBeam(10, 12, 12, 8);
	state.addBeam(14, 12, 12, 8);
	state.addBeam(14, 12, 16, 8);
	state.addBeam(18, 12, 16, 8);

	state.addBeam(8, 8, 12, 8);
	state.addBeam(12, 8, 16, 8);

	state.addBeam(8, 8, 10, 4);
	state.addBeam(12, 8, 10, 4);
	state.addBeam(12, 8, 14, 4);
	state.addBeam(16, 8, 14, 4);

	state.addBeam(10, 4, 14, 4);

	state.addBeam(10, 4, 12, 0);
	state.addBeam(14, 4, 12, 0);

	state.forceScale = 10;

	state.debug = true;
	state.solver = 'gradient';

	makeWhiteboard('canvas23', state);
}
</script>
<br>

It converges, but slower than the previous method.

# Least squares: underdetermined systems

We still haven't solved the problem with underdetermined systems. It would be cool if we could just minimize something by another gradient descent, and I've seen in [John D. Cook's blog](https://www.johndcook.com/blog/2018/05/06/least-squares/) that you can formulate an underdetermined least-squares problem as minimizing $$\|Ax-b\|^2 + \|x\|^2$$. It kind of makes sense at first glance: for a solution to $$Ax=b$$ the $$\|Ax-b\|^2$$ term will be zero, and we'll find a minimum-length solution by minimizing the $$\|x\|^2$$ term. The gradient changes only slightly compared to the previous section: $$2A^T (Ax-b)+2x$$, and if we try to apply it to an underdetermined system, we get

<center>
<div>
<canvas id="canvas24"></canvas>
<br>
<button type="button" onclick='resetForces("canvas24");'>Reset</button>
</div>
</center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.addBeam(0, 5, 5, 10);
	state.debug = true;
	state.solver = 'gradient';
	state.wrongUnderdetermined = true;
	makeWhiteboard('canvas24', state);
}
</script>
<br>

As you can see, the error $$\|Ax-b\|^2$$ stays positive, i.e. the method converges to something that is **not** a solution to $$Ax=b$$, even though the original problem is underdetermined and has infinitely many solutions!

When I [asked about it on twitter](https://x.com/lisyarus/status/1725997945856647505), people got confused, thinking I'm asking about some [ML-related regularization](https://en.wikipedia.org/wiki/Ridge_regression). A bit later we figured out that minimizing $$\|Ax-b\|^2+\|x\|^2$$ is **not** equivalent to solving $$Ax=b$$, but to some different equation:

<center><blockquote class="twitter-tweet" data-lang="en"><a href="https://x.com/isenbaev/status/1726018037600678064"></a></blockquote></center>

*That's what you get for relying on random blogs that don't cite sources, I guess.*

*Yes, I don't cite sources either. Oh well.*

# Least squares: the normal equations

So, I abandoned the idea of having a simple iterative solver for the underdetermined case, and instead decided to do thing *the right way*, which means solving the *normal equations* for our least-squares problem.

For the overdetermined case, minimizing $$\|Ax-b\|^2$$ explicitly leads to the formula 

\\[ x = (A^T A)^{-1} A^T b \\]

For the underdetermined case, we need to reformulate the problem as minimizing $$\|x\|^2$$ under the constraint $$Ax=b$$, which sounds different but leads to a very similar (but still different) formula

\\[ x = A^T (A A^T)^{-1} b \\]

Both these methods require inverting a matrix or, alternatively, solving a square linear system. If our system $$Ax=b$$ is square from the start, we just apply Gauss elimination to it.

This is not an iterative method, so we don't get the forces smoothly converging to a solution, but instead we get the solution instantly. Also, nor does Gauss elimination exploit the fact that our matrix $$A$$ is very sparse, --- most forces only participate in a few equations, --- and neither does it care about $$AA^T$$ or $$A^TA$$ being symmetric positive-semidefinite. To exploit these, we could do something like sparse Cholesky decomposition of $$AA^T$$ or $$A^TA$$ and then use it to perform elimination to solve our system.

So, a few sparse matrix multiplications later, I got this method to work, and it seems to be pretty good. For the overdetermined system with no solution, it computes a solution as good as the gradient descent:

<center><canvas id="canvas25"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.addBeam(7, 10, 9, 5);
	state.debug = true;
	makeWhiteboard('canvas25', state);
}
</script>
<br>

and for an underdetermined system, it tends to compute the solution which is the most symmetric and reasonable:

<center><canvas id="canvas26"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.addBeam(0, 5, 5, 10);
	state.addBeam(16, 5, 11, 10);
	state.debug = true;
	makeWhiteboard('canvas26', state);
}
</script>
<br>

In fact, all of the systems in the [examples](#examples) section were computed using this method, so I won't show too many examples here. Have a look at this majestic bridge, though:

<center><canvas id="canvas27"></canvas></center>
<script>
{
	const state = makeWhiteboardState(24, 10);
	state.topWall = false;
	state.bottomWall = false;
	state.debug = true;
	state.addBeam(0, 3, 8, 3);
	state.addBeam(8, 3, 16, 3);
	state.addBeam(16, 3, 24, 3);
	state.addBeam(0, 7, 4, 7);
	state.addBeam(4, 7, 12, 7);
	state.addBeam(12, 7, 20, 7);
	state.addBeam(20, 7, 24, 7);
	state.addBeam(0, 3, 4, 7);
	state.addBeam(4, 7, 8, 3);
	state.addBeam(8, 3, 12, 7);
	state.addBeam(12, 7, 16, 3);
	state.addBeam(16, 3, 20, 7);
	state.addBeam(20, 7, 24, 3);
	state.forceScale = 10;
	makeWhiteboard('canvas27', state);
}
</script>
<br>

By the way, if we remove a few beams from this bridge, we get a singular system --- something we couldn't detect with our previous method, but the Gauss elimination can easily report that:

<center><canvas id="canvas28"></canvas></center>
<script>
{
	const state = makeWhiteboardState(24, 10);
	state.topWall = false;
	state.bottomWall = false;
	state.debug = true;
	state.addBeam(0, 3, 8, 3);
	state.addBeam(8, 3, 16, 3);
	state.addBeam(16, 3, 24, 3);
	state.addBeam(0, 7, 4, 7);
	state.addBeam(4, 7, 12, 7);
	state.addBeam(12, 7, 20, 7);
	state.addBeam(20, 7, 24, 7);
	state.addBeam(4, 7, 8, 3);
	state.addBeam(8, 3, 12, 7);
	state.addBeam(12, 7, 16, 3);
	state.addBeam(16, 3, 20, 7);
	state.forceScale = 10;
	makeWhiteboard('canvas28', state);
}
</script>
<br>

# Stresses

If you remember the beginning of this post, I actually wanted to calculate the *stresses* on each beam, to figure out if it breaks or not. I will define *bending stress* and *contraction/stretching stress*.

Bending is how much do the forces acting on the beam, well, bend it. The more the forces in the normal direction, the higher the bending. Since we know that $$F_a\cdot n = F_b \cdot n$$, we can define either of these values as the *bending stress* $$B$$.

Now let's add $$F_a\cdot n$$ and $$F_b\cdot n$$. They are equal, thus the sum is equal to $$2B$$. However, we also have the force balance equation $$F_a+F_b+mg=0$$, leading to

\\[ 2B = (F_a+F_b)\cdot n = -mg \cdot n \\]

Thus, the amount of bending is completely determined by the gravity force and the beam's geometry (the vector $$n$$), and doesn't depend on the forces we've been trying so hard to compute. Therefore, let's pretend we're not interested in bending that much :)

Now let's look at stretching/contraction stresses. These only depend on the tangential components of the forces, i.e. the components that go parallel to the beam (as opposed to the bending depending on the components that are orthogonal to the beam). If the end force $$F_b$$ points towards the beam center and is opposite to the beam direction vector $$t$$, while the start force $$F_a$$ points again towards the beam start and is aligned with the beam direction vector $$t$$, we get *contraction*: two forces acting on the beam from both sides are trying to squeeze it.

If, however, both $$F_a$$ and $$F_b$$ point outwards, we have *stretching*: the forces are trying to stretch the beam.

We can figure out which one is the case simply by computing $$(F_b - F_a) \cdot t$$: if this number is positive, we have stretching, otherwise we get contraction.

Here I'm showing stretching/contraction using inward/outward white arrows:

<center><canvas id="canvas29"></canvas></center>
<script>
{
	const state = makeWhiteboardState(24, 16);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;

	state.addBeam(4, 16, 6, 12);
	state.addBeam(8, 16, 6, 12);
	state.addBeam(8, 16, 10, 12);
	state.addBeam(12, 16, 10, 12);
	state.addBeam(12, 16, 14, 12);
	state.addBeam(16, 16, 14, 12);
	state.addBeam(16, 16, 18, 12);
	state.addBeam(20, 16, 18, 12);

	state.addBeam(6, 12, 10, 12);
	state.addBeam(10, 12, 14, 12);
	state.addBeam(14, 12, 18, 12);

	state.addBeam(6, 12, 8, 8);
	state.addBeam(10, 12, 8, 8);
	state.addBeam(10, 12, 12, 8);
	state.addBeam(14, 12, 12, 8);
	state.addBeam(14, 12, 16, 8);
	state.addBeam(18, 12, 16, 8);

	state.addBeam(8, 8, 12, 8);
	state.addBeam(12, 8, 16, 8);

	state.addBeam(8, 8, 10, 4);
	state.addBeam(12, 8, 10, 4);
	state.addBeam(12, 8, 14, 4);
	state.addBeam(16, 8, 14, 4);

	state.addBeam(10, 4, 14, 4);

	state.addBeam(10, 4, 12, 0);
	state.addBeam(14, 4, 12, 0);

	state.forceScale = 10;
	state.display = 'stress';

	makeWhiteboard('canvas29', state);
}
</script>
<br>

# Interactive playground

Here's an interactive playground where you can try different beam configurations. Left click and drag to create beams (they automatically connect to each other via hinges if their endpoints coincide), right click to remove beams. You can select whether to show forces or stresses using the control panel below the thing, and also change the scale of the force vectors. Don't hesitate to show me some funny configurations (in twitter, mastodon, or simply be email), I'd love to see what you come up with!

<center><canvas id="canvas30"></canvas></center>
<center>
<table>
<tr>
<td width="33%"><button type="button" onclick="playgroundState.beams = [];">Clear</button></td>
<td width="33%"><select onchange="playgroundState.display=this.value;">
  <option value="forces">Show forces</option>
  <option value="stress">Show stress</option>
</select></td>
<td width="33%">Force scale: <input type="range" min="1" max="100" value="80" oninput="playgroundState.forceScale=this.value/2;"/></td>
</tr>
</table>
</center>
<script>
const playgroundState = makeWhiteboardState(36, 24);
playgroundState.debug = true;
playgroundState.interactive = true;
makeWhiteboard('canvas30', playgroundState);
</script>
<br>

# The end

So, here's our model for computing the forces in a beam. I'm not quite satisfied with it, but it seems to work in most cases. Maybe a more physically appropriate way of doing this would involve minimizing something smarter than just the sum of squared errors.

I guess what most bridge-building and similar games do is actually simulate the physics (they have dynamic physics, after all!), and look at the constraint forces that the physics engine computed. It would be interesting to see how these would differ from my naive least-squares method :)

Anyway, I hope you liked the post. I'm planning to write another one, experimenting with squares or cubes this time. Stay tuned :)

{% include end_section.html %}
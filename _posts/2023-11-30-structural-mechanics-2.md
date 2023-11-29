---
layout: post
title:  "Computing forces in a system of beams, properly"
date:   2023-10-29 18:00:00 +0300
categories: physics
mathjax: yes
steamwidgets: yes
image:
  path: /media/beams/cover2.png
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

<script async="" src="//platform.twitter.com/widgets.js" charset="utf-8"></script>

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
		'showGravity': false,
	};

	state.addBeam = (x0, y0, x1, y1) => {
		state.beams.push({
			'start': [x0, y0],
			'end': [x1, y1],
			'color': chooseColor(state.beams.length),
			'startForce': [0, 0],
			'endForce': [0, 0],
			'startMoment': 0,
			'endMoment': 0,
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

	const density = 1;
	const gravity = 0.25;

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
        		ctx.arc((x + 1) * cellSize, (y + 1) * cellSize, 1, 0, 2 * Math.PI);
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
        	ctx.arc(sx, sy, ow / 2, 0, 2 * Math.PI);
        	ctx.arc(ex, ey, ow / 2, 0, 2 * Math.PI);
        	ctx.fill();

        	ctx.lineWidth = iw;
        	ctx.strokeStyle = beam.color;
        	ctx.fillStyle = beam.color;
        	ctx.beginPath();
        	ctx.moveTo(sx, sy);
        	ctx.lineTo(ex, ey);
        	ctx.stroke();
        	ctx.beginPath();
        	ctx.arc(sx, sy, iw / 2, 0, 2 * Math.PI);
        	ctx.arc(ex, ey, iw / 2, 0, 2 * Math.PI);
        	ctx.fill();
        }

        const drawHinge = (p) => {
        	const cx = (p[0] + 1) * cellSize;
        	const cy = (p[1] + 1) * cellSize;

        	ctx.fillStyle = '#000000';
        	ctx.beginPath();
        	ctx.arc(cx, cy, owidth / 2 + 1, 0, 2 * Math.PI);
        	ctx.fill();

        	ctx.fillStyle = '#ffffff';
        	ctx.beginPath();
        	ctx.arc(cx, cy, iwidth / 2 + 1, 0, 2 * Math.PI);
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

    		if (fl * state.forceScale < 10) return;

    		for (let i = 0; i < 2; ++i)
    		{
		    	const ex = sx + tx * fl * state.forceScale;
		    	const ey = sy + ty * fl * state.forceScale;

	    		let gradient = ctx.createLinearGradient(sx, sy, ex, ey);

    			if (i == 0)
    			{
					gradient.addColorStop(0, 'rgba(0,0,0,0)');
					gradient.addColorStop(1, 'rgba(0,0,0,255)');

		    		ctx.lineWidth = 4;
		    	}
		    	else
		    	{
		    		let ccolor = toRGB(color);
					gradient.addColorStop(0, `rgba(${ccolor[0]},${ccolor[1]},${ccolor[2]},0)`);
					gradient.addColorStop(1, `rgba(${ccolor[0]},${ccolor[1]},${ccolor[2]},255)`);
		    		ctx.lineWidth = 2;	
		    	}

	    		ctx.strokeStyle = gradient;
	    		ctx.fillStyle = gradient;

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
	    		ctx.arc(ex, ey, ctx.lineWidth / 2, 0, 2 * Math.PI);
	    		ctx.fill();
	    	}
    	};

    	const drawMoment = (origin, moment, color, direction) => {
    		const sx = (origin[0] + 1) * cellSize;
    		const sy = (origin[1] + 1) * cellSize;

    		const radius = Math.abs(moment) * state.forceScale * 0.5;

    		if (radius < 10) return;

    		const ccw = (moment < 0);
    		const offset = Math.asin(10 / radius);
    		const startAngle = Math.atan2(-direction[1], -direction[0]) + (ccw ? -1 : 1) * offset;
    		const arcLength = Math.PI - 2 * offset;

    		const cx = sx + radius * direction[0];
    		const cy = sy + radius * direction[1];
    		const arcEndNormalx = Math.cos(startAngle + (ccw ? -1 : 1) * arcLength);
    		const arcEndNormaly = Math.sin(startAngle + (ccw ? -1 : 1) * arcLength);
    		const arcEndDirx = (ccw ? 1 : -1) * arcEndNormaly;
    		const arcEndDiry = (ccw ? -1 : 1) * arcEndNormalx;
    		const arcEndx = cx + radius * arcEndNormalx;
    		const arcEndy = cy + radius * arcEndNormaly;

    		const arrow = 10;
    		const narrow = 2 / 3;

    		let outlineGradient = ctx.createLinearGradient(sx, sy, sx + 2.0 * radius * direction[0], sy + 2.0 * radius * direction[1]);
			outlineGradient.addColorStop(0, 'rgba(0,0,0,0)');
			outlineGradient.addColorStop(1, 'rgba(0,0,0,255)');

			let ccolor = toRGB(color);

    		let inlineGradient = ctx.createLinearGradient(sx, sy, sx + 2.0 * radius * direction[0], sy + 2.0 * radius * direction[1]);
			inlineGradient.addColorStop(0, `rgba(${ccolor[0]},${ccolor[1]},${ccolor[2]},0)`);
			inlineGradient.addColorStop(1, `rgba(${ccolor[0]},${ccolor[1]},${ccolor[2]},255)`);

    		ctx.lineWidth = 4;
    		ctx.strokeStyle = outlineGradient;
    		ctx.fillStyle = outlineGradient;
    		ctx.beginPath();
    		ctx.arc(sx + radius * direction[0], sy + radius * direction[1], radius, startAngle, startAngle + (ccw ? -arcLength : arcLength), ccw);
    		ctx.stroke();
    		ctx.beginPath();
    		ctx.moveTo(arcEndx, arcEndy);
    		ctx.lineTo(arcEndx - arcEndDirx * arrow - arcEndNormalx * arrow * narrow, arcEndy - arcEndDiry * arrow - arcEndNormaly * arrow * narrow);
    		ctx.moveTo(arcEndx, arcEndy);
    		ctx.lineTo(arcEndx - arcEndDirx * arrow + arcEndNormalx * arrow * narrow, arcEndy - arcEndDiry * arrow + arcEndNormaly * arrow * narrow);
    		ctx.stroke();
    		ctx.beginPath();
    		ctx.arc(arcEndx, arcEndy, 2, 0, 2 * Math.PI);
    		ctx.fill();

    		ctx.lineWidth = 2;
    		ctx.strokeStyle = inlineGradient;
    		ctx.fillStyle = inlineGradient;
    		ctx.beginPath();
    		ctx.arc(sx + radius * direction[0], sy + radius * direction[1], radius, startAngle, startAngle + (ccw ? -arcLength : arcLength), ccw);
    		ctx.stroke();
    		ctx.beginPath();
    		ctx.moveTo(arcEndx, arcEndy);
    		ctx.lineTo(arcEndx - arcEndDirx * (arrow - 1) - arcEndNormalx * (arrow - 1) * narrow, arcEndy - arcEndDiry * (arrow - 1) - arcEndNormaly * (arrow - 1) * narrow);
    		ctx.moveTo(arcEndx, arcEndy);
    		ctx.lineTo(arcEndx - arcEndDirx * (arrow - 1) + arcEndNormalx * (arrow - 1) * narrow, arcEndy - arcEndDiry * (arrow - 1) + arcEndNormaly * (arrow - 1) * narrow);
    		ctx.stroke();
    		ctx.beginPath();
    		ctx.arc(arcEndx, arcEndy, 1, 0, 2 * Math.PI);
    		ctx.fill();
    	};

        for (let i in state.beams)
        {
        	const beam = state.beams[i];

        	let dx = beam.end[0] - beam.start[0];
        	let dy = beam.end[1] - beam.start[1];
        	let L = Math.sqrt(dx * dx + dy * dy);

        	if (L < 0.5) continue;

    		let tx = dx / L;
    		let ty = dy / L;

        	if (state.display == 'forces')
        	{
	        	drawForce(beam.start, beam.startForce, beam.color, 10);
	        	drawForce(beam.end, beam.endForce, beam.color, 10);
	        	drawMoment(beam.start, beam.startMoment, beam.color, [tx, ty]);
	        	drawMoment(beam.end, beam.endMoment, beam.color, [-tx, -ty]);

	        	if (state.showGravity)
	        	{
		        	const dx = beam.end[0] - beam.start[0];
		        	const dy = beam.end[1] - beam.start[1];
		        	const L = Math.sqrt(dx * dx + dy * dy);

	        		drawForce([(beam.start[0] + beam.end[0]) / 2, (beam.start[1] + beam.end[1]) / 2], [0, gravity * density * L], beam.color, 10);
	        	}
	        }
	        else if (state.display == 'stress')
	        {
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

        // Info

        if (state.debug)
        {
        	let lines = [];
        	lines.push([(state.variables > state.equations ? "Underdetermined" : state.variables < state.equations ? "Overdetermined" : "Square") + ": " + state.variables + " unknowns, " + state.equations + " equations", '#000000']);
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

        state.variables = 0;
        state.equations = 0;

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

        state.variables = 4 * state.beams.length;
		state.equations = 3 * state.beams.length + 2 * state.activeHinges;


        for (let beam of state.beams)
        {
        	const dx = beam.end[0] - beam.start[0];
        	const dy = beam.end[1] - beam.start[1];
        	const L = Math.sqrt(dx * dx + dy * dy);

        	if (L < 0.5) continue;

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

        state.variables = 4 * state.beams.length;
		state.equations = 3 * state.beams.length + 2 * state.activeHinges;

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
        	vars.push(beam.startMoment);
        	vars.push(beam.endMoment);

        	if (L < 0.5) continue;

        	matrix.push([[6 * i + 0, 1], [6 * i + 2, 1]]);
        	rhs.push(0);

        	matrix.push([[6 * i + 1, 1], [6 * i + 3, 1]]);
        	rhs.push(-state.density * state.gravity * L);

        	const tx = dx / L;
        	const ty = dy / L;

        	const nx = -ty;
        	const ny =  tx;

        	matrix.push([[6 * i + 0, -nx], [6 * i + 1, -ny], [6 * i + 2, nx], [6 * i + 3, ny], [6 * i + 4, 1], [6 * i + 5, 1]]);
        	rhs.push(0);
        }

        // Hinge force & moment

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
        	let rowm = [];
        	for (let h of state.hingeMap[i])
        	{
        		rowx.push([6 * h.index + 2 * h.side + 0, 1]);
        		rowy.push([6 * h.index + 2 * h.side + 1, 1]);
        		rowm.push([6 * h.index + 4 + h.side, 1]);
        	}

        	matrix.push(rowx);
        	rhs.push(0);
        	matrix.push(rowy);
        	rhs.push(0);
        	matrix.push(rowm);
        	rhs.push(0);
        }

        state.variables = vars.length;
		state.equations = matrix.length;

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

        	beam.startForce[0] = vars[6 * i + 0];
        	beam.startForce[1] = vars[6 * i + 1];
        	beam.endForce[0] = vars[6 * i + 2];
        	beam.endForce[1] = vars[6 * i + 3];
        	beam.startMoment = vars[6 * i + 4];
        	beam.endMoment = vars[6 * i + 5];
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

The great thing about posting stuff online is that somebody will inevitably come to tell you where you're wrong :)

In [my previous post](https://lisyarus.github.io/blog/physics/2023/10/15/structural-mechanics.html) I explored how one can compute the forces and stresses in a system of interconnected beams. There were a few things that I got a bit wrong there, so this post is an attempt to fix those things and to implement a better force computation algorithm.

**Contents:**
* TOC
{:toc}

# Terminology

First, some terminology errata:

1. What I called *hinges* are, in fact, [*fixed supports*](https://skyciv.com/docs/tutorials/beam-tutorials/types-of-supports-in-structural-analysis).

Mmm... Yep, that's it.

# Moments

Solid objects don't just move, they also *rotate*. Thankfully, I didn't forget about it in the last post, and I included the torque conservation for each beam to my system of equations to solve.

What I *did* forget about, though, is the fact that connections between objects can *produce torque without applying a force*. Imagine pushing a screwdriver perpendicularily into a wooden plank and starting to rotate it around the screwdriver axis: there is no *force* here, we're not pushing the plank in any direction. Instead, we're directly applying rotation to it.

Here's another demonstration that hints towards this. Consider a non-vertical beam glued to the ground somehow:

<center><canvas id="canvas1"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.rightWall = false;
	state.leftWall = false;
	state.forceScale = 80.0;
	state.addBeam(8, 10, 10, 5);
	makeWhiteboard('canvas1', state);
}
</script>
<br>

Clearly, the ground acts on it by a force that cancels gravity. This force also creates a [*moment*](https://en.wikipedia.org/wiki/Torque), forcing the beam to rotate (clockwise, in this case). But the beam is glued with super glue, it cannot rotate! Yet there is no other force acting on this beam.

What is acting on this beam is a *moment* at the gluing point, which cancels the moment created by the force. So, the ground acts on the beam both by a force (represented here as a straight arrow) and by a moment (represented as a circular arrow).

# Updated model

Adding these moments to our model is quite simple:

1. In addition to a force vector $$F$$ acting on each end of a beam, we have an extra moment $$M$$ (a scalar in 2D, a vector in 3D) on each end as well
2. The torque balance equation for each beam should include its moments at both ends:

\\[ F_a \times (-r) + F_b \times r + M_a + M_b = 0 \\]

3. For each connection, we need an extra equation for torque balance at this connection: the sum of all moments of all beams connected to this point must be zero

\\[ M_{a1} + M_{a2} + M_{b3} = 0 \\]

Here, $$M_{a1}$$ is the $$M_a$$ moment of the first beam conected to this point (if it is connected with the $$a$$ end and not the $$b$$ end), and so on.

# Determinacy

We've added two more scalar unknowns per each beam, and only one new equation for each beam connection. How exactly the system has changed depends on the exact topology, but it seems that typically we've nudged the system towards the *underdetermined* regime.

This is, however, exactly what I'd expect. It turns out that most complex systems are like this, -- they have more unknowns than equations, -- and they are usually called [*statically indeterminate*](https://en.wikipedia.org/wiki/Statically_indeterminate) systems in engineering.

Properly solving such systems requires either adding simplifying assumptions (a common one being that beams are, in fact, simply trusses), or adding more equations derived from the properties of the beam materials.

Though, improperly solving this system can still be done using least squares!

# A bit of graph theory

Based on my experiments, it seems that the only case when the system is exactly solvable is when the beams form a [*tree*](https://en.wikipedia.org/wiki/Tree_(graph_theory)) (i.e. no loops) and this tree is connected to the ground or walls at exactly one point. In all other cases, the system is statically indeterminate. And if the system is just flying in the air, it is overdetermined or sometimes singular, which makes sense: there's no way this system is actually at rest.

We can use a little bit of graph theory to prove what I said in the previous paragraph. Our beams naturally form a graph, wich beams themselves being the edges, and beam endpoints being the vertices. Let's assume that this graph is connected, -- otherwise there are several independent beam structures that can be analyzed separately.

* For each edge of this graph (i.e. for each beam), we have 6 scalar unknowns and 3 scalar equations.
* For each vertex of this graph, we have just 3 scalar equations.

There are a few special cases here:

* A free-floating end of a beam doesn't feel any forces or moments; however, to simplify counting, let's say it still has both a force and a moment at this free end, and also the corresponding equations that simply tell that the force and moment are both zero.
* A vertex that touches the ground/walls doesn't have corresponding equations; alternatively, is has 3 extra unknowns (the force and moment applied to the ground/walls). In any case, the equations-unknowns balance is the same.

Now, given $$E$$ edges (beams) and $$V$$ vertices (beam ends), of which $$G$$ vertices are touching the ground/walls, the total numbers are

* Unknowns: $$6E$$
* Equations: $$3E+3V-3G$$

Finally, it is a basic fact from graph theory that a connected graph is a [*tree*](https://en.wikipedia.org/wiki/Tree_(graph_theory)) if and only if $$E=V-1$$, otherwise $$E\geq V$$ and the graph is not a tree (contains cycles).

So, if our beam structure forms a tree, we substitute $$V=E+1$$ to get

* Unknowns: $$6E$$
* Equations: $$3E+3(E+1)-3G = 6E+3-3G$$

And the difference `unknowns - equations` is $$3(G-1)$$. In this case

* If $$G=0$$, i.e. the structure is floating in the air, the difference is $$-3$$, so there are 3 more equations than unknowns, and the system is overdetermined
* If $$G=1$$, i.e. the structure connects to ground/walls at exactly one point, the difference is $$0$$ and the system is square
* If $$G>1$$, the difference is positive and the system is underdetermined

If the graph is *not* a tree, we have $$V\leq E$$, so the number of equations is $$3E+3V-3G \leq 6E-3G$$, and the difference `unknowns - equations` is $$\geq 3G$$, meaning it is always either square (which happens e.g. if the system is a single beam loop floating in the air), or, more typically, underdetermined again.

<center><canvas id="canvas1.5"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.bottomWall = false;
	state.leftWall = false;
	state.rightWall = false;
	state.addBeam(5, 5, 12, 7);
	state.addBeam(5, 5, 8, 9);
	state.addBeam(12, 7, 8, 9);
	state.debug = true;
	makeWhiteboard('canvas1.5', state);
}
</script>
<br>

# Stresses

The addition of rotating moments complicates our bending stress calculation. In the previous post we've derived that the bending only depends on the beam's orientation, which is no longer the case, and we need to account for these new moments. If a beam is rotated clockwise at the left end, and counterclockwise at the right end, it is clearly being bent downwards.

<center><canvas id="canvas1.7"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.bottomWall = false;
	state.leftWall = false;
	state.rightWall = false;
	state.addBeam(2, 5, 14, 5);
	state.solver = 'none';
	state.beams[0].startMoment = 2;
	state.beams[0].endMoment = -2;
	makeWhiteboard('canvas1.7', state);
}
</script>
<br>

At to how exactly do we compute this bending now, I'll probably postpone this until the next post in this series, which is going to be about a system of connected solid cubes :)

*(I'm too lazy to figure it out right now.)*

# Examples

Here are a few interesting systems that have large enough support moments:

<center><canvas id="canvas2"></canvas></center>
<script>
{
	const state = makeWhiteboardState(16, 10);
	state.topWall = false;
	state.addBeam(0, 5, 8, 5);
	state.addBeam(8, 5, 16, 5);
	makeWhiteboard('canvas2', state);
}
</script>
<br>

<center><canvas id="canvas3"></canvas></center>
<script>
{
	const state = makeWhiteboardState(24, 10);
	state.topWall = false;
	state.addBeam(0, 5, 8, 5);
	state.addBeam(8, 5, 16, 5);
	state.addBeam(16, 5, 24, 5);
	makeWhiteboard('canvas3', state);
}
</script>
<br>

<center><canvas id="canvas3.5"></canvas></center>
<script>
{
	const state = makeWhiteboardState(24, 10);
	state.topWall = false;
	state.addBeam(0, 7, 8, 3);
	state.addBeam(8, 3, 16, 3);
	state.addBeam(16, 3, 24, 7);
	makeWhiteboard('canvas3.5', state);
}
</script>
<br>

<center><canvas id="canvas4"></canvas></center>
<script>
{
	const state = makeWhiteboardState(24, 10);
	state.bottomWall = false;
	state.leftWall = false;
	state.rightWall = false;
	state.forceScale = 30;
	state.addBeam(3, 5, 9, 5);
	state.addBeam(9, 5, 15, 5);
	state.addBeam(15, 5, 21, 5);
	state.addBeam(3, 5, 0, 0);
	state.addBeam(21, 5, 24, 0);
	state.addBeam(9, 5, 12, 8);
	state.addBeam(15, 5, 12, 8);
	makeWhiteboard('canvas4', state);
}
</script>
<br>

# Interactive playground

Here's an updated interactive playground. It shows forces acting on beams as straight arrows, and moments as curved arrows. The moment arrows show which way this moment wants to turn the beam. Thus, there are 4 arrows in total for each beam: one force and one moment at each end. Note that forces or moments that are too small are not shown here.

Left click and drag to create beams (they automatically connect to each other via ~~hinges~~ fixed supports if their endpoints coincide), right click to remove beams. You can select whether to show forces or stresses using the control panel below the thing, toggle showing the gravity force, and also change the scale of the force vectors.

<center><canvas id="canvas30"></canvas></center>
<center>
<table>
<tr>
<td width="25%"><button type="button" onclick="playgroundState.beams = [];">Clear</button></td>
<td width="25%"><input type="checkbox" id="playgroundShowGravity" onclick='playgroundState.showGravity = this.checked;'><label for="playgroundShowGravity">Show gravity</label></td>
<td width="25%"><select onchange="playgroundState.display=this.value;">
  <option value="forces">Show forces</option>
  <option value="stress">Show stress</option>
</select></td>
<td width="25%">Force scale: <input type="range" min="1" max="100" value="80" oninput="playgroundState.forceScale=this.value/2;"/></td>
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


{% include end_section.html %}
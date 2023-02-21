---
layout: post
title:  "My favourite animation trick: exponential smoothing"
date:   2023-02-17 16:00:00 +0300
categories: programming
---

<style>
table, tbody, tr, td {
    border: none!important;
    background: transparent!important;
}
</style>

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

function makeToggleState(speed)
{
    var state = {
        'mouseover': false,
        'value': false,
        'position': 0,
        'positionExp': 0,
        'positionExpBad': 0,
        'draw': [],
    };

    const dtms = 8;
    const dt = dtms / 1000;

    let update = () => {
        state.position += (state.value ? 1 : -1) * (dt * speed);
        state.position = Math.max(state.position, 0);
        state.position = Math.min(state.position, 1);

        state.positionExp += ((state.value ? 1 : 0) - state.positionExp) * (1 - Math.exp(- dt * speed * 2));
        state.positionExpBad += ((state.value ? 1 : 0) - state.positionExpBad) * (dt * speed * 2);

        if (!document.hidden)
        {
            window.requestAnimationFrame(() => {
                for (let i in state.draw)
                    state.draw[i]();
            });
        }
    };

    setInterval(update, dtms);

    return state;
}

function makeSharedToggle(state, id, interpolation)
{
    const width = 100;
    const height = 50;
    const outerRadius = 20;
    const innerRadius = 17;

    const canvas = document.getElementById(id);
    const ctx = prepareCanvas(canvas, width, height);

    canvas.onmouseenter = () => { state.mouseover = true; };
    canvas.onmouseleave = () => { state.mouseover = false; };

    canvas.onmousedown = (e) => {
        state.value = !state.value;
        e.preventDefault();
    };

    state.draw.push(() => {
        if (!isVisible(canvas)) return;

        ctx.clearRect(0, 0, width, height);

        if (state.mouseover)
            ctx.fillStyle = '#9f9fff';
        else
            ctx.fillStyle = '#7f7fff';

        ctx.fillRect(height / 2, 0, width - height, height);

        ctx.beginPath();
        ctx.arc(height / 2, height / 2, height / 2, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width - height / 2, height / 2, height / 2, 0, Math.PI * 2, true);
        ctx.fill();

        if (state.mouseover)
            ctx.fillStyle = '#3f3f5f';
        else
            ctx.fillStyle = '#1f1f3f';

        ctx.fillRect(height / 2, height / 2 - outerRadius, width - height, 2 * outerRadius);

        ctx.beginPath();
        ctx.arc(height / 2, height / 2, outerRadius, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width - height / 2, height / 2, outerRadius, 0, Math.PI * 2, true);
        ctx.fill();

        if (state.value)
        {
            if (state.mouseover)
                ctx.fillStyle = '#9fdfbf';
            else
                ctx.fillStyle = '#7fdfbf';
        }
        else
        {
            if (state.mouseover)
                ctx.fillStyle = '#9f9fff';
            else
                ctx.fillStyle = '#7f7fff';
        }

        let t = state.position;
        if (interpolation == 'none')
            t = state.value ? 1 : 0;
        else if (interpolation == 'cubic')
            t = smoothstep(t);
        else if (interpolation == 'sqrt')
        {
            if (state.value)
                t = Math.sqrt(t);
            else
                t = 1 - Math.sqrt(1 - t);
        }
        else if (interpolation == 'exp')
            t = state.positionExp;
        else if (interpolation == 'expBad')
            t = state.positionExpBad;

        ctx.beginPath();
        ctx.arc(height / 2 + t * (width - height), height / 2, innerRadius, 0, Math.PI * 2, true);
        ctx.fill();
    });
}

function makeToggle(id, interpolation, speed)
{
    return makeSharedToggle(makeToggleState(speed), id, interpolation);
}

function Map(width, height, scale)
{
    this.width = width * scale;
    this.height = height * scale;

    var grid = [];
    for (let y = 0; y < height; y++)
    {
        grid[y] = [];
        for (let x = 0; x < width; x++)
        {
            const a = Math.random() * 2 * Math.PI;
            grid[y][x] = [Math.cos(a), Math.sin(a)];
        }
    }

    this.cells = [];
    for (let y = 0; y < this.height; y++)
    {
        this.cells[y] = [];
        for (let x = 0; x < this.width; x++)
        {
            const gx = Math.floor(x / scale);
            const gy = Math.floor(y / scale);

            const g00 = grid[gx][gy];
            const g01 = grid[(gx + 1) % width][gy];
            const g10 = grid[gx][(gy + 1) % height];
            const g11 = grid[(gx + 1) % width][(gy + 1) % height];

            const tx = (x + 0.5) / scale - gx;
            const ty = (y + 0.5) / scale - gy;

            const v00 = g00[0] * tx + g00[1] * ty;
            const v01 = g01[0] * (1 - tx) + g01[1] * ty;
            const v10 = g10[0] * tx + g10[1] * (1 - ty);
            const v11 = g11[0] * (1 - tx) + g11[1] * (1 - ty);

            const sx = smoothstep(tx);
            const sy = smoothstep(ty);

            const vv = v00 * (1 - sx) * (1 - sy) + v01 * sx * (1 - sy) + v10 * (1 - sx) * sy + v11 * sx * sy;
            const v = (Math.sqrt(2) * vv + 1) / 2;

            const vmin = 0.15;
            const vmax = 0.85;
            const vs = v < vmin ? 0 : v > vmax ? 1 : smoothstep((v - vmin) / (vmax - vmin));

            this.cells[y][x] = Math.min(4, Math.floor(vs * 5));
        }
    }

    this.at = (x, y) => {
        while (x < 0) x += this.width;
        while (x >= this.width) x -= this.width;
        while (y < 0) y += this.height;
        while (y >= this.height) y -= this.height;

        return this.cells[y][x];
    };
}

var map = new Map(8, 8, 8);

function makeCameraState(interpolation, speed)
{
    var state = {
        'center': [0, 0],
        'target': [0, 0],
        'queue': [],
        'time': 0,
        'draw': [],
    };

    const dtms = 8;
    const dt = dtms / 1000;

    let update = () => {
        if (interpolation == 'none')
        {
            state.center[0] = state.target[0];
            state.center[1] = state.target[1];
        }
        else if (interpolation == 'linear-jitter')
        {
            state.center[0] += Math.sign(state.target[0] - state.center[0]) * dt * speed;
            state.center[1] += Math.sign(state.target[1] - state.center[1]) * dt * speed;
        }
        else if (interpolation == 'linear')
        {
            const maxDelta = dt * speed;

            for (let i = 0; i < 2; i++)
            {
                let delta = state.target[i] - state.center[i];
                delta = Math.min(delta,  maxDelta);
                delta = Math.max(delta, -maxDelta);
                state.center[i] += delta;
            }
        }
        else if (interpolation == 'cubic')
        {
            if (state.queue.length == 0)
                state.queue.push([state.center[0], state.center[1]]);

            const last = state.queue[state.queue.length - 1];

            if (last[0] != state.target[0] || last[1] != state.target[1])
                state.queue.push([state.target[0], state.target[1]]);

            if (state.queue.length > 1)
            {
                const cur = state.queue[0];
                const next = state.queue[1];
                const distance = Math.sqrt(Math.pow(next[0] - cur[0], 2) + Math.pow(next[1] - cur[1], 2));
                state.time += dt * speed / distance;

                const t = smoothstep(state.time);

                state.center[0] = cur[0] + (next[0] - cur[0]) * t;
                state.center[1] = cur[1] + (next[1] - cur[1]) * t;

                if (state.time >= 1)
                {
                    state.time -= 1;
                    state.queue.shift();
                }
            }
        }
        else if (interpolation == 'exp')
        {
            state.center[0] += (state.target[0] - state.center[0]) * (1 - Math.exp(- dt * speed * 2));
            state.center[1] += (state.target[1] - state.center[1]) * (1 - Math.exp(- dt * speed * 2));
        }

        if (!document.hidden)
        {
            window.requestAnimationFrame(() => {
                for (let i in state.draw)
                    state.draw[i]();
            });
        }
    };

    setInterval(update, dtms);

    return state;
}

function makeCamera(id, interpolation, speed)
{
    const cellSize = 40;
    const cornerRadius = 10;
    const cornerOffset = cellSize / 2 - cornerRadius;
    const cellsX = isMobile() ? 7 : 15;
    const cellsY = isMobile() ? 7 : 9;

    const padding = cellSize;
    const fogWidth = 10;

    const width = cellsX * cellSize + 2 * padding;
    const height = cellsY * cellSize + 2 * padding;

    const canvas = document.getElementById(id);
    const ctx = prepareCanvas(canvas, width, height);

    var leftGradient = ctx.createLinearGradient(padding, 0, padding + fogWidth, 0);
    leftGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    leftGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    var rightGradient = ctx.createLinearGradient(width - padding, 0, width - padding - fogWidth, 0);
    rightGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    rightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    var topGradient = ctx.createLinearGradient(0, padding, 0, padding + fogWidth);
    topGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    topGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    var bottomGradient = ctx.createLinearGradient(0, height - padding, 0, height - padding - fogWidth);
    bottomGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    bottomGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    var state = makeCameraState(interpolation, speed);

    state.buttons = [];

    // left
    state.buttons.push({
        'center': [padding / 2, height / 2],
        'direction': [-1, 0],
        'mouseover': false,
    });

    // right
    state.buttons.push({
        'center': [width - padding / 2, height / 2],
        'direction': [1, 0],
        'mouseover': false,
    });

    // up
    state.buttons.push({
        'center': [width / 2, padding / 2],
        'direction': [0, -1],
        'mouseover': false,
    });

    // down
    state.buttons.push({
        'center': [width / 2, height - padding / 2],
        'direction': [0, 1],
        'mouseover': false,
    });

    for (let i in state.buttons)
    {
        const dir = state.buttons[i].direction;
        state.buttons[i].size = [
            5 * cellSize - Math.abs(dir[0]) * 4.4 * cellSize,
            5 * cellSize - Math.abs(dir[1]) * 4.4 * cellSize,
        ];
    }

    canvas.onmousemove = (e) => {
        const m = [e.offsetX, e.offsetY];

        for (let i in state.buttons)
        {
            const size = state.buttons[i].size;
            const center = state.buttons[i].center;
            state.buttons[i].mouseover = Math.abs(m[0] - center[0]) < size[0] / 2 && Math.abs(m[1] - center[1]) < size[1] / 2;
        }
    };

    canvas.onmouseleave = () => {
        for (let i in state.buttons)
            state.buttons[i].mouseover = false;
    };

    canvas.onmousedown = (e) => {
        for (let i in state.buttons)
        {
            if (state.buttons[i].mouseover)
            {
                const speed = 2;
                state.target[0] += state.buttons[i].direction[0] * speed;
                state.target[1] += state.buttons[i].direction[1] * speed;
            }
        }
        e.preventDefault();
    };

    state.draw.push(() => {
        if (!isVisible(canvas)) return;

        ctx.clearRect(0, 0, width, height);

        let toScreen = (x, y) => {
            const sx = width / 2 + (x - state.center[0]) * cellSize;
            const sy = height / 2 + (y - state.center[1]) * cellSize;
            return [Math.round(sx), Math.round(sy)];
        };

        const colors = [
            '#1f1f5f',
            '#3f9fbf',
            '#ffdf9f',
            '#7fbf3f',
            '#1f7f1f',
        ];

        const cellXMin = Math.floor(state.center[0] - (cellsX - 1) / 2);
        const cellXMax = Math.floor(state.center[0] + (cellsX + 1) / 2);
        const cellYMin = Math.floor(state.center[1] - (cellsY - 1) / 2);
        const cellYMax = Math.floor(state.center[1] + (cellsY + 1) / 2);

        for (let y = cellYMin; y <= cellYMax; y++)
        {
            for (let x = cellXMin; x <= cellXMax; x++)
            {
                const v = map.at(x, y);
                const c = toScreen(x, y);
                
                ctx.fillStyle = colors[v];
                ctx.fillRect(c[0] - cellSize / 2, c[1] - cellSize / 2, cellSize, cellSize);

                for (let ty = -1; ty <= 1; ty += 2)
                {
                    for (let tx = -1; tx <= 1; tx += 2)
                    {
                        const vx = map.at(x + tx, y);
                        const vy = map.at(x, y + ty);

                        var fillCorner = false;

                        if ((vx < v) && (vy < v))
                        {
                            ctx.fillStyle = colors[Math.max(vx, vy)];
                            fillCorner = true;
                        }
                        else if ((vx > v) && (vy > v))
                        {
                            const vv = map.at(x + tx, y + ty);
                            if (vv > v)
                            {
                                ctx.fillStyle = colors[Math.min(vv, vx, vy)];
                                fillCorner = true;
                            }
                        }

                        if (fillCorner)
                            ctx.fillRect(c[0] + tx * cornerOffset, c[1] + ty * cornerOffset, tx * cornerRadius, ty * cornerRadius);
                    }
                }
                
                ctx.fillStyle = colors[v];
                for (let ty = -1; ty <= 1; ty += 2)
                {
                    for (let tx = -1; tx <= 1; tx += 2)
                    {
                        ctx.beginPath();
                        ctx.arc(c[0] + tx * cornerOffset, c[1] + ty * cornerOffset, cornerRadius, 0, Math.PI * 2, true);
                        ctx.fill();
                    }
                }
            }
        }

        ctx.fillStyle = leftGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = rightGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = topGradient;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = bottomGradient;
        ctx.fillRect(0, 0, width, height);

        for (let i in state.buttons)
        {
            const size = state.buttons[i].size;
            const dir = state.buttons[i].direction;
            const ort = [-dir[1], dir[0]];
            const center = state.buttons[i].center;
            ctx.fillStyle = state.buttons[i].mouseover ? '#bfbfbf' : '#9f9f9f';

            ctx.beginPath();
            ctx.moveTo(center[0] + dir[0] * size[0] / 2, center[1] + dir[1] * size[1] / 2);
            ctx.lineTo(center[0] - dir[0] * size[0] / 2 - ort[0] * size[0] / 2, center[1] - dir[1] * size[1] / 2 - ort[1] * size[1] / 2);
            ctx.lineTo(center[0] - dir[0] * size[0] / 2 + ort[0] * size[0] / 2, center[1] - dir[1] * size[1] / 2 + ort[1] * size[1] / 2);
            ctx.fill();
        }
    });
}

</script>

<meta name='image' property="og:image" content="{{site.url}}/blog/media/exponential_smoothing/cover.png">

There's a certain simple animation thing that I've been using almost since I've ever started doing anything related to graphics. I use it for rotating & moving the camera, for moving figures in a turn-based game, for moving UI elements, for smoothing volume changes in <a href="https://lisyarus.github.io/blog/programming/2022/10/15/audio-mixing.html">my audio lib</a>, everywhere! So I decided I'll write about it. The trick itself is nothing new, - in fact, you've probably already heard about or even used it, - but I'll also show it in some examples and explain how it works mathematically :)

# Toggle buttons

Speaking of UI, say you're making some UI component, maybe a toggle button. Something like this (click it!):

<center><canvas id="toggle-none"></canvas></center>
<script> makeToggle('toggle-none', 'none', 1); </script>
<br>

This simply computes the position of the switch as a function of its state:

{% highlight cpp %}
position.x = turned_on ? max_x : min_x;
{% endhighlight %}

This works perfectly, but feels a bit lifeless. Adding some *animation* to it would be cool! Animations are not just a fancy visual thing, they help the user understand what's going on. Instead of teleporting the toggle indicator to its new position, let's move it smoothly:

<center><canvas id="toggle-linear"></canvas></center>
<script> makeToggle('toggle-linear', 'linear', 8); </script>
<br>

The downside is that we need to run some updating animation now:

{% highlight cpp %}
position.x += (turned_on ? 1 : -1) * speed * dt;
position.x = clamp(position.x, min_x, max_x);
{% endhighlight %}

However, this still looks a bit clumsy due to having a constant speed (i.e. the position is a *linear* function of time). Let's add some <a href="https://easings.net/">easing</a> function on top of that, like the <a href="https://en.wikipedia.org/wiki/Smoothstep">classic cubic</a> `3t^2-2t^3`:

<center><canvas id="toggle-cubic"></canvas></center>
<script> makeToggle('toggle-cubic', 'cubic', 8); </script>
<br>

or a square root `sqrt(t)`:

<center><canvas id="toggle-sqrt"></canvas></center>
<script> makeToggle('toggle-sqrt', 'sqrt', 8); </script>
<br>

The difference between these may be hard to see, so let's slow down the animation by a factor of 8:

<center>
<table style="table-layout: fixed">
<tr><td><div align="right">Linear:     </div></td><td><center><canvas id="toggle-compare1-linear"></canvas></center></td><td></td></tr>
<tr><td><div align="right">Cubic:      </div></td><td><center><canvas id="toggle-compare1-cubic" ></canvas></center></td><td></td></tr>
<tr><td><div align="right">Square root:</div></td><td><center><canvas id="toggle-compare1-sqrt"  ></canvas></center></td><td></td></tr>
</table>
</center>
<script>
var state = makeToggleState(1);
makeSharedToggle(state, 'toggle-compare1-linear', 'linear');
makeSharedToggle(state, 'toggle-compare1-cubic',  'cubic' );
makeSharedToggle(state, 'toggle-compare1-sqrt',   'sqrt'  );
</script>
<br>

This time, instead of just updating the switch position, we have to keep track of some extra animation state:

{% highlight cpp %}
t += (turned_on ? 1 : -1) * speed * dt;
t = clamp(t, 0, 1);
ease = (3 * t * t - 2 * t * t * t);
position.x = lerp(min_x, max_x, ease);
{% endhighlight %}

Here, I'm using the fact that `smoothstep` is symmetric in the following sense: `1 - f(t) = f(1 - t)`, meaning the forward and backward animations can use the same code. With `sqrt` things are a bit different: we have to explicitly use a different easing function depending on the animation's direction:

{% highlight cpp %}
ease = turned_on ? sqrt(t) : 1 - sqrt(1 - t);
{% endhighlight %}

Whichever looks best is arguably a matter of taste, but of all these `sqrt` is my favourite: the switch starts moving really fast (this is because `sqrt` has infinite derivative at zero), but then slows down nicely as it reaches the destination (the cubic one is my second favourite, though). The downside of this version is that we need quite a lot of bookkeeping even in the simplest possible case of a two-state toggle button (later in the article I'll show how this becomes a nightmare in more complicated scenarios). Another downside is that it has a discontinuity: it jumps suddenly if the user clicks on it the middle of animation (try it!).

Thankfully there's a similar version which uses the minimal possible state and doesn't have the "jumping" problem:

<center><canvas id="toggle-exp"></canvas></center>
<script> makeToggle('toggle-exp', 'exp', 8); </script>
<br>

I call it *exponential smoothing* (for reasons that will become clear later). I've also heard it being called *approach*, and I'm certain it has it's own name in every engine. Here it is slowed down 8x and compared to `sqrt`:

<center>
<table style="table-layout: fixed">
<tr><td><div align="right">Square root:</div></td><td><center><canvas id="toggle-compare2-sqrt"></canvas></center></td><td></td></tr>
<tr><td><div align="right">Exponential:</div></td><td><center><canvas id="toggle-compare2-exp" ></canvas></center></td><td></td></tr>
</table>
</center>
<script>
var state = makeToggleState(1);
makeSharedToggle(state, 'toggle-compare2-sqrt', 'sqrt' );
makeSharedToggle(state, 'toggle-compare2-exp',  'exp'  );
</script>
<br>

Here's the code for the exponential version:

{% highlight cpp %}
target = (state.value ? max_x : min_x);
position.x += (target - position.x) * (1 - exp(- dt * speed));
{% endhighlight %}

Intuitively, on each frame we nudge the current position towards its *target position* (which is determind by the on/off state). However, the amount of nudging `(1 - exp(- dt * speed))` looks really weird, doesn't it? Before we see where it comes from, let's have a look at some more complicated animations.

# Camera movement

Say we have some kind of map, and a camera scrolling/moving around.

<center><canvas id="camera-none"></canvas></center>
<script> makeCamera('camera-none', 'none', 8); </script>
<br>

*Yes I've made a whole procedural map generator & renderer just for this example, and I have zero regrets.*

Again, this begs us to add some animation. Let's interpolate it with constant speed:

<center><canvas id="camera-linear-jitter"></canvas></center>
<script> makeCamera('camera-linear-jitter', 'linear-jitter', 8); </script>
<br>

Here's the code:

{% highlight cpp %}
position.x += sign(target.x - position.x) * speed * dt;
position.y += sign(target.y - position.y) * speed * dt;
{% endhighlight %}

See this jittering after the animation completes? That's because `target.x - position.x` keeps alternating between being positive and negative. Instead of `sign(delta)` we need some function that clamps the delta:

{% highlight cpp %}
float update(float & value, float target, float max_delta)
{
    float delta = target - value;
    delta = min(delta,  max_delta);
    delta = max(delta, -max_delta);
    value += delta;
}

update(position.x, target.x, speed * dt);
update(position.y, target.y, speed * dt);
{% endhighlight %}

Quite a mouthful for such a simple thing! And here's the result:

<center><canvas id="camera-linear"></canvas></center>
<script> makeCamera('camera-linear', 'linear', 8); </script>
<br>

Much better, although it's still a bit clumsy and also weird if we move the camera faster than the animation completes. We could, as before, add some easing function, like the cubic one:

<center><canvas id="camera-cubic"></canvas></center>
<script> makeCamera('camera-cubic', 'cubic', 8); </script>
<br>

although this time it gets really complicated: we have to maintain a queue of requested movement events, and animate them one by one (otherwise I have no idea how to slap the easing function here). This still looks a bit weird when moving the camera fast enough. We could just ignore user's input while the animation is active, but this is a deadly sin as it is infuriatingly frustrating from the user's perspective.

The perfect solution? Why, exponential smoothing of course! The code barely changes compared to the toggle button example:

{% highlight cpp %}
position.x += (target.x - position.x) * (1.0 - exp(- speed * dt));
position.y += (target.y - position.y) * (1.0 - exp(- speed * dt));
{% endhighlight %}

and here's how it looks like:

<center><canvas id="camera-exp"></canvas></center>
<script> makeCamera('camera-exp', 'exp', 8); </script>
<br>

Pretty nice, if you ask me! Notice how it speeds up naturally if you click fast enough.

# Under the hood

Ok, so what's up with this `1 - exp(- speed * dt)`, what on Earth is that?

Let's start with a simplified version: we have some animation, it has a current `position` and the new position `target` which it must move towards with some `speed`. To make the movement faster when the difference between `position` and `target` is large, we make the speed proportional to this difference:

{% highlight cpp %}
position += (target - position) * speed * dt;
{% endhighlight %}

Notice how it doesn't require maintaining *any* state other than the current and the target position! (`speed` is usually a constant.) It even doesn't need to keep track of time that elapsed since the start of the animation, and it adjusts automatically if the `target` suddenly changes.

Now this already works perfectly in many situations, but there's a small catch. Here's the toggle button again, with the above udpate code:

<center><canvas id="toggle-exp-bad"></canvas></center>
<script> makeToggle('toggle-exp-bad', 'expBad', 110); </script>
<br>

See the jittering? That's because I've set the `speed` value so high that `speed * dt` became larger than 1! Specifically, I used `speed = 220` and `dt = 1 / 125`.

To understand what's happening, it is useful to rewrite the code above using `lerp`:

{% highlight cpp %}
position = lerp(position, target, speed * dt);
{% endhighlight %}

You can check that this is ultimately the same formula. We can clearly see what's going on: the formula interpolates between the current value and the target value. The closer the interpolation parameter `speed * dt` to zero, the slower the interpolation. The closer it is to one, the faster the movement.

Now, what happens when `speed * dt` is larger than 1 is that the interpolation *overshoots*! The only reason it still works is that `speed * dt` is less than 2, so that the *absolute* delta between `position` and `target` still decreases with time. Here's an example with `speed * dt = 248 / 125 < 2`:

<center><canvas id="toggle-exp-bad2"></canvas></center>
<script> makeToggle('toggle-exp-bad2', 'expBad', 124); </script>
<br>

and here's one with `speed * dt = 252 / 125 > 2`:

<center><canvas id="toggle-exp-bad3"></canvas></center>
<script> makeToggle('toggle-exp-bad3', 'expBad', 126); </script>
<br>

The last one doesn't do anything useful at all.

To solve this, we could simply clamp the value by 1:

{% highlight cpp %}
position = lerp(position, target, min(1, speed * dt));
{% endhighlight %}

However, this doesn't seem like the right thing to do in all scenarios. Consider why `speed * dt` might actually happen to be so large?

One reason is that your `speed` value is too large because you want a really quick animation. However, as we've seen with the above toggle buttons, this is actually way too quick for any reasonable user -- the actual animation is impossible to notice. So, out `speed` value is usually not that high.

The other reason is that `dt` is too large. Maybe because your code runs too slow, and your framerate is dropping. Maybe because the user moved to a different tab/window and your code was sleeping, and now it got woken up with a `dt` of many seconds.

When applying such a `dt` to something like physics, you certainly want to clamp it, or subdivide into several updates, etc. With animations, however, wouldn't it be cool if everything worked perfectly even in this case? Even if your physics might lag, at least the camera & buttons would still work nicely -- as a user, I would really appreciate such care.

# Differential equations (oh no)

Ok, we want to solve the problem, but how? Here's the two-step recipe:

1. Realize that what we're doing is numerically solving a certain differential equation
2. Solve the equation symbolically and use the result directly

Time-dependent update that works for small `dt` but breaks for large `dt` is pretty typical for numerical solvers of differential equations. What equation does `position += (target - position) * speed * dt` solve? Whenever you see `A += B * dt`, this corresponds to an equation

<center><img src="https://latex.codecogs.com/png.image?\small%20\dpi{200}\frac{d}{dt}A=B"></center>

In our case, the equation is

<center><img src="https://latex.codecogs.com/png.image?\small%20\dpi{200}\frac{d}{dt}\text{position}%20=%20(\text{target%20-%20position})\cdot\text{speed}"></center>
<br>

I will die if I keep typing these formulas with all words spelled out, so let's make a few variable changes: call `x = position`, `a = target`, and `c = speed`:

<center><img src="https://latex.codecogs.com/png.image?\small%20\dpi{200}\frac{d}{dt}x%20=%20(a%20-%20x)%20\cdot%20c"></center>
<br>

Solving this needs just a few tricks:

<center><img src="https://latex.codecogs.com/png.image?\small%20\dpi{200}\frac{d}{dt}(x%20-%20a)%20=%20\frac{d}{dt}x%20=%20(a%20-%20x)%20\cdot%20c%20=%20-%20(x%20-%20a)%20\cdot%20c"></center><br>
<center><img src="https://latex.codecogs.com/png.image?\small%20\dpi{200}x%20-%20a%20=%20(x_0%20-%20a)\cdot%20\exp(-c\cdot%20t)"></center><br>
<center><img src="https://latex.codecogs.com/png.image?\small%20\dpi{200}x%20=%20a%20-%20(a%20-%20x_0)\cdot%20\exp(-c\cdot%20t)"></center><br>
<center><img src="https://latex.codecogs.com/png.image?\small%20\dpi{200}x%20=%20x_0%20+%20(a%20-%20x_0)\cdot%20(1%20-%20\exp(-c\cdot%20t)%20)"></center><br>

*Btw, a similar exponent appears in e.g. volumetric rendering for pretty similar reasons.*

It's not important to understand exactly where this all comes from. The point is that if we believe that `position += (target - position) * speed * dt` is the right formula for *small* `dt`, then the formula `position += (target - position) * (1 - exp(- speed * dt))` is the right formula to use for *any* `dt`. This is further supported by expanding the latter equation in terms of Taylor series for the exponent: `exp(x) ~ 1 + x`, so that `1 - exp(- speed * dt) ~ 1 - (1 - speed * dt) = speed * dt`, i.e. we get exactly the former equation.

The cool thing is that it doesn't care about old values: if you have your previous value <img src="https://latex.codecogs.com/png.image?\small%20\dpi{100}x_0"> and you know how much time has passed between the previous and the current iteration, you can compute the new value. (This is a direct consequence of being a first-order differential equation.)

So, the TL;DR is that `position += (target - position) * (1 - exp(- speed * dt))`  is the right formula that works for any `speed` and `dt`. Even if the product `speed * dt` is too large, `exp(- speed * dt)` handles it nicely, since `exp` of a large negative number is just something close to zero, so `1 - exp` will be close to one.

We can, as before, rewrite this using `lerp`: `position = lerp(position, target, 1 - exp(- speed * dt))` or even `position = lerp(target, position, exp(- speed * dt))`. There are many ways to rewrite this equtaion.

# Choosing the speed

Usually, we think of animation in terms of its *duration*. Like, the toggle button should move to the new place in 0.125 seconds (the actual value used in the examples in the beginning of the post), after that it stops moving. With this exponential formula, however, the animation technically takes *infinite* time to complete! `exp(- speed * time)` gets smaller with time, but it *never* equals zero, so that `position` technically *never* equals `target` (provided they were different to start with).

However, in practice we have a ton of limitations. If `position` is floating-point, it quickly reaches the precision limit, and it becomes equal to `target` in practice. If it is, say, the camera position, the user probably won't notice that the animation is still going since the delta `target - position` gets ridiculously small even before it hits floating-point precision limits.

So, what does the `speed` parameter mean, exactly? It means the following: `1 / speed` is the time in which `position` becomes closer to `target` by a factor of `e = 2.71828...` exactly. Do whatever you want with this information.

I usually set the `speed` to something in the range `5..50`. For a linear/cubic animation of a certain `speed`, I usually set the exponential version speed to be `2 * speed`, this feels about right (again, this is what was used in the examples above).

# Exponential smoothing

If you google "exponential smoothing" (or "exponential moving average"), you might find the <a href="https://en.wikipedia.org/wiki/Exponential_smoothing">wiki article</a> on something completely unrelated which, nevertheless, features some pretty similar formulas. It actually is the discrete analogue of what we were talking about in this post!

Suppose that our `dt` is always the same; also suppose that `target` changes as often as every iteration. Then, indexing the values with the iteration number, we compute something like `position[i] = (target[i] - position[i - 1]) * factor`, where `factor = 1 - exp(- speed * dt)`. In this case, one typically sets `factor` directly to some value between 0 and 1 instead of deriving it from other values (although the aforementioned wiki article <a href="https://en.wikipedia.org/wiki/Exponential_smoothing#Time_constant">does explain</a> what this `factor` actually means).

People use it in signal processing for the same reasons I do for animations: it doesn't require maintaining previous values or any other obscure state, just the current averaged value. They also use it in digital audio, where you typically have a fixed `dt` of `1 / freq` the inverse sampling frequency (e.g. `1/44100` or `1/48000`).

# Last paragraph title

I had the idea of this post for many months, glad to finally get it done :)

As usual, watch my devlogs:
<iframe width="100%" style="aspect-ratio:16/9" src="https://www.youtube.com/embed/GazsE5NDMj8" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe><br/>

try my <a href="https://lisyarus.itch.io/particle-simulator">particle simulator</a>, and thanks for reading!

<a href="https://lisyarus.itch.io/particle-simulator"><img width="100%" src="https://img.itch.zone/aW1hZ2UvMTg2MzkzNS8xMDk1MTQ2OC5wbmc=/original/CHcTAG.png"></a>
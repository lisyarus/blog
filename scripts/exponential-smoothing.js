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

        var mainColor = '#f0f';
        var bgColor = '#707';

        if (state.value)
        {
            if (state.mouseover)
            {
                mainColor = '#fb8';
                // bgColor = '#975';
                bgColor = '#555';
            }
            else
            {
                mainColor = '#fa5';
                // bgColor = '#543';
                bgColor = '#333';
            }
        }
        else
        {
            if (state.mouseover)
            {
                mainColor = '#aaa';
                bgColor = '#555';
            }
            else
            {
                mainColor = '#888';
                bgColor = '#333';
            }
        }

        ctx.fillStyle = mainColor;

        ctx.fillRect(height / 2, 0, width - height, height);

        ctx.beginPath();
        ctx.arc(height / 2, height / 2, height / 2, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width - height / 2, height / 2, height / 2, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.fillStyle = bgColor;

        ctx.fillRect(height / 2, height / 2 - outerRadius, width - height, 2 * outerRadius);

        ctx.beginPath();
        ctx.arc(height / 2, height / 2, outerRadius, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(width - height / 2, height / 2, outerRadius, 0, Math.PI * 2, true);
        ctx.fill();

        ctx.fillStyle = mainColor;

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
    leftGradient.addColorStop(0, 'rgba(238, 238, 238, 1)');
    leftGradient.addColorStop(1, 'rgba(238, 238, 238, 0)');

    var rightGradient = ctx.createLinearGradient(width - padding, 0, width - padding - fogWidth, 0);
    rightGradient.addColorStop(0, 'rgba(238, 238, 238, 1)');
    rightGradient.addColorStop(1, 'rgba(238, 238, 238, 0)');

    var topGradient = ctx.createLinearGradient(0, padding, 0, padding + fogWidth);
    topGradient.addColorStop(0, 'rgba(238, 238, 238, 1)');
    topGradient.addColorStop(1, 'rgba(238, 238, 238, 0)');

    var bottomGradient = ctx.createLinearGradient(0, height - padding, 0, height - padding - fogWidth);
    bottomGradient.addColorStop(0, 'rgba(238, 238, 238, 1)');
    bottomGradient.addColorStop(1, 'rgba(238, 238, 238, 0)');

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

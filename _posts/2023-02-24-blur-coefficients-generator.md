---
layout: post
title:  "Two-pass Gaussian blur coeffifients generator"
date:   2023-02-24 19:00:00 +0300
categories: graphics
---

<style>
.input-error{
  outline: 2px solid red;
}
</style>

Generates sample offsets and weights for a two-pass Gaussian blur GLSL shader that uses linear texture filtering to sample two weighted pixels using a single texture read.

<form>
<label for="radius">Blur radius:</label>
<input id="radius" value="5">
<br>
<label for="sigma">Blur sigma:</label>
<input id="sigma" value="3">
<br>
<label for="linear">Linear filtering:</label>
<input type="checkbox" id="linear" checked>
<br>
<label for="correction">Small sigma correction:</label>
<input type="checkbox" id="correction" checked>
</form>

<div id="warning" style="color: red"></div>

<textarea id="result" cols="80" rows="25" readonly></textarea>

<br>

<script defer>

function isNonNegativeInteger(text)
{
    return (text == "") || (!isNaN(text) && !isNaN(parseFloat(text)) && ((parseFloat(text) % 1) == 0) && ((+text) >= 0));
}

function isNonNegativeFloat(text)
{
    return (text == "") || (!isNaN(text) && !isNaN(parseFloat(text)) && ((+text) >= 0));
}

// From https://stackoverflow.com/a/469362/2315602
function setInputFilter(textbox, inputFilter, errMsg) {
  [ "input", "keydown", "keyup", "mousedown", "mouseup", "select", "contextmenu", "drop", "focusout" ].forEach(function(event) {
    textbox.addEventListener(event, function(e) {
      if (inputFilter(this.value)) {
        // Accepted value.
        if ([ "keydown", "mousedown", "focusout" ].indexOf(e.type) >= 0){
          this.classList.remove("input-error");
          this.setCustomValidity("");
        }

        this.oldValue = this.value;
        this.oldSelectionStart = this.selectionStart;
        this.oldSelectionEnd = this.selectionEnd;
      }
      else if (this.hasOwnProperty("oldValue")) {
        // Rejected value: restore the previous one.
        this.classList.add("input-error");
        this.setCustomValidity(errMsg);
        this.reportValidity();
        this.value = this.oldValue;
        this.setSelectionRange(this.oldSelectionStart, this.oldSelectionEnd);
      }
      else {
        // Rejected value: nothing to restore.
        this.value = "";
      }
    });
  });
}

var radiusInput = document.getElementById("radius");
var sigmaInput = document.getElementById("sigma");
var linearInput = document.getElementById("linear");
var correctionInput = document.getElementById("correction");
var resultTextArea = document.getElementById('result');
var warningDiv = document.getElementById('warning');

setInputFilter(radiusInput, isNonNegativeInteger, "Must be a nonnegative integer");
setInputFilter(sigmaInput, isNonNegativeFloat, "Must be a nonnegative floating-point");

// From https://hewgill.com/picomath/javascript/erf.js.html
function erf(x) {
    // constants
    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;

    // Save the sign of x
    var sign = 1;
    if (x < 0) {
        sign = -1;
    }
    x = Math.abs(x);

    // A&S formula 7.1.26
    var t = 1.0/(1.0 + p*x);
    var y = 1.0 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-x*x);

    return sign*y;
}

function update()
{
    if (radiusInput.value == "") return;
    if (sigmaInput.value == "") return;

    const radius = parseInt(radiusInput.value);
    const sigma = parseFloat(sigmaInput.value);
    const linear = linearInput.checked;
    const correction = correctionInput.checked;

    if (sigma == 0.0) return;

    var weights = [];
    let sumWeights = 0.0;
    for (let i = -radius; i <= radius; i++)
    {
        let w = 0;
        if (correction)
        {  
            w = (erf((i + 0.5) / sigma / Math.sqrt(2)) - erf((i - 0.5) / sigma / Math.sqrt(2))) / 2;
        }
        else
        {
            w = Math.exp(- i * i / sigma / sigma);
        }
        sumWeights += w;
        weights.push(w);
    }

    for (let i in weights)
        weights[i] /= sumWeights;

    var offsets = [];
    var newWeights = [];

    let hasZeros = false;

    if (linear)
    {
        for (let i = -radius; i <= radius; i += 2)
        {
            if (i == radius)
            {
                offsets.push(i);
                newWeights.push(weights[i + radius]);
            }
            else
            {
                const w0 = weights[i + radius + 0];
                const w1 = weights[i + radius + 1];

                const w = w0 + w1;
                if (w > 0)
                {
                    offsets.push(i + w1 / w);
                }
                else
                {
                    hasZeros = true;
                    offsets.push(i);
                }
                newWeights.push(w);
            }
        }
    }
    else
    {
        for (let i = -radius; i <= radius; i++)
        {
            offsets.push(i);
        }

        for (let w of weights)
            if (w == 0.0)
                hasZeros = true;

        newWeights = weights;
    }

    if (hasZeros)
        warningDiv.innerHTML = "Some weights are equal to zero; try using a smaller radius or a bigger sigma";
    else
        warningDiv.innerHTML = "<br>";

    let result = "";

    const N = newWeights.length;

    result += `const int SAMPLE_COUNT = ${N};\n\n`;

    result += `const float OFFSETS[${N}] = float[${N}](\n`;
    for (let i in offsets)
    {
        if (i > 0)
            result += ",\n";
        result += "    ";
        result += offsets[i];
    }
    result += "\n);\n\n";

    result += `const float WEIGHTS[${N}] = float[${N}](\n`;
    for (let i in newWeights)
    {
        if (i > 0)
            result += ",\n";
        result += "    ";
        result += newWeights[i];
    }
    result += "\n);\n\n";

    resultTextArea.value = result;

    const rows = result.split(/\n/).length;
    resultTextArea.rows = rows;
}

update();

radiusInput.oninput = update;
sigmaInput.oninput = update;
linearInput.oninput = update;
correctionInput.oninput = update;

</script>

# How to use it?

`OFFSETS` are offsets in pixels from the destination pixel to the input sample pixels (along the current blurring axis, i.e. horizontal or vertical).

`WEIGHTS` are the corresponding weights, i.e. how much contribution each input sample gives to the output value. They are already normalized --- their sum is 1.

Here's an example GLSL function that does the blurring:

<textarea id="example" cols="80" rows="18" readonly>
// blurDirection is:
//     vec2(1,0) for horizontal pass
//     vec2(0,1) for vertical pass
// The sourceTexture to be blurred MUST use linear filtering!
// pixelCoord is in [0..1]
vec4 blur(in sampler2D sourceTexture, vec2 blurDirection, vec2 pixelCoord)
{
    vec4 result = vec4(0.0);
    vec2 size = textureSize(sourceTexture, 0);
    for (int i = 0; i < SAMPLE_COUNT; ++i)
    {
        vec2 offset = blurDirection * OFFSETS[i] / size;
        float weight = WEIGHTS[i];
        result += texture(sourceTexture, pixelCoord + offset) * weight;
    }
    return result;
}
</textarea>

<br>

# How does it work?

A *two-dimentional Gaussian filter* uses weights in the form of <img src="https://latex.codecogs.com/png.image?\dpi{110}\exp\left(-\frac{x^2+y^2}{\sigma^2}\right)">, sampling the input texture in a <img src="https://latex.codecogs.com/png.image?\dpi{110}(2N+1)\times(2N+1)"> square (in the <img src="https://latex.codecogs.com/png.image?\dpi{110}[-N..N]\times[-N..N]"> range around the current pixel), making a total of <img src="https://latex.codecogs.com/png.image?\dpi{110}(2N+1)^2"> texture reads in a single fragment shader invocation.

A *separable* filter makes use of the observation that <img src="https://latex.codecogs.com/png.image?\dpi{110}\exp\left(-\frac{x^2+y^2}{\sigma^2}\right)=\exp\left(-\frac{x^2}{\sigma^2}\right)\cdot\exp\left(-\frac{y^2}{\sigma^2}\right)">, which means that we can blur horizontally over the range <img src="https://latex.codecogs.com/png.image?\dpi{110}[-N..N]"> around the current pixel, and then blur the result vertically to get the final blur (or blur vertically first and horizontally after that, doesn't matter). This cuts down the number of texture reads to <img src="https://latex.codecogs.com/png.image?\dpi{110}2N+1"> per pass, meaning <img src="https://latex.codecogs.com/png.image?\dpi{110}4N+2"> in total (for both the horizontal and vertical passes).

Using linear filtering for the input texture, we can further reduce the number of required texture reads. Say, we want to to read two neighbouring pixels `p[i]` and `p[i+1]` (I'm using 1D indexing because we're talking about separable blur, so all pixels read in a single shader invocation are in the same row or column) with weights <img src="https://latex.codecogs.com/png.image?\dpi{110}w_0"> and <img src="https://latex.codecogs.com/png.image?\dpi{110}w_1">. The total contribution of these two pixels is <img src="https://latex.codecogs.com/png.image?\dpi{110}w_0%20p_i%20+%20w_1%20p_{i+1}">. Rewriting it as a `lerp`, we get <img src="https://latex.codecogs.com/png.image?\dpi{110}w_0%20p_i%20+%20w_1%20p_{i+1}%20=%20(w_0%20+%20w_1)%20\text{lerp}\left(p_i,%20p_{i+1},%20\frac{w_1}{w_0+w_1}\right)">, meaning we can sample at location <img src="https://latex.codecogs.com/png.image?\dpi{110}i+\frac{w_1}{w_0+w_1}"> with a total weight of <img src="https://latex.codecogs.com/png.image?\dpi{110}w_0+w_1">, and thanks to linear filtering this will evaluate to the total contribution of two pixels, at the expense of a single texture read. This lowers the number of texture reads to <img src="https://latex.codecogs.com/png.image?\dpi{110}N+1"> per pass, meaning a total of <img src="https://latex.codecogs.com/png.image?\dpi{110}2N+2"> per the full blur.

To learn about small sigma correction, see <a href="https://bartwronski.com/2021/10/31/practical-gaussian-filter-binomial-filter-and-small-sigma-gaussians/">this post by Bart Wronski</a>.

See also <a href="http://demofox.org/gauss.html">Alan Wolfe's</a> generator which uses a *support* instead of *radius* to figure out how many samples are needed.

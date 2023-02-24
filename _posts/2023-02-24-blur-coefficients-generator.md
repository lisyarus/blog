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

Generates sample offsets and weights for a two-pass Gaussian blur shader that uses linear texture filtering to sample two weighted pixels using a single texture read.

<form>
<label for="radius">Blur radius:</label>
<input id="radius" value="5">
<br>
<label for="sigma">Blur sigma:</label>
<input id="sigma" value="3">
</form>

<textarea id="result" cols="80" rows="25" readonly></textarea>

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
var resultTextArea = document.getElementById('result');

setInputFilter(radiusInput, isNonNegativeInteger, "Must be a nonnegative integer");
setInputFilter(sigmaInput, isNonNegativeFloat, "Must be a nonnegative floating-point");

function update()
{
    if (radiusInput.value == "") return;
    if (sigmaInput.value == "") return;

    const radius = parseInt(radiusInput.value);
    const sigma = parseFloat(sigmaInput.value);

    var weights = [];
    let sumWeights = 0.0;
    for (let i = -radius; i <= radius; i++)
    {
        const w = Math.exp(- i * i / sigma / sigma);
        sumWeights += w;
        weights.push(w);
    }

    for (let i in weights)
        weights[i] /= sumWeights;

    var offsets = [];
    var newWeights = [];

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

            offsets.push(i + w1 / (w0 + w1));
            newWeights.push(w0 + w1);
        }
    }

    let result = "";

    result += `const int SAMPLE_COUNT = ${radius + 1};\n\n`;

    result += `const float OFFSETS[${radius + 1}] = float[${radius + 1}](\n`;
    for (let i in offsets)
    {
        if (i > 0)
            result += ",\n";
        result += "    ";
        result += offsets[i];
    }
    result += "\n);\n\n";

    result += `const float WEIGHTS[${radius + 1}] = float[${radius + 1}](\n`;
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

</script>

# How to use it?

<textarea id="example" cols="80" rows="17" readonly>
// blurDirection is:
//     vec2(1,0) for horizontal pass
//     vec2(0,1) for vertical pass
// The sourceTexture to be blurred MUST use linear filtering!
// pixelCoord is in [0..1]
vec4 blur(in sampler2D sourceTexture, vec2 blurDirection, vec2 pixelCoord)
{
    vec4 result = vec4(0.0);
    for (int i = 0; i < SAMPLE_COUNT; ++i)
    {
        vec2 offset = blurDirection * OFFSETS[i] / size;
        float weight = WEIGHTS[i];
        result += texture(sourceTexture, pixelCoord + offset) * weight;
    }
    return result;
}
</textarea>
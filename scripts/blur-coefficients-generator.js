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

    // resultTextArea.value = result;
    resultTextArea.innerHTML = result;

    resultTextArea.removeAttribute("data-highlighted");

    hljs.highlightAll();
}

update();

radiusInput.oninput = update;
sigmaInput.oninput = update;
linearInput.oninput = update;
correctionInput.oninput = update;
let tutorialSeriesContentsHTML = `
<ul>
    <li id="li-part-1"><a href="/blog/posts/implementing-a-tiny-cpu-rasterizer-part-1.html">Part 1: Clearing the screen</a></li>
    <li id="li-part-2"><a href="/blog/posts/implementing-a-tiny-cpu-rasterizer-part-2.html">Part 2: Drawing a triangle</a></li>
    <li id="li-part-3"><a href="/blog/posts/implementing-a-tiny-cpu-rasterizer-part-3.html">Part 3: Interpolating colors</a></li>
    <li id="li-part-4"><a href="/blog/posts/implementing-a-tiny-cpu-rasterizer-part-4.html">Part 4: Changing perspective</a></li>
    <li id="li-part-5"><a href="/blog/posts/implementing-a-tiny-cpu-rasterizer-part-5.html">Part 5: Fixing issues with 3D</a></li>
    <li id="li-part-6"><a href="/blog/posts/implementing-a-tiny-cpu-rasterizer-part-6.html">Part 6: Adding some depth</a></li>
    <li id="li-part-7">Part 7: Shedding some light <i>(work in progress)</i></li>
    <li id="li-part-8">Part 8: Texturing <i>(work in progress)</i></li>
    <li id="li-part-9">Part 9: Loading models <i>(work in progress)</i></li>
    <li id="li-part-10">Part 10: Rendering to texture <i>(work in progress)</i></li>
    <li id="li-part-11">Part 11: Shadow mapping <i>(work in progress)</i></li>
    <li id="li-part-12">Part 12: Optimization <i>(work in progress)</i></li>
</ul>
`;

let tutorialSeriesContents = document.getElementById("tutorial-series-contents");
tutorialSeriesContents.innerHTML = tutorialSeriesContentsHTML;

let currentTutorialPartLi = document.getElementById("li-part-" + tutorialSeriesContents.getAttribute("data-part"));
currentTutorialPartLi.innerHTML = "<b>" + currentTutorialPartLi.innerHTML + "</b>";

for (let element of document.querySelectorAll("code[data-filename]")) {
    let filename = element.getAttribute("data-filename");
    let url = element.getAttribute("data-url");

    element.innerHTML = '<center><a class="white-link" href="' + url + '"><tt><b>' + filename + '</b></tt></a></center><hr color=#aaa><br>' + element.innerHTML;
}
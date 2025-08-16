let rssLinkHTML = '<link rel="alternate" type="application/rss+xml" title="RSS Feed for lisyarus blog" href="/blog/feed.xml" /><span class="header-rss-link"><a href="/blog/feed.xml">RSS feed</a></span>';

let headerHTML = `
<a href="/blog" class="blog-link">lisyarus blog</a>
${rssLinkHTML}
<nav class="blog-nav">
    <ul>
        <li>
            <a href="/blog" class="header-link">Articles</a>
        </li>
        <li>
            <a href="/blog/projects.html" class="header-link">Projects</a>
        </li>
        <li>
            <a href="/blog/contacts.html" class="header-link">Contacts</a>
        </li>
        <li>
            <a href="/blog/about.html" class="header-link">About</a>
        </li>
    </ul>
</nav>
<div class="header-description">// I write stuff about math, simulation, graphics, gamedev, and programming ${rssLinkHTML}</div>
`;

let footerHTML = `
<hr class="header-separator">
<ul class="connect-list">
<li><a href="mailto:lisyarus@gmail.com" class="footer-link"><img src="/blog/assets/email.svg" class="footer-icon"></img></a></li>
<li><a href="https://www.twitter.com/lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#twitter"></use></svg></a></li>
<li><a href="https://mastodon.gamedev.place/@lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#mastodon"></use></svg></a></li>
<li><a href="https://bsky.app/profile/lisyarus.bsky.social" class="footer-link"><img src="/blog/assets/bluesky.svg" class="footer-icon"></img></a></li>
<li><a href="https://youtube.com/@lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#youtube"></use></svg></a></li>
<li><a href="https://lisyarus.itch.io" class="footer-link"><img src="/blog/assets/itchio.svg" class="footer-icon"></img></a></li>
<li><a href="https://stackoverflow.com/users/2315602/lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#stackoverflow"></use></svg></a></li>
<li><a href="https://github.com/lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#github"></use></svg></a></li>

</center>
`;

let endSectionHTML = `
<hr class="header-separator">
<p>Hey, if you like my articles, consider supporting my other work!</p>
<p>For example, watch my <a href="https://youtube.com/@lisyarus">YouTube devlogs</a>, like this one:</p>
<center><iframe src="https://www.youtube.com/embed/fymxl5Hd654" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="youtube-embed"></iframe></center>
`;


document.getElementById("blog-header").innerHTML = headerHTML;
document.getElementById("blog-footer").innerHTML = footerHTML;
if (document.getElementById("end-section"))
    document.getElementById("end-section").innerHTML = endSectionHTML;

function elementIndex(element) {
    return Array.from(element.parentNode.childNodes).indexOf(element);
}

if (document.getElementById("contents")) {
    let contents = document.getElementById("contents");
    let sections = Array.from(document.getElementsByTagName("h2"));
    let stages = Array.from(document.getElementsByTagName("h1"));

    if (stages.length == 0) {
        for (let section of sections) {
            if (section.id) {
                contents.innerHTML += '<li><a href="#' + section.id + '">' + section.innerHTML + '</a></li>'
            }
        }
    }
    else
    {
        var items = [];

        for (let section of sections) {
            if (section.id)
                items.push([elementIndex(section), section, 'section']);
        }

        for (let stage of stages) {
            if (stage.id)
                items.push([elementIndex(stage), stage, 'stage']);
        }

        items.sort(function (a, b) { return a[0] - b[0] })

        var firstStage = true;

        var contentsHTML = "";

        for (let item of items) {
            if (item[2] == 'stage') {
                if (!firstStage) {
                    contentsHTML += '</ul>'
                }
                firstStage = false;
            }
            contentsHTML += '<li><a href="#' + item[1].id + '">' + item[1].innerHTML + '</a></li>'
            if (item[2] == 'stage') {
                contentsHTML += '<ul>'
            }
        }
        contentsHTML += '</ul>'

        contents.innerHTML += contentsHTML;
    }
}

// Based on https://www.w3schools.com/howto/howto_js_image_comparison.asp
for (let leftImage of document.getElementsByClassName("image-compare-left")) {
    (leftImage => {
        let width = leftImage.offsetWidth;
        let height = leftImage.offsetHeight;

        leftImage.style.width = (width / 2) + "px";

        let slider = document.createElement("div");
        slider.setAttribute("class", "image-compare-slider");

        leftImage.parentElement.insertBefore(slider, leftImage);

        slider.style.left = (width / 2) - (slider.offsetWidth / 2) + "px";
        slider.style.height = height + "px";

        function cursorPosition(event) {
            if (event.changedTouches)
                event = event.changedTouches[0];

            let boundingRect = leftImage.getBoundingClientRect();

            return event.pageX - boundingRect.left - window.pageXOffset;
        }

        function moveSlider(x) {
            leftImage.style.width = x + "px";
            slider.style.left = leftImage.offsetWidth - (slider.offsetWidth / 2) + "px";
        }

        let mouseDown = false;

        function startDrag(event) {
            event.preventDefault();
            mouseDown = true;
        }

        function stopDrag() {
            mouseDown = false;
        }

        function drag(event) {
            if (!mouseDown)
                return;

            let x = cursorPosition(event);
            if (x < 20) x = 20;
            if (x > width - 20) x = width - 20;

            moveSlider(x);
        }

        slider.addEventListener("mousedown", startDrag);
        slider.addEventListener("touchstart", startDrag);
        window.addEventListener("mouseup", stopDrag);
        window.addEventListener("touchend", stopDrag);
        window.addEventListener("mousemove", drag);
        window.addEventListener("touchmove", drag);
    })(leftImage);
}

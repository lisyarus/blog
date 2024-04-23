let headerHTML = `
<a href="/blog" class="blog-link">lisyarus blog</a>
<span class="blog-nav">
    <a href="/blog" class="header-link">Articles</a>
    <a href="/blog/projects.html" class="header-link">Projects</a>
    <a href="/blog/contacts.html" class="header-link">Contacts</a>
    <a href="/blog/about.html" class="header-link">About</a>
</span>
<hr class="header-separator">
<div class="header-description">// I write stuff about math, simulation, graphics, gamedev, and programming</div>
<hr class="header-separator">
`;

let footerHTML = `
<hr class="header-separator">
<center>
<a href="mailto:lisyarus@gmail.com" class="footer-link"><img src="/blog/assets/email.svg" class="footer-icon"></img></a>
<a href="https://www.twitter.com/lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#twitter"></use></svg></a>
<a href="https://mastodon.gamedev.place/@lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#mastodon"></use></svg></a>
<a href="https://youtube.com/@lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#youtube"></use></svg></a>
<a href="https://lisyarus.itch.io" class="footer-link"><img src="/blog/assets/itchio.svg" class="footer-icon"></img></a>
<a href="https://stackoverflow.com/users/2315602/lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#stackoverflow"></use></svg></a>
<a href="https://github.com/lisyarus" class="footer-link"><svg class="footer-icon"><use xlink:href="/blog/assets/minima-social-icons.svg#github"></use></svg></a>
</center>
`;

let endSectionHTML = `
<hr class="header-separator">
<center><b>TODO: END SECTION</b></center>
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
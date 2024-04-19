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
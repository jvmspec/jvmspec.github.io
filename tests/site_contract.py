#!/usr/bin/env python3
"""Dependency-free structural checks for features/presentation-site.feature."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
ERRORS = []


def require(condition, message):
    if not condition:
        ERRORS.append(message)


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.text = text
        self.tags = []
        self.attrs = []
        self.ids = set()
        self.links = []
        self.images = []
        self.meta = []
        self.headings = []
        self._heading = None

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        self.tags.append(tag)
        self.attrs.append((tag, values))
        if values.get("id"):
            self.ids.add(values["id"])
        if tag == "a":
            self.links.append(values)
        if tag == "img":
            self.images.append(values)
        if tag == "meta":
            self.meta.append(values)
        if tag in {"h1", "h2", "h3"}:
            self._heading = [tag, ""]

    def handle_data(self, data):
        if self._heading:
            self._heading[1] += data

    def handle_endtag(self, tag):
        if self._heading and self._heading[0] == tag:
            self.headings.append((tag, self._heading[1].strip()))
            self._heading = None


def parse(path):
    require(path.is_file(), f"missing required file: {path.relative_to(ROOT)}")
    if not path.is_file():
        return None
    document = Document(path.read_text(encoding="utf-8"))
    document.feed(document.text)
    return document


required_files = [
    "index.html",
    "404.html",
    "assets/css/site.css",
    "assets/js/site.js",
    "assets/img/logo-mark.svg",
    "assets/img/favicon.svg",
    "assets/img/og-card.png",
    "site.webmanifest",
    "robots.txt",
    "sitemap.xml",
    ".nojekyll",
    "README.md",
]
for filename in required_files:
    require((ROOT / filename).is_file(), f"missing required file: {filename}")

index = parse(ROOT / "index.html")
not_found = parse(ROOT / "404.html")

if index:
    lower = index.text.lower()
    html_tags = [attrs for tag, attrs in index.attrs if tag == "html"]
    require(html_tags and html_tags[0].get("lang") == "en", "home page must declare lang=en")
    for landmark in ("header", "nav", "main", "footer"):
        require(landmark in index.tags, f"home page is missing <{landmark}>")
    require(sum(1 for tag, _ in index.headings if tag == "h1") == 1, "home page must contain exactly one h1")
    require(any(a.get("class", "").find("skip-link") >= 0 for a in index.links), "home page needs a skip link")
    for section_id in ("workflow", "features", "install", "ecosystem", "docs", "release"):
        require(section_id in index.ids, f"home page is missing #{section_id}")
    for phrase in (
        "spec-first bdd",
        "java 8-compatible",
        "zero runtime dependencies",
        "1.0.0-rc5",
        "io.github.jvmspec",
        "javaspec-bytecode-agent",
        "approval pending",
    ):
        require(phrase in lower, f"home page is missing truthful product token: {phrase}")
    for forbidden in (
        "published on the gradle plugin portal",
        "stable 1.0.0 is available",
        "google analytics",
        "googletagmanager",
        "fonts.googleapis.com",
    ):
        require(forbidden not in lower, f"home page contains forbidden claim/dependency: {forbidden}")
    for language in ("English", "Italiano", "Español", "Deutsch", "Français", "简体中文"):
        require(language in index.text, f"documentation link is missing language: {language}")
    descriptions = [m.get("content", "") for m in index.meta if m.get("name") == "description"]
    require(any(len(value) >= 80 for value in descriptions), "meta description must be useful")
    require(any(tag == "link" and attrs.get("rel") == "canonical" for tag, attrs in index.attrs), "canonical link is missing")
    require(any(tag == "script" and attrs.get("src") == "assets/js/site.js" and "defer" in attrs for tag, attrs in index.attrs), "deferred site script is missing")
    require(all("alt" in image for image in index.images), "every image must have an alt attribute")
    for link in index.links:
        href = link.get("href", "")
        require(bool(href), "anchor has an empty href")
        if link.get("target") == "_blank":
            rel = set(link.get("rel", "").split())
            require({"noopener", "noreferrer"}.issubset(rel), f"external link lacks safe rel: {href}")
        if href.startswith("#"):
            require(href[1:] in index.ids, f"fragment does not resolve: {href}")
        parsed = urlparse(href)
        if href and not href.startswith("#") and not parsed.scheme and not href.startswith("mailto:"):
            target = href.split("#", 1)[0].split("?", 1)[0]
            if target:
                require((ROOT / target).exists(), f"local link does not resolve: {href}")

if not_found:
    require("Page not found" in not_found.text, "404 page needs a clear title")
    require('href="./"' in not_found.text or 'href="/"' in not_found.text, "404 page needs a home link")

css_path = ROOT / "assets/css/site.css"
if css_path.is_file():
    css = css_path.read_text(encoding="utf-8")
    for token in (":focus-visible", "prefers-reduced-motion", "@media", "overflow-wrap"):
        require(token in css, f"CSS is missing accessibility/responsive token: {token}")

js_path = ROOT / "assets/js/site.js"
if js_path.is_file():
    js = js_path.read_text(encoding="utf-8")
    for token in ("navigator.clipboard", "aria-expanded", "IntersectionObserver"):
        require(token in js, f"progressive enhancement script is missing: {token}")

manifest_path = ROOT / "site.webmanifest"
if manifest_path.is_file():
    manifest = manifest_path.read_text(encoding="utf-8")
    require('"name": "JavaSpec"' in manifest, "web manifest must identify JavaSpec")

if ERRORS:
    print("SITE CONTRACT: FAIL", file=sys.stderr)
    for error in ERRORS:
        print(f" - {error}", file=sys.stderr)
    sys.exit(1)

print("SITE CONTRACT: PASS")

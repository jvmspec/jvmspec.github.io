# JavaSpec project site

Static presentation site for [JavaSpec](https://github.com/mgiustiniani/javaspec), served from the organization Pages repository at [jvmspec.github.io](https://jvmspec.github.io/).

The site is intentionally framework-light: semantic HTML, one authored stylesheet, and a small progressive-enhancement script. It has no production dependencies, analytics, cookies, trackers, remote fonts, or third-party runtime assets.

## Local preview

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Open <http://127.0.0.1:4173/>.

## Validation

The dependency-free structural contract can run anywhere Python 3 is available:

```bash
python3 tests/site_contract.py
```

For responsive Chromium validation and screenshots:

```bash
npm ci
npx playwright install chromium   # first run only
npm run validate
```

Screenshots are written to the ignored `test-results/` directory. The executable Story BDD source is [`features/presentation-site.feature`](features/presentation-site.feature).

## Content policy

Product and release claims are derived from the current JavaSpec repository and verified release evidence:

- `1.0.0-RC5` Maven artifacts are public under `io.github.jvmspec`;
- the Gradle plugin submission succeeded, but its first-publication Portal marker remains approval pending;
- stable `1.0.0` is not presented as released.

Do not infer public availability from a successful submission. Update the release ledger only after the corresponding public coordinate has been verified.

## Repository map

- `index.html` — presentation site and all critical no-JavaScript content;
- `assets/css/site.css` — responsive visual system;
- `assets/js/site.js` — navigation, tabs, copy control, and restrained reveal enhancement;
- `assets/img/` — original JavaSpec mark and social card;
- `404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest` — Pages delivery metadata;
- `tests/` and `scripts/validate-site.sh` — structural and browser validation.

## License

[MIT](LICENSE)

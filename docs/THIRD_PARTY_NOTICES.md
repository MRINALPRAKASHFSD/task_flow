# Third-Party Notices — TaskFlow

> Documentation License: Creative Commons Attribution 4.0 International (CC BY 4.0)

This file documents all third-party components, assets and specifications referenced by
or incorporated into TaskFlow, together with their license and attribution requirements.

---

## Specifications and Standards

### HTML5 and Web APIs

- **Source:** WHATWG (https://html.spec.whatwg.org/) and W3C (https://www.w3.org/)
- **License:** These are open standards; implementation is not licensed. The specification texts are © their respective authors.
- **Components used:** HTML5 Document structure, LocalStorage API, Web Crypto API (`crypto.randomUUID`), Drag and Drop API (future), CSS Custom Properties, CSS Grid, CSS Flexbox.
- **Attribution requirement:** None required for implementing the standard.

---

## Fonts

TaskFlow uses **system fonts only** via the CSS font stack:

```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

- No font files are downloaded or bundled.
- `Inter` is referenced as a system font name only. If a user has Inter installed, it is used; otherwise the OS default sans-serif is used.
- **Inter** (if installed on user's system): Licensed under the SIL Open Font License 1.1 by Rasmus Andersson. The font is not bundled in this repository.

---

## Icons

TaskFlow uses **emoji characters** rendered by the operating system or browser.
No icon font library (e.g., Font Awesome), SVG icon set or image file is used.
Emoji are part of the Unicode Standard (https://unicode.org/) and are rendered by the user's platform.

No attribution is required for using Unicode emoji.

---

## JavaScript — No Runtime Dependencies

TaskFlow has **zero npm runtime dependencies**. All application logic is original code.

---

## Development References and Inspirations

The following external resources informed design decisions but are not incorporated as code or assets:

| Resource | URL | Purpose |
|----------|-----|---------|
| Contributor Covenant 2.1 | https://www.contributor-covenant.org/version/2/1/code_of_conduct.html | Code of Conduct text (reproduced verbatim — free to use) |
| Keep a Changelog | https://keepachangelog.com/ | Changelog format reference |
| Conventional Commits | https://www.conventionalcommits.org/ | Commit message specification reference |
| Semantic Versioning | https://semver.org/ | Versioning specification reference |

---

## GitHub Actions

The following GitHub Actions are used in CI/CD workflows.
These run in GitHub's infrastructure and are not bundled into the application.

| Action | Version | License | Source |
|--------|---------|---------|--------|
| `actions/checkout` | v4 | MIT | https://github.com/actions/checkout |
| `actions/setup-node` | v4 | MIT | https://github.com/actions/setup-node |
| `github/codeql-action` | v3 | MIT | https://github.com/github/codeql-action |
| `actions/stale` | v9 | MIT | https://github.com/actions/stale |

These actions are used under their respective MIT licenses. Their use does not require
attribution in the application itself, but they are documented here for completeness.

---

## No Other Third-Party Assets

TaskFlow does not incorporate any other third-party images, videos, audio, datasets,
machine-learning models or proprietary assets. All code, markup and styles are original works
of Mrinal Prakash, released under the MIT License. All documentation is an original work
released under CC BY 4.0.

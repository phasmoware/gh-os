# GH-OS

An ARG web app showing off the simplicity of JavaScript and CSS rendering of a mock Linux-like operating system.

Live demo (GitHub Pages): Update the link after you publish, e.g. https://<username>.github.io/<repo>/

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Development](#development)
- [Deployment (GitHub Pages)](#deployment-github-pages)
- [SEO](#seo)
- [Accessibility](#accessibility)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Overview
GH-OS emulates a stylized desktop environment with a boot sequence, taskbar, start menu, and a draggable/resizable terminal window. It focuses on retro-futuristic visuals and minimalist implementation to highlight how far you can go with vanilla JavaScript, semantic HTML, and modern CSS.

## Features
- Boot sequence with live log stream
- Retro CRT visual overlays and animated wallpaper
- Taskbar with Start menu and clock
- Draggable/resizable terminal-like window
- Responsive layout with mobile optimizations
- Accessible roles/labels and keyboard focusable terminal

## Tech Stack
- HTML5
- CSS3 (modern gradients, blur, glassmorphism)
- Vanilla JavaScript (ES modules)

No build tools, frameworks, or dependencies are required.

## Getting Started
Clone the repo and open index.html in your browser.

```bash
git clone https://github.com/<username>/<repo>.git
cd <repo>
open index.html
```

If your browser blocks module imports from file://, serve locally:

```bash
# Python 3
python3 -m http.server 8080
# Node (if installed)
npx serve .
```

Then open http://localhost:8080.

## Development
- index.html: Markup and SEO meta
- styles.css: Visuals and layout
- app.js: Boot sequence, UI interactions, and terminal logic

Tip: Use a dev server with live reload while editing CSS/JS.

## Deployment (GitHub Pages)
Deploy from the main branch using GitHub Pages (root or /docs). Because this is a static site, no build step is needed.

Option A — Deploy from root:
1. Commit and push all files to main.
2. Settings → Pages → Source: Deploy from branch → Branch: main / root.
3. Save. The site will be available at https://<username>.github.io/<repo>/.

Option B — Deploy from /docs:
1. Create a docs/ folder and move index.html, styles.css, app.js, and favicon files into it.
2. Settings → Pages → Source: Deploy from branch → Branch: main / /docs.
3. Save.

If your app uses absolute URLs, consider setting a base href:
```html
<base href="/<repo>/">
```

## SEO
This project includes essential SEO you can add to index.html:
- Title and meta description
- Canonical URL
- Open Graph (OG) tags for rich sharing
- Twitter Card tags
- Favicon and app icons
- JSON-LD structured data (WebSite or SoftwareApplication)

See the head section in index.html after applying the SEO patch below. Update the canonical URL and image paths to match your repository.

## Accessibility
- Landmarks and ARIA roles (application, log, menu, menuitem)
- aria-live regions for boot and terminal streams
- Keyboard focusable elements with appropriate labels and titles
Further improvements could include:
- Skip links
- Reduced motion styles via prefers-reduced-motion
- High-contrast mode overrides

## Project Structure
```
.
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Contributing
Issues and PRs are welcome. For new features, include:
- Clear description and UI/UX rationale
- Screenshots or short clips (if visual changes)
- Accessibility considerations

## License
MIT License.

---

### SEO Patch (Apply to <head> in index.html)
Add or adapt the following (values are safe defaults):

```html
<meta name="description" content="GH-OS — An ARG web app demonstrating a mock Linux-like OS using vanilla JavaScript and CSS.">
<link rel="canonical" href="https://<username>.github.io/<repo>/">

<!-- Favicons -->
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0b0f14">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="GH-OS">
<meta property="og:description" content="An ARG web app showing off the simplicity of JavaScript and CSS rendering of a mock Linux-like operating system.">
<meta property="og:url" content="https://<username>.github.io/<repo>/">
<meta property="og:image" content="https://<username>.github.io/<repo>/og-image.png">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="GH-OS">
<meta name="twitter:description" content="An ARG web app showing off the simplicity of JavaScript and CSS rendering of a mock Linux-like operating system.">
<meta name="twitter:image" content="https://<username>.github.io/<repo>/og-image.png">

<!-- JSON-LD (SoftwareApplication) -->
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "GH-OS",
  "applicationCategory": "WebApplication",
  "operatingSystem": "Any",
  "description": "An ARG web app showing off the simplicity of JavaScript and CSS rendering of a mock linux-like operating system.",
  "author": { "@type": "Organization", "name": "GH-OS Contributors" },
  "url": "https://<username>.github.io/<repo>/"
}</script>
```

### Assets to Add
Create favicon and manifest assets at project root (paths referenced above):
- favicon.ico (multi-size)
- favicon.svg
- apple-touch-icon.png (180x180)
- site.webmanifest
- og-image.png (1200x630)

You can replace them later with custom branding.

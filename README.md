# GreenField Seeds

A responsive, single-page portfolio demo for a fictional agricultural seed shop. Semantic HTML5 and plain CSS — no JavaScript.

**Stack:** HTML5, CSS Grid/Flexbox, `clamp()`, Google Fonts (Lora + Raleway)

## Run it

Double-click `index.html`, or serve the folder:

```bash
python -m http.server 8000   # then open http://localhost:8000
```

## Files

```text
index.html    page content and structure
style.css     styling (colours live in :root)
favicon.svg   tab icon
image/        five supplied photos
```

## Features

- Sticky responsive nav with skip link and visible focus states
- Hero, three product cards, about, and contact sections
- Accessible headings, alt text, and reduced-motion support
- Mobile-first layouts that don't scroll sideways

## Customise

- **Colours:** edit the `:root` block at the top of `style.css`
- **Text:** edit `index.html` (sections are marked with comments)
- **New product:** duplicate a `<article class="product-card">` block
- **Email:** replace `demo@example.com` everywhere in `index.html`

## Before publishing

GreenField Seeds is fictional and `demo@example.com` receives no mail. The five images in `image/` were supplied without licences — confirm you can use them. No prices, yields, certifications, or testimonials are claimed.

Free to adapt for learning and portfolio use.
# seedshop-starter-demo

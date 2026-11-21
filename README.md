# GreenField Seeds

A responsive, single-page seed shop concept built with semantic HTML5 and plain CSS.

**Stack:** HTML5, CSS Grid/Flexbox, CSS custom properties, Google Fonts (Lora + Raleway). No JavaScript or build step is required.

## Run locally

Double-click `index.html`, or start a local server:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Files

```text
index.html    page content and structure
style.css     design tokens, components, and responsive styles
favicon.svg   tab icon
image/        supplied crop and landscape images
```

## Design and UX

- Editorial agricultural visual direction with forest-green, warm-cream, and muted-gold palette
- Responsive navigation, hero, crop cards, about section, and enquiry panel
- Mobile-first layouts with responsive typography and spacing
- Semantic landmarks, skip link, visible keyboard focus, and descriptive image alt text
- Reduced-motion support and no JavaScript dependency

## Customise

- **Colours and typography:** edit the `:root` tokens at the top of `style.css`
- **Content:** edit the labelled sections in `index.html`
- **Add a crop:** duplicate an `article.product-card` block and update its image, copy, and mailto subject
- **Contact email:** replace `demo@example.com` throughout `index.html` with a real, monitored address

## Before publishing

Confirm the business name, product details, inventory, pricing, regional suitability, and contact information. The email address is a placeholder. The images in `image/` were supplied without licence information; confirm usage rights before publishing.

This repository is a starter/demo template, not a verified seed catalogue.

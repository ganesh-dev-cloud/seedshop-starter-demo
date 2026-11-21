# Seedshop backend (not deployed)

## API key protection
`ADMIN_API_KEY` must only be set in the backend's private environment (`.env` locally or a hosting secret manager). Never add it to frontend code, GitHub Pages, commits, screenshots, or customer requests. The tracked `.env.example` is only a dummy placeholder. `.env`, `data/`, and SQLite files are gitignored. CORS is not authentication; admin routes validate the key on the server. Keep the key secret and rotate it if exposed.


This backend is scaffolding for local development. It is **not live**, is not deployed, and is not connected to the GitHub Pages storefront.

## Run locally
- Node.js 20+
- Copy .env.example to .env and set ADMIN_API_KEY to a long random secret
- Run npm install, then npm start

Local API: http://localhost:4000

## Endpoints
- GET /api/health
- GET /api/products
- GET /api/products/:id
- POST /api/orders
- GET /api/admin/products (x-admin-key)
- PUT /api/admin/products/:id (x-admin-key)
- GET /api/admin/orders (x-admin-key)
- PATCH /api/admin/orders/:id/status (x-admin-key)

## Data notes
Seed products start with price and stock unset (null). Configure price in paise and stock via the authenticated product endpoint before accepting orders. An example ₹250.00 price would be pricePaise=25000 (example only, not an actual price).

Orders are stored in SQLite. Inventory decrement and order creation are transactional. Payment processing is not included.

## Before production deployment
Add secure admin authentication, rate limiting, request validation, audit logs, backups, HTTPS/deployment config, payment provider integration, delivery/returns policies, and production security review. Keep admin secrets out of frontend code.

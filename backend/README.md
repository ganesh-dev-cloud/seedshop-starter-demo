# Seedshop backend (not deployed)

## Current status
This backend is development scaffolding. It is **not deployed** and is **not connected** to the GitHub Pages storefront. The frontend still uses its static fallback catalog. No real prices or stock are configured, and payment processing is not implemented.

## API key protection
`ADMIN_API_KEY` must only be set in the backend's private environment (`.env` locally or a hosting secret manager). Never add it to frontend code, GitHub Pages, commits, screenshots, or customer requests. The tracked `.env.example` is only a dummy placeholder. `.env`, `data/`, and SQLite files are gitignored. CORS is not authentication; admin routes validate the key on the server. Keep the key secret and rotate it if exposed.

## Run locally
- Node.js 20+
- Copy `.env.example` to `.env` and set `ADMIN_API_KEY` to a long random secret
- Run `npm install`, then `npm start`

Local API: http://localhost:4000

## Tests
Run backend integration tests with:

```sh
npm test
```

Tests cover invalid product configuration, malformed orders, missing price, order inventory deduction and cancellation restoration, invalid status transitions, concurrent order stock protection, and order rate limiting. CI runs these on pushes to `main`, pull requests, and manual workflow dispatch.

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
Seed products start with price and stock unset (`null`). Configure price in paise and stock via the authenticated product endpoint before accepting orders. An example ₹250.00 price would be `pricePaise=25000` (example only, not an actual price).

Orders are stored in SQLite. Inventory decrement and order creation are transactional. Payment processing is not included.

## Production deployment blockers
Do **not** deploy this backend for live customer orders until all of these are completed and verified:

- [ ] Choose a host that supports persistent disk storage; SQLite data must survive redeploy/restart. Confirm backups and restore procedures.
- [ ] Set a strong, private `ADMIN_API_KEY` in host secrets and confirm it is never exposed to the browser.
- [ ] Configure `CORS_ORIGIN` to only the exact storefront origin(s); remove local origins from production.
- [ ] Set production environment and HTTPS; verify health and error behavior externally.
- [ ] Run automated tests in CI and verify the workflow result is green.
- [ ] Verify admin authentication, rate limiting, validation, and logs in the deployed environment.
- [ ] Add payment provider integration and verify webhook signature/idempotency before claiming payment is supported.
- [ ] Add order confirmation/contact, delivery, refund/return, privacy, and terms policies.
- [ ] Perform real-device mobile checkout tests, database concurrency tests, security review, and backup restore test.

The current in-memory rate limiter resets on process restart and is not distributed. It is only basic abuse protection, not a production gateway/WAF. Do not treat the checklist as proof of deployment or readiness.

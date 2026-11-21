import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ADMIN_KEY = 'test-admin-secret';
let server, baseUrl, tempDir;
const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function reservePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Server exited before readiness');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server did not become ready in time');
}

before(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'seedshop-test-'));
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['src/server.js'], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(port), DATABASE_PATH: path.join(tempDir, 'test.sqlite'), ADMIN_API_KEY: ADMIN_KEY, CORS_ORIGIN: 'http://localhost:5173' },
    stdio: 'ignore'
  });
  await waitForServer(`${baseUrl}/api/health`, server);
});

after(async () => {
  if (server) {
    server.kill('SIGTERM');
    await new Promise(resolve => server.once('exit', resolve));
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

async function request(endpoint, options = {}) {
  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) }
  });
}
async function admin(endpoint, options = {}) {
  return request(endpoint, { ...options, headers: { 'x-admin-key': ADMIN_KEY, ...(options.headers || {}) } });
}
async function configurePaddy({ pricePaise = 25000, stock = 5 } = {}) {
  const response = await admin('/api/admin/products/paddy', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Paddy / Rice', category: 'grain', description: 'Test product', image: 'image/paddy-rice-328.jpg', pricePaise, stock, active: true })
  });
  assert.equal(response.status, 200);
}
async function placeOrder(quantity, productId = 'paddy') {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify({ customerName: 'Test Customer', phone: '0000000000', address: 'Test address', items: [{ productId, quantity }] })
  });
}
async function paddyStock() {
  const response = await admin('/api/admin/products');
  const products = await response.json();
  return products.find(p => p.id === 'paddy')?.stock;
}

test('admin rejects invalid product data and accepts valid configuration', async () => {
  const bad = await admin('/api/admin/products/paddy', { method: 'PUT', body: JSON.stringify({ name: 'Paddy', category: 'grain', description: '', image: 'https://bad.example/img.jpg', pricePaise: -1, stock: -2, active: true }) });
  assert.equal(bad.status, 400);
  await configurePaddy();
  assert.equal(await paddyStock(), 5);
});

test('order API rejects malformed cart and unknown products', async () => {
  const malformed = await request('/api/orders', { method: 'POST', body: JSON.stringify({ customerName: 'A', phone: '1', address: 'x', items: [{ productId: 'paddy', quantity: 0 }] }) });
  assert.equal(malformed.status, 400);
  const missing = await request('/api/orders', { method: 'POST', body: JSON.stringify({ customerName: 'A', phone: '1', address: 'x', items: [{ productId: 'missing', quantity: 1 }] }) });
  assert.equal(missing.status, 400);
});

test('order refuses unconfigured price', async () => {
  const reset = await admin('/api/admin/products/paddy', { method: 'PUT', body: JSON.stringify({ name: 'Paddy / Rice', category: 'grain', description: 'Test', image: 'image/paddy-rice-328.jpg', pricePaise: null, stock: 5, active: true }) });
  assert.equal(reset.status, 200);
  const response = await placeOrder(1);
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /price not configured/i);
  await configurePaddy();
});

test('successful order deducts inventory and cancellation restores it once', async () => {
  const order = await placeOrder(2);
  assert.equal(order.status, 201);
  const body = await order.json();
  assert.equal(body.status, 'pending');
  assert.equal(await paddyStock(), 3);

  const cancel = await admin(`/api/admin/orders/${body.orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
  assert.equal(cancel.status, 200);
  assert.equal(await paddyStock(), 5);

  const reopen = await admin(`/api/admin/orders/${body.orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'confirmed' }) });
  assert.equal(reopen.status, 409);
  assert.equal(await paddyStock(), 5);
});

test('invalid order status transitions are rejected', async () => {
  const order = await placeOrder(1);
  assert.equal(order.status, 201);
  const { orderId } = await order.json();
  const invalid = await admin(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'shipped' }) });
  assert.equal(invalid.status, 409);
  const confirm = await admin(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'confirmed' }) });
  assert.equal(confirm.status, 200);
  const pack = await admin(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'packed' }) });
  assert.equal(pack.status, 200);
  const ship = await admin(`/api/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'shipped' }) });
  assert.equal(ship.status, 200);
});

test('concurrent orders cannot oversell stock', async () => {
  await configurePaddy({ stock: 5 });
  const responses = await Promise.all([placeOrder(4), placeOrder(4)]);
  assert.equal(responses.filter(r => r.status === 201).length, 1);
  assert.equal(responses.filter(r => r.status === 409).length, 1);
  assert.equal(await paddyStock(), 1);
});

test('order endpoint rate limit returns 429 with Retry-After', async () => {
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    const response = await request('/api/orders', { method: 'POST', body: JSON.stringify({}) });
    statuses.push(response.status);
    if (response.status === 429) {
      assert.ok(Number(response.headers.get('retry-after')) >= 1);
      break;
    }
  }
  assert.ok(statuses.includes(429), `Expected rate limit to be hit, got: ${statuses.join(', ')}`);
});

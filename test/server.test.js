import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { createAzimuttCheck } from '../src/azimutt.js';
import { platformInfo } from '../src/platform.js';

let server, base, azimuttUp = true;
const fakeCheck = async () => (azimuttUp
  ? { ok: true, url: 'https://azimutt.app', http: 200, version: '2.1.19', database: true, ms: 12, checkedAt: new Date().toISOString() }
  : { ok: false, url: 'https://azimutt.app', http: null, error: 'unreachable', ms: 4000, checkedAt: new Date().toISOString() });

before(async () => {
  server = createApp({ checkAzimutt: fakeCheck, env: { CC_APP_NAME: 'demo-azimutt', CC_COMMIT_ID: '0123456789abcdef', MYSQL_ADDON_PASSWORD: 'must-never-show', SECRET_TOKEN: 'nope' } });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test('GET / renders the map room with a strict CSP', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
  const html = await res.text();
  assert.match(html, /<h1 class="intro__title">The Map Room<\/h1>/);
  assert.match(html, /chart--wide/);
  assert.match(html, /chart--tall/);
  assert.match(html, /id="map-data"/);
  assert.doesNotMatch(html, /<script>(?!<\/script>)/); // no inline script, only JSON data and the external file
});

test('the platform panel shows the allowed variables only, the commit shortened', async () => {
  const html = await (await fetch(`${base}/`)).text();
  assert.match(html, /demo-azimutt/);
  assert.match(html, />0123456</);
  assert.doesNotMatch(html, /0123456789abcdef|must-never-show|SECRET_TOKEN|nope/);
  assert.deepEqual(platformInfo({}).map((p) => p.name), ['CC_APP_NAME', 'APP_ID', 'INSTANCE_NUMBER', 'INSTANCE_TYPE', 'CC_PRETTY_INSTANCE_NAME', 'CC_COMMIT_ID', 'CC_DEPLOYMENT_ID']);
});

test('GET /health answers without any check', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /health/deep reports the Azimutt service: 200 when up, 503 when not', async () => {
  azimuttUp = true;
  let res = await fetch(`${base}/health/deep`);
  assert.equal(res.status, 200);
  let body = await res.json();
  assert.equal(body.azimutt.version, '2.1.19');
  assert.equal(body.chart.table, 'specimens');
  azimuttUp = false;
  res = await fetch(`${base}/health/deep`);
  assert.equal(res.status, 503);
  body = await res.json();
  assert.equal(body.status, 'degraded');
});

test('static files, the chart case and the 404', async () => {
  for (const [path, type] of [['/cc-brand.css', 'text/css'], ['/maproom.js', 'text/javascript'], ['/azimutt/herbarium.aml', 'text/plain'], ['/survey.json', 'application/json']]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), new RegExp(type), path);
  }
  assert.equal((await fetch(`${base}/../server.js`)).status, 404);
  assert.equal((await fetch(`${base}/nope`)).status, 404);
  assert.equal((await fetch(`${base}/`, { method: 'POST' })).status, 405);
});

test('the Azimutt check caches its answer and turns failures into a degraded result', async () => {
  let calls = 0, t = 1000;
  const check = createAzimuttCheck({ now: () => t, fetchImpl: async () => { calls++; return { ok: true, status: 200, json: async () => ({ database: true, version: '2.1.19' }) }; } });
  assert.equal((await check()).ok, true);
  await check();
  assert.equal(calls, 1);
  t += 31_000;
  await check();
  assert.equal(calls, 2);
  const down = createAzimuttCheck({ fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  const r = await down();
  assert.equal(r.ok, false);
  assert.equal(r.error, 'unreachable');
});

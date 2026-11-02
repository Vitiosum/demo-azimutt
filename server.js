// The Map Room: a companion page for the Azimutt add-on. Standard library only.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createAzimuttCheck } from './src/azimutt.js';
import { buildView } from './src/view.js';
import { renderPage } from './src/page.js';
import { platformInfo } from './src/platform.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const STATIC = {
  '/cc-brand.css': ['public/cc-brand.css', 'text/css; charset=utf-8'],
  '/maproom.css': ['public/maproom.css', 'text/css; charset=utf-8'],
  '/maproom.js': ['public/maproom.js', 'text/javascript; charset=utf-8'],
  '/azimutt/herbarium.aml': ['azimutt/herbarium.aml', 'text/plain; charset=utf-8'],
  '/azimutt/notes.md': ['azimutt/notes.md', 'text/plain; charset=utf-8'],
  '/azimutt/layouts.md': ['azimutt/layouts.md', 'text/plain; charset=utf-8'],
  '/survey.json': ['survey/herbarium.json', 'application/json; charset=utf-8'],
};

const SECURITY_HEADERS = {
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};

export function createApp({ checkAzimutt = createAzimuttCheck(), env = process.env } = {}) {
  const survey = JSON.parse(read('survey/herbarium.json'));
  const aml = read('azimutt/herbarium.aml');
  const view = buildView(survey, aml);
  const logoSvg = read('public/cc-logo.svg').trim();
  const badgeSvg = read('public/cc-badge.svg').trim().replace('class="cc-cert__badge"', 'class="academy__badge"');
  const files = Object.fromEntries(Object.entries(STATIC).map(([route, [path, type]]) => [route, { body: read(path), type }]));
  // Asset URLs carry a content hash, so a new deploy is never hidden by a cached stylesheet or script.
  const assetVersion = createHash('sha256').update(Object.values(files).map((f) => f.body).join('')).digest('hex').slice(0, 10);

  const send = (res, status, type, body, extra = {}) => {
    res.writeHead(status, { 'content-type': type, ...SECURITY_HEADERS, ...extra });
    res.end(body);
  };
  const json = (res, status, obj) => send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj), { 'cache-control': 'no-store' });

  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed\n', { allow: 'GET, HEAD' });

    if (pathname === '/') {
      const html = renderPage({ survey, view, platform: platformInfo(env), logoSvg, badgeSvg, assetVersion });
      return send(res, 200, 'text/html; charset=utf-8', html, { 'cache-control': 'no-cache' });
    }
    if (pathname === '/health') return json(res, 200, { status: 'ok' });
    if (pathname === '/health/deep') {
      const azimutt = await checkAzimutt();
      const table = survey.tables[0];
      return json(res, azimutt.ok ? 200 : 503, {
        status: azimutt.ok ? 'ok' : 'degraded',
        azimutt,
        chart: { surveyedAt: survey.surveyedAt, engine: `${survey.engine} ${survey.version}`, table: table.name, rows: table.rows, columns: table.columns.length },
      });
    }
    const file = files[pathname];
    if (file) return send(res, 200, file.type, file.body, { 'cache-control': 'public, max-age=300' });
    return send(res, 404, 'text/plain; charset=utf-8', 'Not found: this place is not on the chart.\n');
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT) || 8080;
  const server = createApp().listen(port, '0.0.0.0', () => console.log(`map room open on 0.0.0.0:${port}`));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
}

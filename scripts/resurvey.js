// Resurvey a Clever Cloud MySQL add-on from your laptop, without a credential ever on screen:
//
//   npm run resurvey -- <mysql-addon-id>
//
// 1. reads the add-on's variables with clever-tools (kept in memory, never printed);
// 2. fetches the add-on's auto-generated MySQL CA certificate (trust on first use: the
//    certificate names no host, so the survey then checks the server against this CA);
// 3. runs scripts/survey.js with MYSQL_ADDON_URI and SURVEY_TLS_CA, read-only.
// Then review survey/herbarium.json, commit it, and `clever deploy`.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const addonId = process.argv[2];
if (!/^addon_[0-9a-f-]{36}$/.test(addonId || '')) {
  console.error('usage: npm run resurvey -- <mysql-addon-id>   (addon_…, see `clever addon list`)');
  process.exit(2);
}

const env = JSON.parse(execFileSync('clever', ['addon', 'env', addonId, '--format', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
for (const name of ['MYSQL_ADDON_URI', 'MYSQL_ADDON_HOST', 'MYSQL_ADDON_PORT']) {
  if (!env[name]) { console.error(`resurvey: ${name} is missing on this add-on`); process.exit(1); }
}

const hello = spawnSync('openssl', ['s_client', '-starttls', 'mysql', '-connect', `${env.MYSQL_ADDON_HOST}:${env.MYSQL_ADDON_PORT}`, '-showcerts'], { input: '', encoding: 'utf8', timeout: 20000 });
const chain = (hello.stdout || '').match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
if (chain.length < 2) { console.error('resurvey: could not read the server certificate chain'); process.exit(1); }

const dir = mkdtempSync(join(tmpdir(), 'map-room-'));
const caFile = join(dir, 'mysql-ca.pem');
writeFileSync(caFile, chain.at(-1) + '\n'); // the last certificate of the chain is the self-signed CA
try {
  const run = spawnSync(process.execPath, [new URL('./survey.js', import.meta.url).pathname], {
    stdio: 'inherit',
    env: { ...process.env, MYSQL_ADDON_URI: env.MYSQL_ADDON_URI, SURVEY_TLS_CA: caFile },
  });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

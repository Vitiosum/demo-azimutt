// Checks the Azimutt service the add-on opens (azimutt.app). The add-on injects no variable,
// so this is the reachable part of the add-on from the app: its public health route.
export const AZIMUTT_URL = 'https://azimutt.app';
const TTL_MS = 30_000;

export function createAzimuttCheck({ fetchImpl = fetch, baseUrl = AZIMUTT_URL, now = Date.now } = {}) {
  let cached = null;
  return async function check() {
    if (cached && now() - cached.at < TTL_MS) return cached.result;
    const t0 = now();
    let result;
    try {
      const res = await fetchImpl(`${baseUrl}/health`, { signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' } });
      const body = res.ok ? await res.json().catch(() => ({})) : {};
      const ok = res.ok && body.database === true;
      result = { ok, url: baseUrl, http: res.status, version: body.version || null, database: body.database ?? null, ms: now() - t0, checkedAt: new Date().toISOString() };
    } catch (err) {
      result = { ok: false, url: baseUrl, http: null, error: err.name === 'TimeoutError' ? 'timeout' : 'unreachable', ms: now() - t0, checkedAt: new Date().toISOString() };
    }
    cached = { at: now(), result };
    return result;
  };
}

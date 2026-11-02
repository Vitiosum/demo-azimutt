// Draws the survey as a nautical chart (inline SVG, built on the server).
// One table is an island. Each column is a place on its coast, clockwise from north in ordinal order.
// Symbols: the column type. Dashed coast: the column accepts NULL. Lighthouse: the column is indexed.
// Sounding (italic figure): distinct values. Regions inside: the most common values of a column.
import { esc } from './html.js';

export const LAYOUTS = {
  wide: {
    w: 1200, h: 780, cx: 642, cy: 412, rx: 262, ry: 172,
    cartouche: { x: 46, y: 46, w: 340, h: 172 },
    compass: { x: 1066, y: 152, r: 90 },
    caution: { x: 46, y: 590, w: 300 },
    scale: { x: 46, y: 712, w: 300 },
    cellar: { x: 868, y: 600, w: 300 },
  },
  tall: {
    w: 600, h: 1190, cx: 300, cy: 616, rx: 100, ry: 246,
    cartouche: { x: 30, y: 30, w: 540, h: 150 },
    compass: { x: 90, y: 246, r: 52 },
    caution: { x: 30, y: 982, w: 250 },
    scale: { x: 30, y: 1148, w: 240 },
    cellar: { x: 322, y: 982, w: 250, down: true },
  },
};

const TAU = Math.PI * 2;
const rad = (deg) => (deg * Math.PI) / 180;
const f = (n) => Math.round(n * 10) / 10;

// A deterministic coastline: an ellipse with a few harmonics, so the island never changes between renders.
export function coastFactor(theta) {
  return 1 + 0.07 * Math.sin(3 * theta + 1.3) + 0.045 * Math.sin(5 * theta + 0.4) + 0.025 * Math.sin(9 * theta + 2.1) + 0.012 * Math.sin(17 * theta + 0.7);
}

function coastPoint(L, theta, scale = 1, pad = 0) {
  const k = coastFactor(theta) * scale;
  return [L.cx + (L.rx * k + pad) * Math.cos(theta), L.cy + (L.ry * k + pad) * Math.sin(theta)];
}

function ring(L, scale, pad = 0, steps = 240) {
  const pts = [];
  for (let i = 0; i < steps; i++) pts.push(coastPoint(L, (i / steps) * TAU, scale, pad));
  return 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';
}

function arc(L, from, to, steps = 40) {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(coastPoint(L, from + ((to - from) * i) / steps));
  return 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
}

// Outward direction at a coast point (the ellipse normal), unit length.
function normal(L, theta) {
  const nx = Math.cos(theta) / L.rx, ny = Math.sin(theta) / L.ry;
  const len = Math.hypot(nx, ny);
  return [nx / len, ny / len];
}

// Clockwise direction along the coast at a point, unit length.
function tangent(L, theta) {
  const tx = -L.rx * Math.sin(theta), ty = L.ry * Math.cos(theta);
  const len = Math.hypot(tx, ty);
  return [tx / len, ty / len];
}

export function typeFamily(dataType) {
  if (['int', 'bigint', 'smallint', 'tinyint', 'mediumint', 'decimal', 'float', 'double'].includes(dataType)) return 'number';
  if (['date', 'datetime', 'timestamp', 'time', 'year'].includes(dataType)) return 'time';
  if (['text', 'mediumtext', 'longtext', 'json', 'blob'].includes(dataType)) return 'longtext';
  return 'text';
}

export function symbol(kind, x, y) {
  switch (kind) {
    case 'number': return `<rect class="sym sym--fill" x="${f(x - 4)}" y="${f(y - 4)}" width="8" height="8"/>`;
    case 'time': return `<path class="sym" d="M${f(x)} ${f(y - 6)}L${f(x + 5.5)} ${f(y + 4)}L${f(x - 5.5)} ${f(y + 4)}Z"/><circle class="sym--dot" cx="${f(x)}" cy="${f(y + 0.6)}" r="1.4"/>`;
    case 'longtext': return `<rect class="sym" x="${f(x - 4.5)}" y="${f(y - 4.5)}" width="9" height="9"/><path class="sym" d="M${f(x - 4.5)} ${f(y + 1.5)}L${f(x + 1.5)} ${f(y - 4.5)}M${f(x - 1.5)} ${f(y + 4.5)}L${f(x + 4.5)} ${f(y - 1.5)}"/>`;
    default: return `<circle class="sym" cx="${f(x)}" cy="${f(y)}" r="5"/><circle class="sym--dot" cx="${f(x)}" cy="${f(y)}" r="1.6"/>`;
  }
}

// A magenta light flare, the chart symbol for a lighthouse: here, an index.
function flare(x, y, angleDeg, unique) {
  return `<g class="light${unique ? ' light--unique' : ''}" transform="translate(${f(x)} ${f(y)}) rotate(${f(angleDeg)})">` +
    `<path class="light__flare" d="M0 0C6 -5 20 -6 30 0C20 6 6 5 0 0Z"/>` +
    `<path class="light__star" d="M0 -4.6L1.3 -1.3L4.6 0L1.3 1.3L0 4.6L-1.3 1.3L-4.6 0L-1.3 -1.3Z"/></g>`;
}

function border(L) {
  const o = 14, i = 23, parts = [`<rect class="border" x="${o}" y="${o}" width="${L.w - 2 * o}" height="${L.h - 2 * o}"/>`, `<rect class="border" x="${i}" y="${i}" width="${L.w - 2 * i}" height="${L.h - 2 * i}"/>`];
  const seg = 30;
  for (let x = i, n = 0; x < L.w - i; x += seg, n++) {
    if (n % 2) continue;
    const w = Math.min(seg, L.w - i - x);
    parts.push(`<rect class="border__tick" x="${x}" y="${o}" width="${w}" height="${i - o}"/>`, `<rect class="border__tick" x="${x}" y="${L.h - i}" width="${w}" height="${i - o}"/>`);
  }
  for (let y = i, n = 0; y < L.h - i; y += seg, n++) {
    if (n % 2) continue;
    const h = Math.min(seg, L.h - i - y);
    parts.push(`<rect class="border__tick" x="${o}" y="${y}" width="${i - o}" height="${h}"/>`, `<rect class="border__tick" x="${L.w - i}" y="${y}" width="${i - o}" height="${h}"/>`);
  }
  return parts.join('');
}

function compass({ x, y, r }) {
  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const long = d % 30 === 0 ? 9 : d % 10 === 0 ? 6 : 3.5;
    const a = rad(d - 90);
    ticks.push(`M${f(x + r * Math.cos(a))} ${f(y + r * Math.sin(a))}L${f(x + (r - long) * Math.cos(a))} ${f(y + (r - long) * Math.sin(a))}`);
  }
  const inner = r - 22;
  for (let d = 0; d < 360; d += 10) {
    const a = rad(d - 90);
    ticks.push(`M${f(x + inner * Math.cos(a))} ${f(y + inner * Math.sin(a))}L${f(x + (inner - (d % 30 ? 3 : 6)) * Math.cos(a))} ${f(y + (inner - (d % 30 ? 3 : 6)) * Math.sin(a))}`);
  }
  const labels = [];
  for (let d = 0; d < 360; d += 30) {
    const a = rad(d - 90), lr = r - 15;
    labels.push(`<text class="compass__deg" x="${f(x + lr * Math.cos(a))}" y="${f(y + lr * Math.sin(a) + 3)}" transform="rotate(${d} ${f(x + lr * Math.cos(a))} ${f(y + lr * Math.sin(a))})">${d}</text>`);
  }
  const s = inner - 8; // needle: a four-point star, north point filled
  return `<g class="compass" aria-hidden="true">` +
    `<circle class="compass__ring" cx="${x}" cy="${y}" r="${r}"/><circle class="compass__ring" cx="${x}" cy="${y}" r="${inner}"/>` +
    `<path class="compass__tick" d="${ticks.join('')}"/>${labels.join('')}` +
    `<g class="compass__needle" data-origin="${x}px ${y}px">` +
    `<path class="compass__star" d="M${x} ${f(y - s)}L${f(x + s * 0.16)} ${f(y - s * 0.16)}L${f(x + s * 0.62)} ${y}L${f(x + s * 0.16)} ${f(y + s * 0.16)}L${x} ${f(y + s * 0.62)}L${f(x - s * 0.16)} ${f(y + s * 0.16)}L${f(x - s * 0.62)} ${y}L${f(x - s * 0.16)} ${f(y - s * 0.16)}Z"/>` +
    `<path class="compass__north" d="M${x} ${f(y - s)}L${f(x + s * 0.16)} ${f(y - s * 0.16)}L${x} ${y}L${f(x - s * 0.16)} ${f(y - s * 0.16)}Z"/></g>` +
    `<circle class="compass__hub" cx="${x}" cy="${y}" r="3"/>` +
    `<text class="compass__azimuth" x="${x}" y="${f(y + r + 18)}">azimuth <tspan class="js-azimuth">000</tspan>°</text></g>`;
}

const fmtBytes = (n) => (n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`);
const surveyDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

// Picks the column whose common values become regions: the one that repeats the most values, 2 to 6 of them.
export function regionColumn(table) {
  return table.columns
    .filter((c) => c.stats.common.length >= 2 && c.stats.common.length <= 6)
    .sort((a, b) => b.stats.common.length - a.stats.common.length)[0] || null;
}

export function renderChart(survey, layoutName = 'wide') {
  const L = LAYOUTS[layoutName];
  const table = survey.tables[0];
  const cols = table.columns;
  const n = cols.length;
  const step = TAU / n;
  const indexByColumn = new Map();
  for (const ix of table.indexes) for (const c of ix.columns) if (!indexByColumn.has(c) || ix.primary) indexByColumn.set(c, ix);
  const id = (s) => `${layoutName}-${s}`;
  const isTall = layoutName === 'tall';
  const out = [];

  out.push(`<svg class="chart chart--${layoutName}" viewBox="0 0 ${L.w} ${L.h}" role="group" aria-labelledby="${id('title')}">`);
  out.push(`<title id="${id('title')}">Chart of the ${esc(table.name)} table: ${n} columns around one island, ${table.indexes.length} indexes, ${table.relations.length} foreign keys</title>`);
  out.push(`<defs><filter id="${id('grain')}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0.1  0 0 0 0 0.13  0 0 0 0 0.2  0 0 0 0.05 0"/></filter>` +
    `<pattern id="${id('hachure')}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0V7" class="hachure"/></pattern>` +
    `<marker id="${id('arrow')}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9Z" class="track__head"/></marker></defs>`);

  // Paper, grain and the graduated border.
  out.push(`<rect class="sea" x="0" y="0" width="${L.w}" height="${L.h}"/><rect x="0" y="0" width="${L.w}" height="${L.h}" filter="url(#${id('grain')})"/>`);
  out.push(border(L));

  // Water depths, intertidal fringe, land and relief.
  out.push(`<path class="shoal shoal--2" d="${ring(L, 1, 64)}"/><path class="contour" d="${ring(L, 1, 64)}"/>`);
  out.push(`<path class="shoal shoal--1" d="${ring(L, 1, 30)}"/><path class="contour" d="${ring(L, 1, 30)}"/>`);
  out.push(`<path class="drying" d="${ring(L, 1, 7)}"/>`);
  out.push(`<path class="land" data-target="table" d="${ring(L, 1)}"/>`);
  out.push(`<path class="relief" d="${ring(L, 0.74)}"/><path class="relief" d="${ring(L, 0.5)}"/><path class="relief relief--top" d="${ring(L, 0.27)}" fill="url(#${id('hachure')})"/>`);

  // The island name, and its regions (common values of one column).
  out.push(`<g class="island-name" data-target="table" tabindex="0" role="button" aria-label="Table ${esc(table.name)}: ${table.rows} rows, ${n} columns">` +
    `<text class="island-name__title" x="${L.cx}" y="${L.cy - (isTall ? 4 : 2)}">${esc(table.name.toUpperCase())}</text>` +
    `<text class="island-name__sub" x="${L.cx}" y="${L.cy + 22}">${table.rows} rows, ${table.engine}</text></g>`);
  const region = regionColumn(table);
  if (region) {
    const spots = isTall
      ? [[0, -0.62], [0, -0.38], [0, 0.3], [0, 0.5], [0, 0.7], [0, -0.82]]
      : [[-0.52, -0.42], [0.5, -0.46], [-0.6, 0.36], [0.56, 0.4], [0, 0.62], [0, -0.66]];
    region.stats.common.forEach((v, i) => {
      const [dx, dy] = spots[i];
      out.push(`<text class="region" x="${f(L.cx + dx * L.rx)}" y="${f(L.cy + dy * L.ry)}">${esc(v.value)}<tspan class="region__n" dx="5">${v.n}</tspan></text>`);
    });
  }

  // The coast, one stretch per column: dashed where the column accepts NULL.
  cols.forEach((c, i) => {
    const theta = -Math.PI / 2 + i * step;
    out.push(`<path class="coast${c.nullable ? ' coast--nullable' : ''}" d="${arc(L, theta - step / 2, theta + step / 2)}"/>`);
  });

  // Places: symbol on the coast, sounding just offshore, then the name, the type and the light.
  cols.forEach((c, i) => {
    const theta = -Math.PI / 2 + i * step;
    const [px, py] = coastPoint(L, theta);
    const [nx, ny] = normal(L, theta);
    const bearing = Math.round(((i * 360) / n + 360) % 360);
    const ix = indexByColumn.get(c.name);
    const side = nx > 0.3 ? 'start' : nx < -0.3 ? 'end' : 'middle';
    // The sounding floats on the water just beside the place, a little counter-clockwise, clear of the label.
    const [tx, ty] = tangent(L, theta);
    const sx = px + nx * 17 - tx * 22, sy = py + ny * 17 - ty * 22 + 5;
    const lx = px + nx * (side === 'middle' ? 34 : 36);
    let ly = py + ny * 36;
    const lines = 2 + (ix ? 1 : 0);
    if (side === 'middle') ly = ny < 0 ? ly - (lines - 1) * 14 : ly + 10;
    else ly = ly - ((lines - 1) * 14) / 2 + 5;
    // The portrait chart is narrow: "?" marks a nullable column, and the index keeps only its kind.
    const typeLine = `${c.type}${c.nullable ? (isTall ? '?' : ', nullable') : ''}`;
    const lightLine = ix ? (ix.primary ? 'PRIMARY KEY' : ix.unique ? 'UNIQUE' : isTall ? 'INDEX' : `INDEX ${ix.name}`) : '';
    out.push(`<g class="place" data-target="col:${esc(c.name)}" tabindex="0" role="button" aria-label="Column ${esc(c.name)}, ${esc(c.type)}${c.nullable ? ', nullable' : ''}${ix ? `, ${ix.primary ? 'primary key' : `index ${esc(ix.name)}`}` : ''}, ${c.stats.distinct ?? 'n/a'} distinct values, azimuth ${bearing} degrees">`);
    out.push(`<circle class="place__hit" cx="${f(px + nx * 40)}" cy="${f(py + ny * 30)}" r="44"/>`);
    if (ix) out.push(flare(px, py, (Math.atan2(ny, nx) * 180) / Math.PI + 40, ix.unique));
    out.push(symbol(typeFamily(c.dataType), px, py));
    if (c.stats.distinct !== null) out.push(`<text class="sounding" x="${f(sx)}" y="${f(sy)}">${c.stats.distinct}</text>`);
    out.push(`<text class="place__label" x="${f(lx)}" y="${f(ly)}" text-anchor="${side}"><tspan class="place__name">${esc(c.name)}</tspan>` +
      `<tspan class="place__type" x="${f(lx)}" dy="15">${esc(typeLine)}</tspan>` +
      (ix ? `<tspan class="place__light" x="${f(lx)}" dy="14">${esc(lightLine)}</tspan>` : '') + `</text>`);
    out.push(`</g>`);
  });

  // Notes on the water: one line per <text>, shorter lines on the portrait chart.
  const note = (box, cls, title, lines, attrs = '') => `<g class="note ${cls}"${attrs}><text class="note__title" x="${box.x}" y="${box.y + 16}">${esc(title)}</text>` +
    lines.map((line, i) => `<text class="note__text" x="${box.x}" y="${box.y + 38 + i * (isTall ? 22 : 18)}">${esc(line)}</text>`).join('') + `</g>`;

  // The road that leaves the chart: object_key points to Cellar, with no foreign key.
  const keyCol = cols.findIndex((c) => /(^|_)(object_)?key$/.test(c.name) && c.name !== 'seed_key');
  if (keyCol >= 0) {
    const theta = -Math.PI / 2 + keyCol * step;
    const [px, py] = coastPoint(L, theta, 1, 74);
    const C = L.cellar;
    const name = cols[keyCol].name;
    if (C.down) {
      out.push(`<path class="track" d="M${f(px)} ${f(py + 4)}L${f(px)} ${L.h - 30}" marker-end="url(#${id('arrow')})"/>`);
    } else {
      const ex = L.w - 26, ey = C.y + 104;
      out.push(`<path class="track" d="M${f(px + 30)} ${f(py + 10)}C${f(px + 140)} ${f(py + 40)} ${f(ex - 220)} ${f(ey + 6)} ${ex} ${ey}" marker-end="url(#${id('arrow')})"/>`);
    }
    const lines = isTall
      ? [`${name} holds a Cellar key.`, 'No foreign key, so', 'Azimutt draws no road', 'until herbarium.aml', 'documents it.']
      : [`${name} holds an object key.`, 'No foreign key: Azimutt draws no road', 'until herbarium.aml documents it.'];
    out.push(note(C, 'note--cellar', isTall ? 'To chart Nº 2: Cellar' : 'To chart Nº 2, the Cellar bucket', lines, ` data-target="cellar" tabindex="0" role="button" aria-label="Off the chart: the Cellar bucket"`));
  }

  // Caution note: what the survey looked for and did not find.
  const fk = `${table.relations.length} foreign keys`, ck = `${table.checks.length} check constraints`;
  out.push(note(L.caution, 'note--caution', 'Caution', isTall
    ? [`${fk},`, `${ck}.`, 'No charted route joins', 'this island to another', 'table.']
    : [`${fk}, ${ck}.`, 'No charted route joins this island', 'to another table.']));

  // Scale of rows: one segment per row, up to 12, then grouped.
  const S = L.scale;
  const segs = Math.min(table.rows || 1, 12);
  const per = Math.ceil((table.rows || 1) / segs);
  const sw = S.w / segs;
  const scale = [];
  for (let i = 0; i < segs; i++) scale.push(`<rect class="${i % 2 ? 'scale__w' : 'scale__b'}" x="${f(S.x + i * sw)}" y="${S.y - 8}" width="${f(sw)}" height="6"/>`);
  out.push(`<g class="scale">${scale.join('')}<rect class="scale__frame" x="${S.x}" y="${S.y - 8}" width="${S.w}" height="6"/>` +
    `<text class="scale__label" x="${S.x}" y="${S.y + 12}">0</text><text class="scale__label" x="${S.x + S.w}" y="${S.y + 12}" text-anchor="end">${table.rows} rows</text>` +
    `<text class="scale__caption" x="${S.x}" y="${S.y - 16}">Scale of rows${per > 1 ? `, ${per} per segment` : ''}. Data ${fmtBytes(table.dataBytes)}, indexes ${fmtBytes(table.indexBytes)}</text></g>`);

  // Title cartouche.
  const T = L.cartouche;
  out.push(`<g class="cartouche"><rect class="cartouche__box" x="${T.x}" y="${T.y}" width="${T.w}" height="${T.h}"/><rect class="cartouche__inner" x="${T.x + 5}" y="${T.y + 5}" width="${T.w - 10}" height="${T.h - 10}"/>` +
    `<text class="cartouche__kicker" x="${T.x + T.w / 2}" y="${T.y + 32}">MySQL ${esc(survey.version.split('-')[0])} add-on</text>` +
    `<text class="cartouche__title" x="${T.x + T.w / 2}" y="${T.y + (isTall ? 74 : 78)}">The Herbarium</text>` +
    `<text class="cartouche__sub" x="${T.x + T.w / 2}" y="${T.y + (isTall ? 100 : 106)}">Chart of the ${esc(table.name)} table</text>` +
    `<text class="cartouche__meta" x="${T.x + T.w / 2}" y="${T.y + (isTall ? 122 : 132)}">Surveyed ${surveyDate(survey.surveyedAt)}, ${survey.totals.queries} read-only queries</text>` +
    `<text class="cartouche__meta cartouche__meta--caps" x="${T.x + T.w / 2}" y="${T.y + (isTall ? 140 : 154)}">Soundings in distinct values</text></g>`);

  out.push(compass(L.compass));
  out.push(`</svg>`);
  return out.join('\n');
}

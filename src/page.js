// The companion page: the Clever frame around the map room.
import { esc } from './html.js';
import { renderChart, regionColumn } from './chart.js';

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 101 116'%3E%3Cpolygon fill='%23AB2B4A' points='100.423 29.134 100.423 86.868 89.721 73.062 83.76 58.003 83.756 58.003 89.418 42.731'/%3E%3Cpolygon fill='%23E87A68' points='.429 29.134 .429 86.868 9.889 73.481 17.092 58.003 17.096 58.003 9.773 43.319'/%3E%3Cpolygon fill='%23D74D4E' points='83.756 58.003 52.241 60.003 17.092 58.003 31.76 29.134 50.426 .269 70.722 31.961'/%3E%3Cpolygon fill='%23BD3246' points='100.423 29.134 83.756 58.003 50.426 .269'/%3E%3Cpolygon fill='%23F19175' points='50.426 .269 17.092 58.003 .425 29.134'/%3E%3Cpolygon fill='%23CF3942' points='83.756 58.003 72.365 82.931 50.426 115.737 27.849 81.83 17.092 58.003'/%3E%3Cpolygon fill='%23E0625B' points='50.426 115.737 .425 86.868 17.092 58.003'/%3E%3Cpolygon fill='%239A244F' points='50.422 115.737 100.423 86.868 83.756 58.003'/%3E%3C/svg%3E";

const LEGEND_SYMBOLS = {
  island: '<svg viewBox="0 0 44 28" aria-hidden="true"><path class="lg-shoal" d="M4 14C4 5 14 3 22 4S42 6 40 15 30 26 20 25 4 22 4 14Z"/><path class="lg-land" d="M10 14C10 9 16 8 22 8.5S35 10 34 15 28 21 21 20.5 10 18 10 14Z"/></svg>',
  text: '<svg viewBox="0 0 44 28" aria-hidden="true"><circle class="sym" cx="22" cy="14" r="5"/><circle class="sym--dot" cx="22" cy="14" r="1.6"/></svg>',
  number: '<svg viewBox="0 0 44 28" aria-hidden="true"><rect class="sym sym--fill" x="18" y="10" width="8" height="8"/></svg>',
  time: '<svg viewBox="0 0 44 28" aria-hidden="true"><path class="sym" d="M22 8L27.5 18H16.5Z"/><circle class="sym--dot" cx="22" cy="14.6" r="1.4"/></svg>',
  longtext: '<svg viewBox="0 0 44 28" aria-hidden="true"><rect class="sym" x="17.5" y="9.5" width="9" height="9"/><path class="sym" d="M17.5 15.5L23.5 9.5M20.5 18.5L26.5 12.5"/></svg>',
  nullable: '<svg viewBox="0 0 44 28" aria-hidden="true"><path class="lg-coast" d="M3 18C12 8 22 20 41 10"/><path class="lg-coast lg-coast--dash" d="M3 24C12 14 22 26 41 16" transform="translate(0 -4)"/></svg>',
  light: '<svg viewBox="0 0 44 28" aria-hidden="true"><g transform="translate(14 16) rotate(-30)"><path class="light__flare" d="M0 0C6 -5 20 -6 30 0C20 6 6 5 0 0Z"/><path class="light__star" d="M0 -4.6L1.3 -1.3L4.6 0L1.3 1.3L0 4.6L-1.3 1.3L-4.6 0L-1.3 -1.3Z"/></g></svg>',
  sounding: '<svg viewBox="0 0 44 28" aria-hidden="true"><text class="sounding" x="22" y="19">12</text></svg>',
  region: '<svg viewBox="0 0 44 28" aria-hidden="true"><text class="region" x="22" y="18">Abc</text></svg>',
  track: '<svg viewBox="0 0 44 28" aria-hidden="true"><path class="track" d="M3 20C14 20 24 8 38 8"/><path class="track__head" d="M36 4.5L42 8L36 11.5Z"/></svg>',
};

function legend(survey) {
  const table = survey.tables[0];
  const region = regionColumn(table);
  const rows = [
    ['island', 'Island', `A table. Azimutt draws it as a card you open to read its columns, here ${esc(table.name)}.`],
    ['text', 'Town', 'A text column (varchar, char, enum).'],
    ['number', 'Square', 'A number column.'],
    ['time', 'Survey mark', 'A date or time column.'],
    ['longtext', 'Hatched square', 'A long text column (text, json).'],
    ['nullable', 'Dashed coast', 'The column accepts NULL. A solid coast means NOT NULL.'],
    ['light', 'Lighthouse', 'An index on that column. Its label names it: PRIMARY KEY, UNIQUE or INDEX.'],
    ['sounding', 'Sounding', 'Distinct values in the column: the first number Azimutt shows when you click it.'],
    ['region', 'Region', region ? `The most common values of ${esc(region.name)}, with their count.` : 'The most common values of a column.'],
    ['track', 'Magenta track', 'A link the database does not declare. Azimutt draws it once you write it in AML.'],
  ];
  return rows.map(([k, name, text]) => `<li><span class="legend__sym">${LEGEND_SYMBOLS[k]}</span><span><strong>${name}</strong>${text}</span></li>`).join('');
}

function pilotEntry(e) {
  return `<p class="pilot__kicker">${esc(e.kicker)}</p>
        <h2 class="pilot__title">${esc(e.title)}</h2>
        <p class="pilot__story">${esc(e.story)}</p>
        <dl class="pilot__facts">${e.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${e.note ? `<p class="pilot__note"><span>Note in herbarium.aml</span>${esc(e.note)}</p>` : ''}
        <p class="pilot__sqllabel">${esc(e.sqlLabel)}</p>
        <pre class="pilot__sql">${esc(e.sql)}</pre>`;
}

function shipLog(view) {
  const step = { schema: 'Draws the map', stats: 'Measures a column' };
  return view.log.map((l) => `<li class="log__entry">
          <details>
            <summary><span class="log__time">+${l.offset} ms</span><span class="log__what">${esc(l.label)}<small>${step[l.step] || ''}</small></span><span class="log__rows">${l.rows} ${l.rows === 1 ? 'row' : 'rows'}</span><span class="log__ms">${l.ms} ms</span></summary>
            <pre>${esc(l.sql)}</pre>
          </details>
        </li>`).join('\n');
}

function platformPanel(platform) {
  return platform.map((p) => `<div><dt>${esc(p.label)}</dt><dd${p.value ? '' : ' class="is-empty"'}>${esc(p.value || 'not set locally')}</dd></div>`).join('');
}

export function renderPage({ survey, view, platform, logoSvg, badgeSvg, assetVersion = 'dev' }) {
  const table = survey.tables[0];
  const version = survey.version.split('-')[0];
  const data = JSON.stringify({ entries: view.entries }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#13172e">
<meta name="description" content="The Map Room: the Azimutt add-on on Clever Cloud charts the Herbarium's MySQL database.">
<title>The Map Room · Azimutt on Clever Cloud</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=JetBrains+Mono:wght@400;500;600&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&family=Barlow+Condensed:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/cc-brand.css?v=${assetVersion}">
<link rel="stylesheet" href="/maproom.css?v=${assetVersion}">
<link rel="icon" href="${FAVICON}">
<script src="/maproom.js?v=${assetVersion}" defer></script>
</head>
<body>

<header class="cc-topbar">
  <div class="cc-container cc-topbar__inner">
    <a href="https://www.clever.cloud" target="_blank" rel="noopener" aria-label="Clever Cloud">${logoSvg}</a>
    <span class="cc-topbar__sep"></span>
    <div class="cc-topbar__demo"><small>Demo</small>Azimutt add-on</div>
    <span class="cc-topbar__spacer"></span>
    <nav class="cc-topbar__nav" aria-label="Status">
      <span class="cc-pill cc-pill--mono cc-hide-sm">Azimutt, MySQL ${esc(version)}, Node.js</span>
      <span class="cc-pill cc-pill--live"><span class="cc-dot"></span>Live on Clever Cloud</span>
      <a class="cc-pill cc-pill--gradient" href="https://academy.clever.cloud/" target="_blank" rel="noopener">Get certified ↗</a>
    </nav>
  </div>
</header>

<main class="room">
  <section class="intro wrap">
    <h1 class="intro__title">The Map Room</h1>
    <p class="intro__lead">Azimutt is a database explorer, offered as a Clever Cloud add-on. It turns a database into a map you can sail: tables become islands, columns the places on their coast, indexes the lighthouses. Here it charts the Herbarium, the MySQL add-on of another demo, read with <code>SELECT</code> only.</p>
    <div class="intro__actions">
      <a class="intro__btn" href="#orders">Open the map in Azimutt</a>
      <p class="intro__status js-status" data-state="checking"><span class="intro__lamp"></span><span class="js-status-text">Checking the Azimutt service</span></p>
    </div>
  </section>

  <section class="chart-table" id="top-of-chart" aria-label="The chart">
    <div class="sheet">
      ${renderChart(survey, 'wide')}
      ${renderChart(survey, 'tall')}
    </div>
    <p class="sheet__hint wrap">Choose a place on the coast. The pilot book below gives its sailing directions, and the compass takes its azimuth.</p>
  </section>

  <section class="wrap duo">
    <article class="paper pilot" id="pilot" aria-live="polite">
      <div class="js-pilot">
        ${pilotEntry(view.entries.table)}
      </div>
    </article>
    <aside class="paper legend" aria-labelledby="legend-title">
      <h2 class="paper__title" id="legend-title">Chart Nº 1, symbols</h2>
      <p class="paper__intro">Real sea charts come with a symbol book, Chart&nbsp;No.&nbsp;1. This one reads a database.</p>
      <ul class="legend__list">${legend(survey)}</ul>
    </aside>
  </section>

  <section class="wrap">
    <article class="paper log" aria-labelledby="log-title">
      <div class="log__head">
        <h2 class="paper__title" id="log-title">Ship's log: what Azimutt asks the database</h2>
        <p class="paper__intro">To draw this chart, Azimutt reads MySQL's <code>information_schema</code>, then measures each column you open. This log replays those queries on the Herbarium with <code>scripts/survey.js</code>: ${survey.totals.queries} <code>SELECT</code>, ${survey.totals.ms} ms, inside a read-only transaction. Open an entry to read the SQL.</p>
      </div>
      <ol class="log__list">
        ${shipLog(view)}
      </ol>
    </article>
  </section>

  <section class="wrap duo duo--even">
    <article class="paper route" aria-labelledby="route-title">
      <h2 class="paper__title" id="route-title">The crossing</h2>
      <p class="paper__intro">Who sees what when Azimutt opens a database.</p>
      <ol class="route__ports">
        <li><strong>Your browser</strong>Azimutt runs here. The database URI you paste stays here, encrypted in the browser's storage.</li>
        <li><strong>The gateway</strong>An open-source relay that opens the connection and runs the queries. For the Clever Cloud add-on, Clever Cloud hosts it.</li>
        <li><strong>The MySQL add-on</strong>The Herbarium's database. In this demo it is only read.</li>
      </ol>
      <p class="route__signin">Sign-in goes through your Clever Cloud account, from the Console. There is no separate Azimutt password.</p>
      <p class="route__live js-status-detail">The companion app checks azimutt.app every 30 seconds.</p>
    </article>

    <article class="paper orders" id="orders" aria-labelledby="orders-title">
      <h2 class="paper__title" id="orders-title">Orders for the navigator</h2>
      <p class="paper__intro">Five steps, two minutes, from the Clever Cloud Console.</p>
      <ol class="orders__list">
        <li>Open the <a href="https://console.clever-cloud.com/" target="_blank" rel="noopener">Clever Cloud Console</a>, choose the organisation, then the Azimutt add-on.</li>
        <li>Follow the add-on's link to Azimutt. It signs you in with your Clever Cloud account.</li>
        <li>On the page of the Herbarium's MySQL add-on, copy its connection URI. Paste it nowhere else.</li>
        <li>In Azimutt, paste it into <em>Database URI</em> and choose <em>Connect database</em>.</li>
        <li>Open <em>${esc(table.name)}</em>, click a column for its statistics, then browse the rows. For the Cellar road, add <em>herbarium.aml</em> as a source.</li>
      </ol>
      <p class="orders__plan">Free plan: schema and data exploration, 2 layouts, 10 notes. The project is not saved, so you reconnect at each session.</p>
    </article>
  </section>

  <section class="wrap">
    <article class="paper case" aria-labelledby="case-title">
      <h2 class="paper__title" id="case-title">In the chart case</h2>
      <p class="paper__intro">Ready-made material for the Azimutt project, kept in the repository under <code>azimutt/</code>.</p>
      <ul class="case__files">
        <li><a href="/azimutt/herbarium.aml">herbarium.aml</a><span>The whole map in AML, Azimutt's schema language: both entities, every column documented, and the Cellar road. Paste it as a source.</span><button class="case__copy js-copy" type="button" data-src="/azimutt/herbarium.aml">Copy AML</button></li>
        <li><a href="/azimutt/notes.md">notes.md</a><span>Seven notes for the table and its key columns, within the free plan's ten.</span></li>
        <li><a href="/azimutt/layouts.md">layouts.md</a><span>Two layouts: the printed label, and what lies behind the sheet.</span></li>
      </ul>
    </article>
  </section>

  <section class="wrap platform" aria-label="Running on Clever Cloud">
    <div class="cc-platform">
      <div class="cc-platform__head">
        <h3>Running on Clever Cloud</h3>
        <span class="cc-pill cc-pill--ok"><span class="cc-dot"></span>Instance up</span>
      </div>
      <dl class="cc-kv">${platformPanel(platform)}</dl>
      <div class="cc-platform__foot">Variables set by the platform on each instance: <a href="https://www.clever.cloud/developers/doc/reference/reference-environment-variables/" target="_blank" rel="noopener">reference</a>.</div>
    </div>
  </section>
</main>

<footer class="cc-footer">
  <div class="cc-container">
    <div class="cc-footer__inner">
      <div class="cc-footer__brand">
        <a href="https://www.clever.cloud" target="_blank" rel="noopener" aria-label="Clever Cloud">${logoSvg}</a>
        <p>European PaaS, fully managed. Push your code, Clever Cloud runs it, with the add-ons it needs.</p>
        <div class="cc-trust"><span>ISO 27001</span><span>HDS</span><span>HOSTED IN FRANCE</span></div>
      </div>
      <div>
        <h4>Documentation</h4>
        <ul>
          <li><a href="https://www.clever.cloud/developers/changelog/2024/10-18-azimutt-available/" target="_blank" rel="noopener">Azimutt add-on</a></li>
          <li><a href="https://azimutt.app/docs" target="_blank" rel="noopener">Azimutt documentation</a></li>
          <li><a href="https://www.clever.cloud/developers/doc/deploy/databases/mysql/" target="_blank" rel="noopener">MySQL add-on</a></li>
          <li><a href="https://github.com/Vitiosum/demo-azimutt" target="_blank" rel="noopener">Source code on GitHub</a></li>
        </ul>
      </div>
      <a class="academy" href="https://academy.clever.cloud/" target="_blank" rel="noopener">
        ${badgeSvg}
        <span><strong>Get Clever Cloud certified</strong>Cloud Computing Fundamentals and Advanced Deployment, on academy.clever.cloud</span>
      </a>
    </div>
    <div class="cc-footer__bottom"><span>Demo by the Clever Cloud presales team. The Herbarium and its collectors are fictional.</span><span>© 2026 Clever Cloud</span></div>
  </div>
</footer>
<script type="application/json" id="map-data">${data}</script>
</body>
</html>`;
}

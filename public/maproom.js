// The Map Room, in the browser: choose a place on the chart, read its pilot book entry,
// watch the compass take its azimuth. Also: the live status of the Azimutt service, and the copy button.
const data = JSON.parse(document.getElementById('map-data').textContent);
const pilot = document.querySelector('.js-pilot');
const narrow = window.matchMedia('(max-width: 720px)');
let heading = 0; // cumulative needle rotation, so the needle always turns the short way

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEntry(e) {
  const frag = document.createDocumentFragment();
  frag.append(el('p', 'pilot__kicker', e.kicker), el('h2', 'pilot__title', e.title), el('p', 'pilot__story', e.story));
  const dl = el('dl', 'pilot__facts');
  for (const [k, v] of e.facts) {
    const row = el('div');
    row.append(el('dt', '', k), el('dd', '', v));
    dl.append(row);
  }
  frag.append(dl);
  if (e.values) {
    const ul = el('ul', 'pilot__values');
    const max = Math.max(...e.values.map((v) => v.n));
    for (const v of e.values) {
      const li = el('li');
      const bar = el('span', 'bar');
      const fill = el('span');
      fill.style.width = `${(v.n / max) * 100}%`;
      bar.append(fill);
      li.append(el('span', '', v.value === null ? '(empty)' : String(v.value)), bar, el('span', 'n', String(v.n)));
      ul.append(li);
    }
    frag.append(ul);
  }
  if (e.note) {
    const note = el('p', 'pilot__note');
    note.append(el('span', '', 'Note in herbarium.aml'), document.createTextNode(e.note));
    frag.append(note);
  }
  frag.append(el('p', 'pilot__sqllabel', e.sqlLabel), el('pre', 'pilot__sql', e.sql));
  const back = el('a', 'pilot__back', 'Back to the chart');
  back.href = '#top-of-chart';
  frag.append(back);
  return frag;
}

function turnCompass(bearing) {
  let delta = ((bearing - heading) % 360 + 540) % 360 - 180;
  heading += delta;
  for (const needle of document.querySelectorAll('.compass__needle')) {
    needle.style.transformOrigin = needle.dataset.origin; // set from script: the CSP refuses inline style attributes
    needle.style.transform = `rotate(${heading}deg)`;
  }
  for (const t of document.querySelectorAll('.js-azimuth')) t.textContent = String(bearing).padStart(3, '0');
}

function select(key, fromUser) {
  const entry = data.entries[key];
  if (!entry) return;
  pilot.replaceChildren(renderEntry(entry));
  for (const node of document.querySelectorAll('.is-selected')) node.classList.remove('is-selected');
  for (const node of document.querySelectorAll('[data-target]')) if (node.dataset.target === key && node.matches('.place, .island-name, .note')) node.classList.add('is-selected');
  turnCompass(entry.bearing);
  if (fromUser && narrow.matches) document.getElementById('pilot').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('click', (ev) => {
  const target = ev.target.closest('[data-target]');
  if (target) select(target.dataset.target, true);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter' && ev.key !== ' ') return;
  const target = ev.target.closest?.('[data-target][tabindex]');
  if (!target) return;
  ev.preventDefault();
  select(target.dataset.target, true);
});

// Live status of the Azimutt service, from the app's own deep health check.
async function refreshStatus() {
  const box = document.querySelector('.js-status');
  const text = document.querySelector('.js-status-text');
  const detail = document.querySelector('.js-status-detail');
  try {
    const res = await fetch('/health/deep', { cache: 'no-store' });
    const body = await res.json();
    const a = body.azimutt;
    box.dataset.state = a.ok ? 'ok' : 'degraded';
    text.textContent = a.ok ? `Azimutt service up${a.version ? `, version ${a.version}` : ''}` : 'Azimutt service not answering: the chart works, Azimutt may not';
    const at = new Date(a.checkedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    detail.textContent = a.ok
      ? `Checked at ${at}: azimutt.app answered in ${a.ms} ms, database up.`
      : `Checked at ${at}: azimutt.app ${a.http ? `answered HTTP ${a.http}` : `was ${a.error}`}.`;
  } catch {
    box.dataset.state = 'degraded';
    text.textContent = 'Status unavailable';
  }
}
refreshStatus();

for (const btn of document.querySelectorAll('.js-copy')) {
  btn.addEventListener('click', async () => {
    const label = btn.textContent;
    try {
      const res = await fetch(btn.dataset.src);
      await navigator.clipboard.writeText(await res.text());
      btn.textContent = 'Copied';
    } catch {
      btn.textContent = 'Copy failed: open the file';
    }
    setTimeout(() => { btn.textContent = label; }, 2400);
  });
}

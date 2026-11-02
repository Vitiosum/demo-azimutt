import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderChart, regionColumn, typeFamily, coastFactor } from '../src/chart.js';
import { buildView, columnStory } from '../src/view.js';

const survey = JSON.parse(readFileSync(new URL('../survey/herbarium.json', import.meta.url), 'utf8'));
const count = (s, re) => (s.match(re) || []).length;

for (const layout of ['wide', 'tall']) {
  test(`the ${layout} chart draws one place per column, one light per indexed column, and the Cellar road`, () => {
    const svg = renderChart(survey, layout);
    assert.equal(count(svg, /class="place"/g), 14);
    assert.equal(count(svg, /class="light( light--unique)?"/g), 3);
    assert.equal(count(svg, /class="coast coast--nullable"/g), 3); // drawing, seed_key, created_sql
    assert.equal(count(svg, /class="sounding"/g), 13); // created_sql (text) has no distinct count
    assert.match(svg, /data-target="cellar"/);
    assert.match(svg, /class="track"/);
    assert.match(svg, /0 foreign keys/);
    assert.ok(svg.startsWith(`<svg class="chart chart--${layout}"`));
  });
}

test('the chart escapes text coming from the database', () => {
  const evil = structuredClone(survey);
  evil.tables[0].columns[4].stats.common[0].value = '<script>alert(1)</script>';
  const svg = renderChart(evil, 'wide');
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /&lt;script&gt;/);
});

test('helpers: type families, region column, a closed deterministic coast', () => {
  assert.equal(typeFamily('int'), 'number');
  assert.equal(typeFamily('datetime'), 'time');
  assert.equal(typeFamily('text'), 'longtext');
  assert.equal(typeFamily('varchar'), 'text');
  assert.equal(regionColumn(survey.tables[0]).name, 'locality');
  assert.ok(Math.abs(coastFactor(0) - coastFactor(Math.PI * 2)) < 1e-9);
});

test('the view has a pilot book entry for the table, each column and the Cellar road', () => {
  const view = buildView(survey, readFileSync(new URL('../azimutt/herbarium.aml', import.meta.url), 'utf8'));
  assert.equal(Object.keys(view.entries).length, 1 + 14 + 1);
  const family = view.entries['col:family'];
  assert.equal(family.bearing, Math.round((3 * 360) / 14));
  assert.match(family.sql, /^SELECT/);
  assert.match(view.entries['col:locality'].sql, /GROUP BY `locality`/);
  assert.match(view.entries.cellar.sql, /^rel specimens\(object_key\)/);
  assert.equal(view.log.length, survey.log.length);
  assert.equal(view.log[0].offset, 0);
});

test('column stories describe the numbers in plain words', () => {
  const rows = 12;
  assert.match(columnStory({ nullable: false, stats: { distinct: 12, nulls: 0, min: null, max: null, common: [] } }, rows), /Every row has its own value/);
  assert.match(columnStory({ nullable: false, stats: { distinct: 1, nulls: 0, min: null, max: null, common: [{ value: 'image/svg+xml', n: 12 }] } }, rows), /One value in every row: image\/svg\+xml/);
  assert.match(columnStory({ nullable: true, stats: { distinct: null, nulls: 0, min: null, max: null, common: [] } }, rows), /Long text/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QUERIES, assertReadOnly, buildChart, columnStatsSql, commonValuesSql, wantsCommonValues } from '../scripts/survey.js';

const survey = JSON.parse(readFileSync(new URL('../survey/herbarium.json', import.meta.url), 'utf8'));

test('the guard lets single SELECT statements through and refuses everything else', () => {
  assertReadOnly(QUERIES.tables);
  assertReadOnly(columnStatsSql('specimens', [{ name: 'family', data_type: 'varchar' }]));
  for (const bad of ['UPDATE specimens SET family = 1', 'DELETE FROM specimens', 'DROP TABLE specimens', 'SELECT 1; DROP TABLE specimens', '  insert into t values (1)']) {
    assert.throws(() => assertReadOnly(bad), /only single SELECT/);
  }
});

test('every built-in query is read-only and scoped to the current database', () => {
  for (const sql of Object.values(QUERIES)) assertReadOnly(sql);
  for (const [name, sql] of Object.entries(QUERIES)) if (name !== 'version') assert.match(sql, /DATABASE\(\)/, name);
});

test('identifiers are quoted, backticks doubled', () => {
  assert.equal(commonValuesSql('t', 'we`ird'), 'SELECT `we``ird` AS value, COUNT(*) AS n\n  FROM `t`\n GROUP BY `we``ird`\n ORDER BY n DESC, value\n LIMIT 6');
  const sql = columnStatsSql('specimens', [{ name: 'id', data_type: 'int' }, { name: 'created_sql', data_type: 'text' }]);
  assert.match(sql, /MIN\(`id`\) AS `id.min`/);
  assert.doesNotMatch(sql, /COUNT\(DISTINCT `created_sql`\)/); // long text: nulls only
});

test('common values are kept only where values repeat', () => {
  assert.equal(wantsCommonValues('varchar', 5, 12), true); // locality
  assert.equal(wantsCommonValues('varchar', 12, 12), false); // unique per row
  assert.equal(wantsCommonValues('int', 3, 12), false); // numbers get min and max instead
  assert.equal(wantsCommonValues('varchar', 40, 400), false); // too many to chart
});

test('buildChart turns raw information_schema rows into the chart document', () => {
  const chart = buildChart({
    version: '8.4.10-10',
    tables: [{ name: 'specimens', kind: 'BASE TABLE', engine: 'InnoDB', estimated_rows: '3', data_bytes: '16384', index_bytes: '0', avg_row_bytes: '100', auto_increment: '4', comment: '', created_at: '2026-11-01 20:50:52' }],
    columns: [
      { table_name: 'specimens', position: 1, name: 'id', type: 'int', data_type: 'int', nullable: 'NO', default_value: null, extra: 'auto_increment', comment: '' },
      { table_name: 'specimens', position: 2, name: 'family', type: 'varchar(60)', data_type: 'varchar', nullable: 'YES', default_value: null, extra: '', comment: '' },
    ],
    indexes: [{ table_name: 'specimens', name: 'PRIMARY', non_unique: 0, seq: 1, column_name: 'id', type: 'BTREE', cardinality: '3' }],
    relations: [],
    checks: [],
    stats: { specimens: { rows: '3', 'id.distinct': '3', 'id.nulls': '0', 'id.min': '1', 'id.max': '3', 'family.distinct': '2', 'family.nulls': '1' } },
    common: { specimens: { family: [{ value: 'Fagaceae', n: '2' }, { value: null, n: '1' }] } },
    log: [{ step: 'schema', label: 'Tables', sql: 'SELECT 1', rows: 1, ms: 2.5 }],
    surveyedAt: '2026-11-01T22:00:00.000Z',
  });
  const t = chart.tables[0];
  assert.equal(t.rows, 3);
  assert.deepEqual(t.indexes, [{ name: 'PRIMARY', primary: true, unique: true, type: 'BTREE', cardinality: 3, columns: ['id'] }]);
  assert.equal(t.columns[1].nullable, true);
  assert.deepEqual(t.columns[1].stats.common[0], { value: 'Fagaceae', n: 2 });
  assert.equal(t.columns[0].stats.max, '3');
  assert.deepEqual(chart.totals, { queries: 1, ms: 2.5 });
});

test('the committed survey of the Herbarium is complete and holds no connection detail', () => {
  const t = survey.tables[0];
  assert.equal(t.name, 'specimens');
  assert.equal(t.columns.length, 14);
  assert.deepEqual(t.indexes.map((i) => i.name).sort(), ['PRIMARY', 'ix_specimens_family', 'seed_key']);
  for (const entry of survey.log) assertReadOnly(entry.sql);
  const text = JSON.stringify(survey);
  assert.doesNotMatch(text, /"(schema|host|user|password|uri|database)"\s*:/i);
  assert.doesNotMatch(text, /mysql:\/\/|clever-cloud\.com|TABLE_SCHEMA AS/);
});

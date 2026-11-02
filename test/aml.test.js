// Parses azimutt/herbarium.aml with Azimutt's own AML parser (@azimutt/aml, a dev dependency),
// and checks it matches the surveyed table column for column.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { amlNotes } from '../src/view.js';

const require = createRequire(import.meta.url);
// The package's ESM entry imports its package.json without an import attribute, which current Node refuses.
// Its CommonJS bundle works: load it as CommonJS.
function loadAmlParser() {
  const file = require.resolve('@azimutt/aml').replace(/index\.js$/, 'bundle.js');
  const module = { exports: {} };
  new Function('exports', 'require', 'module', readFileSync(file, 'utf8'))(module.exports, require, module);
  return module.exports;
}

const aml = readFileSync(new URL('../azimutt/herbarium.aml', import.meta.url), 'utf8');
const survey = JSON.parse(readFileSync(new URL('../survey/herbarium.json', import.meta.url), 'utf8'));

test('herbarium.aml parses without errors with the Azimutt parser', () => {
  const { result, errors } = loadAmlParser().parseAml(aml);
  assert.deepEqual(errors || [], []);
  assert.deepEqual(result.entities.map((e) => [e.schema || '', e.name]), [['', 'specimens'], ['cellar', 'objects']]);
  assert.equal(result.relations.length, 1);
  assert.deepEqual(result.relations[0].src.attrs, [['object_key']]);
  assert.equal(result.relations[0].ref.entity, 'objects');
});

test('herbarium.aml lists the surveyed columns, in order, with the same types and nullability', () => {
  const { result } = loadAmlParser().parseAml(aml);
  const specimens = result.entities.find((e) => e.name === 'specimens');
  const surveyed = survey.tables[0].columns;
  assert.deepEqual(specimens.attrs.map((a) => a.name), surveyed.map((c) => c.name));
  specimens.attrs.forEach((a, i) => {
    assert.equal(a.type, surveyed[i].type, a.name);
    assert.equal(Boolean(a.null), surveyed[i].nullable, a.name);
  });
});

test('the notes shown in the pilot book come from the AML documentation', () => {
  const notes = amlNotes(aml);
  assert.match(notes.specimens, /One pressed specimen per row/);
  assert.match(notes['specimens.family'], /folder tabs/);
  assert.match(notes['cellar.objects'], /Cellar bucket/);
  assert.equal(Object.keys(notes).filter((k) => k.startsWith('specimens.')).length, 14);
});

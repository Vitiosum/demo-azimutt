// Turns the survey into what the page shows: one "pilot book" entry per place on the chart,
// and the ship's log of queries. Pure functions, no I/O.
import { QUERIES, columnStatsSql } from '../scripts/survey.js';
import { typeFamily } from './chart.js';

// Reads the documentation written in herbarium.aml (the text after "|"), keyed by entity and column.
export function amlNotes(aml) {
  const notes = {};
  let entity = null;
  for (const line of aml.split('\n')) {
    const top = line.match(/^([a-z_][\w.]*)\s*(?:\|\s*(.+))?$/i);
    if (top && !line.startsWith('rel ')) {
      entity = top[1];
      if (top[2]) notes[entity] = top[2].trim();
      continue;
    }
    const attr = line.match(/^ {2}([a-z_]\w*)\b.*?\|\s*(.+)$/i);
    if (attr && entity) notes[`${entity}.${attr[1]}`] = attr[2].trim();
  }
  return notes;
}

const kb = (n) => (n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} bytes`);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const TYPE_WORDS = { number: 'number', text: 'text', time: 'date or time', longtext: 'long text' };

export function columnStory(c, rows) {
  const s = c.stats;
  if (s.distinct === null) return `Long text, written once per row. Azimutt shows it in the row explorer rather than in statistics.`;
  const parts = [];
  if (s.common.length && s.distinct === 1) parts.push(`One value in every row: ${s.common[0].value}.`);
  else if (s.common.length) parts.push(`${plural(s.distinct, 'value')} shared by ${rows} rows. Most common: ${s.common.slice(0, 2).map((v) => `${v.value} (${v.n})`).join(', ')}.`);
  else if (s.distinct === rows - s.nulls) parts.push(`Every row has its own value: ${s.distinct} distinct in ${rows} rows.`);
  else parts.push(`${plural(s.distinct, 'distinct value')} in ${rows} rows.`);
  if (s.min !== null && s.max !== null && s.min !== s.max) parts.push(`From ${s.min} to ${s.max}.`);
  if (c.nullable) parts.push(s.nulls ? `Empty in ${plural(s.nulls, 'row')}.` : `Empty is allowed, and no row is empty today.`);
  return parts.join(' ');
}

export function buildView(survey, aml = '') {
  const table = survey.tables[0];
  const notes = amlNotes(aml);
  const n = table.columns.length;
  const indexByColumn = new Map();
  for (const ix of table.indexes) for (const c of ix.columns) if (!indexByColumn.has(c) || ix.primary) indexByColumn.set(c, ix);
  const logged = new Map(survey.log.map((l) => [l.label, l.sql]));
  const entries = {};

  entries.table = {
    kicker: `Table, ${table.engine}`,
    title: table.name,
    bearing: 0,
    facts: [
      ['Rows', `${table.rows}`],
      ['Columns', `${n}`],
      ['Indexes', `${table.indexes.length} (${table.indexes.map((i) => i.name).join(', ')})`],
      ['Foreign keys', `${table.relations.length}`],
      ['On disk', `${kb(table.dataBytes)} of data, ${kb(table.indexBytes)} of indexes`],
      ['Next id', `${table.autoIncrement ?? 'n/a'}`],
    ],
    story: `One island, ${n} places on its coast. In Azimutt it is a card: open it to list the columns, follow relations (there are none here), or browse the ${table.rows} rows.`,
    note: notes[table.name] || null,
    sqlLabel: 'The query that found the island',
    sql: logged.get('Tables') || QUERIES.tables,
  };

  table.columns.forEach((c, i) => {
    const ix = indexByColumn.get(c.name);
    const bearing = Math.round((i * 360) / n);
    const facts = [
      ['Type', `${c.type} (${TYPE_WORDS[typeFamily(c.dataType)]})`],
      ['Empty values', c.nullable ? `Allowed, ${c.stats.nulls ?? 0} of ${table.rows} rows empty` : 'Not allowed (NOT NULL)'],
    ];
    if (c.default !== null) facts.push(['Default', c.default]);
    if (c.extra) facts.push(['Extra', c.extra]);
    facts.push(['Index', ix ? `${ix.primary ? 'PRIMARY KEY' : ix.name}, ${ix.type}${ix.unique ? ', unique' : ''}` : 'None']);
    if (c.stats.distinct !== null) facts.push(['Distinct values', `${c.stats.distinct} of ${table.rows} rows`]);
    const common = logged.get(`Common values, ${table.name}.${c.name}`);
    entries[`col:${c.name}`] = {
      kicker: `Column ${c.position} of ${n}, azimuth ${String(bearing).padStart(3, '0')}°`,
      title: c.name,
      bearing,
      facts,
      values: c.stats.common.length ? c.stats.common : null,
      valuesTotal: table.rows,
      story: columnStory(c, table.rows),
      note: notes[`${table.name}.${c.name}`] || null,
      sqlLabel: common ? 'The query behind the most common values' : 'The statistics query, for this column',
      sql: common || columnStatsSql(table.name, [c]),
    };
  });

  entries.cellar = {
    kicker: 'Off the chart',
    title: 'cellar.objects',
    bearing: 135,
    facts: [
      ['Where', 'The Herbarium\'s Cellar bucket (S3-compatible)'],
      ['Seen by MySQL', 'No: object_key is plain text'],
      ['Seen by Azimutt', 'Once herbarium.aml is added as a source'],
    ],
    story: 'Each specimen row names an image stored in Cellar. A database cannot declare a key into object storage, so the map stops at the coast. Azimutt lets you draw that road yourself, in AML, next to the live schema.',
    note: notes['cellar.objects'] || null,
    sqlLabel: 'The road, written in AML (azimutt/herbarium.aml)',
    sql: (aml.match(/^rel .*$/m) || ['rel specimens(object_key) -- cellar.objects(key)'])[0],
  };

  let offset = 0;
  const log = survey.log.map((l) => {
    const entry = { ...l, offset: Math.round(offset) };
    offset += l.ms;
    return entry;
  });

  return { entries, log };
}

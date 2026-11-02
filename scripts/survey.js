// Survey a MySQL database, read-only, and write the chart the companion page draws.
//
//   MYSQL_ADDON_URI=… npm run survey     (writes survey/herbarium.json, or SURVEY_OUT)
//
// It reads the same information_schema views Azimutt's MySQL connector reads,
// then measures each column the way Azimutt's column statistics do.
// The link is always TLS and the certificate is always checked. MySQL's auto-generated
// certificates name no host, so for them pass their CA in SURVEY_TLS_CA: the server must
// present a certificate signed by that CA (MySQL's VERIFY_CA mode).
// Safety: a READ ONLY transaction, a guard that refuses anything but SELECT,
// no schema name in the output, and never a credential on screen.
import { readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const OUT = process.env.SURVEY_OUT || new URL('../survey/herbarium.json', import.meta.url);
const COMMON_VALUES_MAX_DISTINCT = 12; // only low-cardinality text columns get "common values"

export const QUERIES = {
  version: `SELECT VERSION() AS version`,
  tables: `SELECT TABLE_NAME AS name, TABLE_TYPE AS kind, ENGINE AS engine, TABLE_ROWS AS estimated_rows,
       DATA_LENGTH AS data_bytes, INDEX_LENGTH AS index_bytes, AVG_ROW_LENGTH AS avg_row_bytes,
       AUTO_INCREMENT AS auto_increment, TABLE_COMMENT AS comment, CREATE_TIME AS created_at
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
 ORDER BY name`,
  columns: `SELECT TABLE_NAME AS table_name, ORDINAL_POSITION AS position, COLUMN_NAME AS name,
       COLUMN_TYPE AS type, DATA_TYPE AS data_type, IS_NULLABLE AS nullable,
       COLUMN_DEFAULT AS default_value, EXTRA AS extra, COLUMN_COMMENT AS comment
  FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
 ORDER BY table_name, position`,
  indexes: `SELECT TABLE_NAME AS table_name, INDEX_NAME AS name, NON_UNIQUE AS non_unique,
       SEQ_IN_INDEX AS seq, COLUMN_NAME AS column_name, INDEX_TYPE AS type, CARDINALITY AS cardinality
  FROM information_schema.STATISTICS
 WHERE TABLE_SCHEMA = DATABASE()
 ORDER BY table_name, name, seq`,
  relations: `SELECT TABLE_NAME AS table_name, CONSTRAINT_NAME AS name, COLUMN_NAME AS column_name,
       REFERENCED_TABLE_NAME AS ref_table, REFERENCED_COLUMN_NAME AS ref_column
  FROM information_schema.KEY_COLUMN_USAGE
 WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
 ORDER BY table_name, name, ORDINAL_POSITION`,
  checks: `SELECT tc.TABLE_NAME AS table_name, cc.CONSTRAINT_NAME AS name, cc.CHECK_CLAUSE AS predicate
  FROM information_schema.CHECK_CONSTRAINTS cc
  JOIN information_schema.TABLE_CONSTRAINTS tc
    ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
 WHERE cc.CONSTRAINT_SCHEMA = DATABASE()
 ORDER BY table_name, name`,
};

const ident = (name) => '`' + String(name).replaceAll('`', '``') + '`';
const MEASURABLE = new Set(['int', 'bigint', 'smallint', 'tinyint', 'mediumint', 'decimal', 'float', 'double', 'date', 'datetime', 'timestamp', 'year']);
const TEXTUAL = new Set(['varchar', 'char', 'enum', 'set']);

// One SELECT per table: distinct values and nulls for every column, min and max where they mean something.
export function columnStatsSql(table, columns) {
  const parts = [];
  for (const c of columns) {
    const col = ident(c.name);
    if (!['text', 'mediumtext', 'longtext', 'blob', 'json'].includes(c.data_type)) {
      parts.push(`COUNT(DISTINCT ${col}) AS ${ident(c.name + '.distinct')}`);
    }
    parts.push(`SUM(${col} IS NULL) AS ${ident(c.name + '.nulls')}`);
    if (MEASURABLE.has(c.data_type)) {
      parts.push(`MIN(${col}) AS ${ident(c.name + '.min')}`, `MAX(${col}) AS ${ident(c.name + '.max')}`);
    }
  }
  return `SELECT COUNT(*) AS ${ident('rows')},\n       ${parts.join(',\n       ')}\n  FROM ${ident(table)}`;
}

export function commonValuesSql(table, column, limit = 6) {
  const col = ident(column);
  return `SELECT ${col} AS value, COUNT(*) AS n\n  FROM ${ident(table)}\n GROUP BY ${col}\n ORDER BY n DESC, value\n LIMIT ${limit}`;
}

// Common values only where values repeat: a family, a collector. Unique keys and free text are skipped.
export function wantsCommonValues(dataType, distinct, filled) {
  return TEXTUAL.has(dataType) && distinct > 0 && distinct <= COMMON_VALUES_MAX_DISTINCT && distinct < filled;
}

export function assertReadOnly(sql) {
  if (!/^\s*SELECT\b/i.test(sql) || /;\s*\S/.test(sql)) throw new Error('survey guard: only single SELECT statements are allowed');
}

const toNumber = (v) => (v === null || v === undefined ? null : Number(v));
const toPlain = (v) => (v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? Number(v) : v);

// Builds the chart document from raw rows. Pure: tested without a database.
export function buildChart({ version, tables, columns, indexes, relations, checks, stats, common, log, surveyedAt }) {
  return {
    surveyedAt,
    engine: 'MySQL',
    version,
    tables: tables.map((t) => {
      const s = stats[t.name] || {};
      const cols = columns.filter((c) => c.table_name === t.name);
      const byIndex = new Map();
      for (const i of indexes.filter((i) => i.table_name === t.name)) {
        const entry = byIndex.get(i.name) || { name: i.name, primary: i.name === 'PRIMARY', unique: Number(i.non_unique) === 0, type: i.type, cardinality: toNumber(i.cardinality), columns: [] };
        entry.columns.push(i.column_name);
        byIndex.set(i.name, entry);
      }
      return {
        name: t.name,
        kind: t.kind,
        engine: t.engine,
        rows: toNumber(s.rows),
        estimatedRows: toNumber(t.estimated_rows),
        dataBytes: toNumber(t.data_bytes),
        indexBytes: toNumber(t.index_bytes),
        avgRowBytes: toNumber(t.avg_row_bytes),
        autoIncrement: toNumber(t.auto_increment),
        comment: t.comment || null,
        createdAt: toPlain(t.created_at),
        columns: cols.map((c) => ({
          position: Number(c.position),
          name: c.name,
          type: c.type,
          dataType: c.data_type,
          nullable: c.nullable === 'YES',
          default: c.default_value ?? null,
          extra: c.extra || null,
          comment: c.comment || null,
          stats: {
            distinct: toNumber(s[`${c.name}.distinct`]),
            nulls: toNumber(s[`${c.name}.nulls`]),
            min: toPlain(s[`${c.name}.min`] ?? null),
            max: toPlain(s[`${c.name}.max`] ?? null),
            common: (common[t.name]?.[c.name] || []).map((r) => ({ value: toPlain(r.value), n: Number(r.n) })),
          },
        })),
        indexes: [...byIndex.values()],
        relations: relations.filter((r) => r.table_name === t.name).map((r) => ({ name: r.name, column: r.column_name, refTable: r.ref_table, refColumn: r.ref_column })),
        checks: checks.filter((c) => c.table_name === t.name).map((c) => ({ name: c.name, predicate: c.predicate })),
      };
    }),
    log,
    totals: { queries: log.length, ms: Math.round(log.reduce((a, l) => a + l.ms, 0) * 10) / 10 },
  };
}

async function tlsOptions() {
  const caFile = process.env.SURVEY_TLS_CA;
  if (!caFile) return { rejectUnauthorized: true }; // full verification: CA and host name
  // VERIFY_CA: only this CA is trusted; the host name check is skipped because the certificate carries none.
  return { ca: await readFile(caFile, 'utf8'), rejectUnauthorized: true, checkServerIdentity: () => undefined };
}

async function main() {
  const uri = process.env.MYSQL_ADDON_URI;
  if (!uri) {
    console.error('survey: MYSQL_ADDON_URI is not set (see README, "Resurvey the database").');
    process.exit(2);
  }
  const mysql = await import('mysql2/promise');
  let conn;
  try {
    conn = await mysql.createConnection({ uri, ssl: await tlsOptions(), multipleStatements: false, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, connectTimeout: 10000 });
  } catch (err) {
    console.error(`survey: connection failed (${err.code || 'error'})`); // never print the message: it can name the user or host
    process.exit(1);
  }
  const log = [];
  const run = async (step, label, sql) => {
    assertReadOnly(sql);
    const t0 = performance.now();
    const [rows] = await conn.query(sql);
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    log.push({ step, label, sql, rows: rows.length, ms });
    return rows;
  };
  try {
    await conn.query('SET SESSION TRANSACTION READ ONLY');
    await conn.query('START TRANSACTION READ ONLY');
    const [{ version }] = await run('schema', 'Server version', QUERIES.version);
    const tables = await run('schema', 'Tables', QUERIES.tables);
    const columns = await run('schema', 'Columns', QUERIES.columns);
    const indexes = await run('schema', 'Indexes and keys', QUERIES.indexes);
    const relations = await run('schema', 'Foreign keys', QUERIES.relations);
    const checks = await run('schema', 'Check constraints', QUERIES.checks);
    const stats = {};
    const common = {};
    for (const t of tables.filter((t) => t.kind === 'BASE TABLE')) {
      const cols = columns.filter((c) => c.table_name === t.name);
      const [row] = await run('stats', `Column statistics, ${t.name}`, columnStatsSql(t.name, cols));
      stats[t.name] = row;
      common[t.name] = {};
      for (const c of cols) {
        const distinct = Number(row[`${c.name}.distinct`]);
        const filled = Number(row.rows) - Number(row[`${c.name}.nulls`]);
        if (wantsCommonValues(c.data_type, distinct, filled)) {
          common[t.name][c.name] = await run('stats', `Common values, ${t.name}.${c.name}`, commonValuesSql(t.name, c.name));
        }
      }
    }
    await conn.query('COMMIT');
    const chart = buildChart({ version, tables, columns, indexes, relations, checks, stats, common, log, surveyedAt: new Date().toISOString() });
    await writeFile(OUT, JSON.stringify(chart, null, 2) + '\n');
    const t = chart.tables;
    console.log(`survey: ${t.length} table(s), ${t.reduce((a, x) => a + x.columns.length, 0)} columns, ${log.length} SELECT in ${chart.totals.ms} ms → ${process.env.SURVEY_OUT || 'survey/herbarium.json'}`);
  } catch (err) {
    console.error(`survey: failed (${err.code || (String(err.message).startsWith('survey guard') ? err.message : 'error')})`);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();

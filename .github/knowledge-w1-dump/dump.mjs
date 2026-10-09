import { writeFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import pg from 'pg';
import { KnowledgeLibSQL } from '../../stores/libsql/dist/index.js';
import { KnowledgePG } from '../../stores/pg/dist/index.js';

const out = process.argv[2];
const file = `${out}/w1.db`;
const knowledge = new KnowledgeLibSQL({ url: `file:${file}` });
await knowledge.init();
const client = createClient({ url: `file:${file}` });
const objects = await client.execute(
  "SELECT type, name, sql FROM sqlite_master WHERE (name LIKE 'mastra_knowledge_%' OR tbl_name LIKE 'mastra_knowledge_%') AND sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name",
);
writeFileSync(`${out}/libsql.sql`, objects.rows.map(row => `${row.sql};`).join('\n') + '\n');
const columns = {};
for (const row of objects.rows.filter(r => r.type === 'table')) {
  const info = await client.execute(`PRAGMA table_info("${row.name}")`);
  columns[row.name] = info.rows.map(c => String(c.name));
}
writeFileSync(`${out}/libsql-columns.json`, JSON.stringify(columns, null, 2));
client.close();

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5434/mastra' });
await new KnowledgePG({ pool }).init();
const pgColumns = await pool.query(
  "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE 'mastra_knowledge_%' ORDER BY table_name, ordinal_position",
);
const byTable = {};
for (const r of pgColumns.rows) (byTable[r.table_name] ??= []).push(r.column_name);
writeFileSync(`${out}/pg-columns.json`, JSON.stringify(byTable, null, 2));
const idx = await pool.query("SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' AND tablename LIKE 'mastra_knowledge_%' ORDER BY indexname");
writeFileSync(`${out}/pg-indexes.json`, JSON.stringify(idx.rows, null, 2));
await pool.end();
console.log(JSON.stringify({ libsql: Object.keys(columns).length, pg: Object.keys(byTable).length }));

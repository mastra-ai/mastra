import { writeFileSync } from 'node:fs';
import { createClient } from '@libsql/client';
import pg from 'pg';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import * as libsqlPkg from '@mastra/libsql';
import * as pgPkg from '@mastra/pg';
import * as mysqlPkg from '@mastra/mysql';
import * as mongoPkg from '@mastra/mongodb';

const [out, tag] = process.argv.slice(2);
const result = { tag };

async function knowledgeFrom(Store, config) {
  const store = new Store(config);
  const knowledge = await store.getStore('knowledge');
  if (!knowledge) throw new Error('no knowledge domain');
  await knowledge.init();
  return store;
}

// LibSQL
const file = `/tmp/${tag}.db`;
await knowledgeFrom(libsqlPkg.LibSQLStore, { id: 'dump', url: `file:${file}` });
const lc = createClient({ url: `file:${file}` });
const objs = await lc.execute(
  "SELECT type, name, sql FROM sqlite_master WHERE (name LIKE 'mastra_knowledge_%' OR tbl_name LIKE 'mastra_knowledge_%') ORDER BY type, name",
);
result.libsql = { tables: {}, indexes: [], other: [], ddl: objs.rows.map(r => r.sql).filter(Boolean) };
for (const r of objs.rows) {
  if (r.type === 'table') {
    const info = await lc.execute(`PRAGMA table_info("${r.name}")`);
    result.libsql.tables[r.name] = info.rows.map(c => String(c.name));
  } else if (r.type === 'index') result.libsql.indexes.push(String(r.name));
  else result.libsql.other.push(`${r.type}:${r.name}`);
}
lc.close();

// PostgreSQL
const schema = `s_${tag.replace(/[^a-z0-9]/gi, '_')}`.toLowerCase();
const pool = new pg.Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5434/mastra' });
await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
await knowledgeFrom(pgPkg.PostgresStore, {
  id: 'dump',
  connectionString: 'postgresql://postgres:postgres@localhost:5434/mastra',
  schemaName: schema,
});
const cols = await pool.query(
  "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name LIKE 'mastra_knowledge_%' ORDER BY table_name, ordinal_position",
  [schema],
);
result.pg = { tables: {}, indexes: [] };
for (const r of cols.rows) (result.pg.tables[r.table_name] ??= []).push(r.column_name);
const idx = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname=$1 AND tablename LIKE 'mastra_knowledge_%' ORDER BY indexname", [schema]);
result.pg.indexes = idx.rows.map(r => r.indexname);
await pool.end();

// MySQL
const db = `d_${tag.replace(/[^a-z0-9]/gi, '_')}`.toLowerCase();
const root = await mysql.createConnection({ host: 'localhost', port: 3306, user: 'root', password: 'root' });
await root.query(`CREATE DATABASE IF NOT EXISTS \`${db}\``);
await root.query(`GRANT ALL ON \`${db}\`.* TO 'mastra'@'%'`);
await root.end();
const my = await knowledgeFrom(mysqlPkg.MySQLStore, { id: 'dump', host: 'localhost', port: 3306, user: 'mastra', password: 'mastra', database: db });
const conn = await mysql.createConnection({ host: 'localhost', port: 3306, user: 'mastra', password: 'mastra', database: db });
const [mcols] = await conn.query(
  "SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name LIKE 'mastra\\_knowledge\\_%' ORDER BY table_name, ordinal_position",
);
result.mysql = { tables: {}, indexes: [] };
for (const r of mcols) (result.mysql.tables[r.t] ??= []).push(r.c);
const [midx] = await conn.query(
  "SELECT DISTINCT table_name AS t, index_name AS i FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name LIKE 'mastra\\_knowledge\\_%' ORDER BY t, i",
);
result.mysql.indexes = midx.map(r => `${r.t}.${r.i}`);
await conn.end();
await my.close?.();

// MongoDB
const uri = 'mongodb://localhost:27017/?directConnection=true';
const dbName = `m_${tag.replace(/[^a-z0-9]/gi, '_')}`;
const mongo = await knowledgeFrom(mongoPkg.MongoDBStore, { id: 'dump', uri, dbName });
const client = await MongoClient.connect(uri);
result.mongodb = {};
for (const c of (await client.db(dbName).listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!c.name.startsWith('mastra_knowledge_')) continue;
  result.mongodb[c.name] = (await client.db(dbName).collection(c.name).indexes()).map(i => ({ name: i.name, key: i.key, unique: !!i.unique }));
}
await client.close();
await mongo.close?.();

writeFileSync(`${out}/${tag}.json`, JSON.stringify(result, null, 2));
console.log(tag, Object.keys(result.libsql.tables).length, Object.keys(result.pg.tables).length, Object.keys(result.mysql.tables).length, Object.keys(result.mongodb).length);

import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const fromStore = store => specifier =>
  import(pathToFileURL(createRequire(new URL(`../../stores/${store}/package.json`, import.meta.url)).resolve(specifier)).href);
const mysql = await fromStore('mysql')('mysql2/promise');
const { MongoClient } = await fromStore('mongodb')('mongodb');
import { MySQLStore } from '../../stores/mysql/dist/index.js';
import { MongoDBStore } from '../../stores/mongodb/dist/index.js';

const out = process.argv[2];
const my = new MySQLStore({ id: 'dump', host: 'localhost', port: 3306, user: 'mastra', password: 'mastra', database: 'mastra' });
await (await my.getStore('knowledge')).init();
const pool = mysql.createPool({ host: 'localhost', port: 3306, user: 'mastra', password: 'mastra', database: 'mastra' });
const [cols] = await pool.query(
  "SELECT table_name AS t, column_name AS c, column_type AS ty, is_nullable AS n FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name LIKE 'mastra\\_knowledge\\_%' ORDER BY table_name, ordinal_position",
);
const byTable = {};
for (const r of cols) (byTable[r.t] ??= []).push(r.c);
writeFileSync(`${out}/mysql-columns.json`, JSON.stringify(byTable, null, 2));
writeFileSync(`${out}/mysql-column-types.json`, JSON.stringify(cols, null, 2));
const [idx] = await pool.query(
  "SELECT DISTINCT table_name AS t, index_name AS i FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name LIKE 'mastra\\_knowledge\\_%' ORDER BY t, i",
);
writeFileSync(`${out}/mysql-indexes.json`, JSON.stringify(idx, null, 2));
const ddl = [];
for (const t of Object.keys(byTable)) {
  const [[row]] = await pool.query(`SHOW CREATE TABLE \`${t}\``);
  ddl.push(`${row['Create Table']};`);
}
writeFileSync(`${out}/mysql.sql`, ddl.join('\n\n') + '\n');
const [objs] = await pool.query(
  "SELECT 'view' AS k, table_name AS n FROM information_schema.views WHERE table_schema=DATABASE() UNION ALL SELECT 'trigger', trigger_name FROM information_schema.triggers WHERE trigger_schema=DATABASE()",
);
writeFileSync(`${out}/mysql-other-objects.json`, JSON.stringify(objs, null, 2));
await pool.end();
await my.close();

const uri = 'mongodb://localhost:27017/?directConnection=true';
const mongo = new MongoDBStore({ id: 'dump', uri, dbName: 'w1dump' });
await (await mongo.getStore('knowledge')).init();
const client = await MongoClient.connect(uri);
const db = client.db('w1dump');
const result = {};
for (const c of (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!c.name.startsWith('mastra_knowledge_')) continue;
  result[c.name] = { options: c.options, indexes: await db.collection(c.name).indexes() };
}
writeFileSync(`${out}/mongodb.json`, JSON.stringify(result, null, 2));
await client.close();
await mongo.close?.();
console.log(JSON.stringify({ mysql: Object.keys(byTable).length, mongodb: Object.keys(result).length }));

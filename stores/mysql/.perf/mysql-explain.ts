// EXPLAIN QUERY PLAN harness for the LibSQL Knowledge page store on seeded multi-tenant data.
// Run from stores/libsql: npx tsx <this file> <out.txt>
import { writeFileSync } from 'node:fs';
import { createPool } from 'mysql2/promise';
import { KNOWLEDGE_PAGE_DDL, MySQLKnowledgePages } from '../src/storage/domains/knowledge/pages';

const ORGS = 8;
const THREADS_PER_ORG = 500; // 4,000 thread scopes
const PAGES_PER_THREAD = 3; // 12,000 thread pages
const PINS = 400;
const out: string[] = [];
const log = (s: string) => out.push(s);

const pool = createPool({ host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'mastra', connectionLimit: 4, multipleStatements: false });
await pool.query('DROP DATABASE IF EXISTS perf');
await pool.query('CREATE DATABASE perf');
await pool.query('USE perf');
await pool.end();
const db = createPool({ host: 'localhost', port: 3306, user: 'root', password: 'root', database: 'perf', connectionLimit: 4 });
for (const ddl of KNOWLEDGE_PAGE_DDL) await db.query(ddl);

const raw = (c: any) => ({
  async execute(st: { sql: string; args?: unknown[] }) {
    const [result] = await c.query(st.sql, st.args ?? []);
    return { rows: Array.isArray(result) ? (result as any[]) : [] };
  },
});
const client = raw(db);
const now = new Date().toISOString();
const prov = JSON.stringify({ author: 'seed' });
const cols =
  'id,scopeId,isScope,address,declaration,`key`,parentId,position,path,depth,name,canonicalName,description,body,version,createdBy,updatedBy,createdAt,updatedAt';
async function insert(rows: unknown[][]) {
  const ph = `(${cols.split(',').map(() => '?').join(',')})`;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await client.execute({
      sql: `INSERT INTO mastra_knowledge_pages (${cols}) VALUES ${chunk.map(() => ph).join(',')}`,
      args: chunk.flat() as never[],
    });
  }
}
const scopeRow = (id: string, address: string, declaration: string, parentId: string | null, path: string) => [
  id, id, 1, address, declaration, null, parentId, 'a0', path, 0, address, address.toLowerCase(), null, null, 1, prov, prov, now, now,
];
const pageRow = (id: string, scopeId: string, scopePath: string, key: string, name: string) => [
  id, scopeId, 0, null, null, key, scopeId, 'a0', `${scopePath}${id}/`, 1, name, name.toLowerCase(), null, `body of ${name}`, 1, prov, prov, now, now,
];

const scopes: unknown[][] = [];
const pages: unknown[][] = [];
const pageIds: string[] = [];
for (let o = 0; o < ORGS; o++) {
  const orgId = `org${o}`;
  scopes.push(scopeRow(orgId, `org:${orgId}`, 'org', null, `/${orgId}/`));
  for (let t = 0; t < THREADS_PER_ORG; t++) {
    const tid = `${orgId}-t${t}`;
    scopes.push(scopeRow(tid, `org:${orgId}/thread:t${t}`, 'thread', orgId, `/${tid}/`));
    for (let p = 0; p < PAGES_PER_THREAD; p++) {
      const pid = `${tid}-p${p}`;
      pageIds.push(pid);
      pages.push(pageRow(pid, tid, `/${tid}/`, `k${p}`, `Page ${t}-${p} ${p === 0 ? 'refund' : 'note'}`));
    }
  }
}
await insert(scopes);
await insert(pages);
for (let i = 0; i < PINS; i++) {
  await client.execute({
    sql: `INSERT INTO mastra_knowledge_pins (id,pageId,audience,createdBy,createdAt,updatedAt) VALUES (?,?,?,?,?,?)`,
    args: [`pin${i}`, pageIds[i * 29]!, JSON.stringify([`org:org${i % 8}`, `role:org${i % 8}:r${i % 5}`]), prov, now, now],
  });
  const hasAud = ((await db.query(`SHOW TABLES LIKE 'mastra_knowledge_pin_audiences'`)) as any)[0].length > 0;
  if (hasAud)
    for (const a of [`org:org${i % 8}`, `role:org${i % 8}:r${i % 5}`])
      await client.execute({ sql: `INSERT INTO mastra_knowledge_pin_audiences (audience,pinId) VALUES (?,?)`, args: [a, `pin${i}`] });
}
// two notes per hundredth page, stamped with the page's scope
for (let i = 0; i < pageIds.length; i += 100) {
  const pid = pageIds[i]!;
  const scope = pid.replace(/-p\d+$/, '');
  await client.execute({
    sql: `INSERT INTO mastra_knowledge_notes (id,pageId,text,provenance,version,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?)`,
    args: [`n${i}`, pid, 'refund policy note', prov, 1, now, now],
  });
  await client.execute({ sql: `INSERT INTO mastra_knowledge_note_stamps (noteId,scopeId) VALUES (?,?)`, args: [`n${i}`, scope] });
}

let label = '';
const explain = async (executor: { execute: (s: any) => Promise<any> }, statement: any) => {
  const st = typeof statement === 'string' ? { sql: statement, args: [] } : statement;
  if (/^\s*(SELECT|UPDATE|INSERT|DELETE|WITH)/i.test(st.sql) && !/^\s*INSERT/i.test(st.sql)) {
    const plan = await executor.execute({ sql: `EXPLAIN FORMAT=TREE ${st.sql}`, args: st.args ?? [] });
    log(`-- [${label}]\n${st.sql.replace(/\s+/g, ' ').slice(0, 400)}\n${plan.rows.map(r => String(Object.values(r)[0])).join('\n')}\n`);
  }
  return executor.execute(statement);
};
const read = { execute: (s: any) => explain(client, s) };
const transaction = async <T>(op: (tx: any) => Promise<T>) => {
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const result = await op({ execute: (st: any) => explain(raw(c), st) });
    await c.commit();
    return result;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
};
const store = new MySQLKnowledgePages({ read: read as never, transaction: transaction as never });

const readScope = {
  addresses: ['org:org3'],
  prefixes: [{ declaration: 'thread', prefix: 'org:org3/thread:' }],
  children: [{ declaration: 'thread', parentId: 'org3' }],
} as never;
const prefixOnly = { addresses: [], prefixes: [{ declaration: 'thread', prefix: 'org:org3/thread:' }], children: [] } as never;

label = 'listPages (read scope, org3)';
await store.listPages({ read: readScope, limit: 50 });
label = 'listPages scopeId (one thread)';
await store.listPages({ read: prefixOnly, scopeId: 'org3-t7', limit: 50 });
label = 'listPages prefix-only';
await store.listPages({ read: prefixOnly, limit: 50 });
label = 'listPages namePrefix';
await store.listPages({ read: prefixOnly, namePrefix: 'page 1', limit: 50 });
label = 'searchPages';
await store.searchPages({ read: prefixOnly, query: 'refund', limit: 20 } as never);
label = 'listPins';
await store.listPins({ audience: 'all', read: prefixOnly, limit: 50 } as never);
label = 'listPins audience (one org+role)';
await store.listPins({ audience: ['org:org3', 'role:org3:r2'], read: prefixOnly, limit: 50 } as never);
label = 'listNotes';
await store.listNotes({ pageId: 'org3-t0-p0', read: prefixOnly, limit: 50 } as never).catch(e => log(`listNotes: ${e}`));
label = 'movePage (rehome subtree)';
await store
  .movePage({ id: 'org3-t0-p1', parentId: 'org3-t0-p0', expectedVersion: 1, provenance: { author: 'x' } } as never)
  .catch(e => log(`movePage: ${e}`));
label = 'mergePages (subtree count)';
await store
  .mergePages({ sourceId: 'org3-t1-p0', targetId: 'org3-t1-p1', sourceVersion: 1, provenance: { author: 'x' } } as never)
  .catch(e => log(`mergePages: ${e}`));

writeFileSync(process.argv[2]!, out.join('\n'));
await db.end();
console.log(`wrote ${process.argv[2]} (${out.length} entries)`);

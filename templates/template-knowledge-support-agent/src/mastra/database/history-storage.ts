import { createClient } from '@libsql/client';
import type { LibSQLStore } from '@mastra/libsql';
import type { KnowledgeReadScope } from '@mastra/core/knowledge';
import { PostgresStore, type DbClient } from '@mastra/pg';
import type { StoreConfiguration } from './store.ts';

type Value = string | number;
type Query = <Row>(sql: string, values: Value[]) => Promise<Row[]>;
export type OpenHistoryStorage = () => ReturnType<typeof historyStorage> & { close: () => void };
export type PageLocation = {
  id: string;
  parentId: string | null;
  key: string | null;
  version: number;
};
type CandidatePage = PageLocation & { body: string | null; bodyOmitted: number };
type HistoryScope = { scopeId: string; read: KnowledgeReadScope };

export function postgresQuery(db: Pick<DbClient, 'manyOrNone'>): Query {
  return (sql, values) => db.manyOrNone(sql, values);
}

export function libsqlQuery(db: Pick<ReturnType<typeof createClient>, 'execute'>): Query {
  return async <Row>(sql: string, values: Value[]) =>
    (await db.execute({ sql: sql.replace(/\$(\d+)/gu, '?$1'), args: values })).rows as unknown as Row[];
}

export function historyStorageOpener(
  store: LibSQLStore | PostgresStore,
  configuration: StoreConfiguration,
): OpenHistoryStorage {
  if (configuration.backend === 'postgres') {
    if (!(store instanceof PostgresStore)) throw new Error('Expected the PostgreSQL Knowledge store');
    const storage = historyStorage(postgresQuery(store.db), 'postgres');
    return () => ({ ...storage, close() {} });
  }
  return () => {
    const client = createClient({ url: configuration.url, authToken: configuration.authToken });
    return { ...historyStorage(libsqlQuery(client), 'libsql'), close: () => client.close() };
  };
}

/** The native adapters return full bodies from search and listing. Project only history fields in SQL. */
export function historyStorage(query: Query, backend: StoreConfiguration['backend']) {
  const schema = backend === 'postgres' ? '"public".' : '';
  const pages = `${schema}"mastra_knowledge_pages"`;
  const notes = `${schema}"mastra_knowledge_notes"`;
  const stamps = `${schema}"mastra_knowledge_note_stamps"`;
  const mentions = `${schema}"mastra_knowledge_mentions"`;

  function scoped({ scopeId, read }: HistoryScope) {
    const values: Value[] = [];
    const bind = (value: Value) => `$${values.push(value)}`;
    const scope = bind(scopeId);
    // Use the grants resolved by Knowledge. Exact, prefix, and child grants use case-sensitive comparisons.
    const grants =
      read === 'all'
        ? []
        : [
            ...(read.addresses.length ? [`s."address" IN (${read.addresses.map(bind).join(', ')})`] : []),
            ...read.prefixes.map(({ declaration, prefix }) => {
              const start = bind(prefix);
              return `(s."declaration" = ${bind(declaration)} AND substr(s."address", 1, length(${start})) = ${start})`;
            }),
            ...read.children.map(
              ({ declaration, parentId }) =>
                `(s."declaration" = ${bind(declaration)} AND s."parentId" = ${bind(parentId)})`,
            ),
          ];
    const scopes = `readable AS (
      SELECT s."id" FROM ${pages} s WHERE s."isScope"
      ${read === 'all' ? '' : `AND (${grants.join(' OR ') || 'FALSE'})`}
    )`;
    const live = `p."scopeId" = ${scope} AND p."scopeId" IN (SELECT "id" FROM readable)
      AND NOT p."isScope" AND p."deletedAt" IS NULL`;
    return { values, bind, scopes, live };
  }

  const columns = 'p."id", p."parentId", p."key", p."version"';
  return {
    async search(scope: HistoryScope, terms: string, limit: number) {
      const { values, bind, scopes, live } = scoped(scope);
      // Each preflight query is one normalized word or topic tag. Rank name, description, then body.
      const needle = bind(terms);
      const limitParam = `$${values.length + 1}`;
      const match = (column: string) =>
        backend === 'postgres' ? `strpos(lower(${column}), ${needle}) > 0` : `instr(lower(${column}), ${needle}) > 0`;
      const hits = await query<{ pageId: string; noteId?: string }>(
        `WITH ${scopes}
         SELECT p."id" AS "pageId" FROM ${pages} p
         WHERE ${live} AND (${match('p."name"')} OR ${match('p."description"')} OR ${match('p."body"')})
         ORDER BY CASE WHEN ${match('p."canonicalName"')} THEN 0 ELSE 1 END,
           CASE WHEN ${match('p."name"')} THEN 0 WHEN ${match('p."description"')} THEN 1 ELSE 2 END,
           p."updatedAt" DESC, p."id"
         LIMIT ${limitParam}`,
        [...values, limit],
      );
      if (hits.length === limit) return hits;
      // Native note visibility requires a readable home, a readable stamp, and no unreadable mention.
      const noteHits = await query<{ pageId: string; noteId: string }>(
        `WITH ${scopes}
         SELECT p."id" AS "pageId", n."id" AS "noteId"
         FROM ${notes} n JOIN ${pages} p ON p."id" = n."pageId"
         WHERE ${live} AND n."deletedAt" IS NULL AND ${match('n."text"')}
           AND EXISTS (SELECT 1 FROM ${stamps} st WHERE st."noteId" = n."id" AND st."scopeId" IN (SELECT "id" FROM readable))
           AND NOT EXISTS (SELECT 1 FROM ${mentions} m JOIN ${pages} mp ON mp."id" = m."pageId"
             WHERE m."noteId" = n."id" AND mp."scopeId" NOT IN (SELECT "id" FROM readable))
         ORDER BY n."updatedAt" DESC, n."id" DESC
         LIMIT ${limitParam}`,
        [...values, limit - hits.length],
      );
      return [...hits, ...noteHits];
    },
    list(scope: HistoryScope, limit: number) {
      const { values, bind, scopes, live } = scoped(scope);
      return query<{ id: string }>(
        `WITH ${scopes}
         SELECT p."id" FROM ${pages} p WHERE ${live} ORDER BY p."name", p."id" LIMIT ${bind(limit)}`,
        values,
      );
    },
    locations(scope: HistoryScope, ids: string[]) {
      if (!ids.length) return Promise.resolve([]);
      const { values, bind, scopes, live } = scoped(scope);
      return query<PageLocation>(
        `WITH ${scopes}
         SELECT ${columns} FROM ${pages} p WHERE ${live} AND p."id" IN (${ids.map(bind).join(', ')})`,
        values,
      );
    },
    candidates(scope: HistoryScope, ids: string[], pageLimit: number, remainingBytes: number) {
      const { values, bind, scopes, live } = scoped(scope);
      const requested = ids.map((id, index) => `(${bind(id)}, ${index})`).join(', ');
      const blobBytes = 'length(CAST(p."body" AS BLOB))';
      // SQLite can open a UTF-16 file. Budget conservatively for the driver's UTF-8 text in that case.
      const byteLength =
        backend === 'postgres'
          ? `CASE WHEN current_setting('server_encoding') = 'UTF8' THEN octet_length(p."body")
             ELSE octet_length(convert_to(p."body", 'UTF8')) END`
          : `CASE WHEN length(CAST('x' AS BLOB)) = 2 THEN ${blobBytes} * 3 / 2 ELSE ${blobBytes} END`;
      const perPage = bind(Math.min(pageLimit, remainingBytes));
      const budget = bind(remainingBytes);
      // Count only eligible bodies in priority order, then guard the projection in the same statement.
      // A concurrent edit cannot increase the amount transferred after the length check.
      return query<CandidatePage>(
        `WITH ${scopes}, requested(id, priority) AS (VALUES ${requested}),
         sizes AS (
           SELECT p."id", r.priority, COALESCE(${byteLength}, 0) AS bytes
           FROM ${pages} p JOIN requested r ON r.id = p."id" WHERE ${live}
         ), bounded AS (
           SELECT "id", bytes, SUM(CASE WHEN bytes <= ${perPage} THEN bytes ELSE 0 END)
             OVER (ORDER BY priority) AS used FROM sizes
         )
         SELECT ${columns}, CASE WHEN b.bytes <= ${perPage} AND b.used <= ${budget} THEN p."body" END AS "body",
           CASE WHEN b.bytes > 0 AND (b.bytes > ${perPage} OR b.used > ${budget}) THEN 1 ELSE 0 END AS "bodyOmitted"
         FROM bounded b JOIN ${pages} p ON p."id" = b."id"`,
        values,
      );
    },
  };
}

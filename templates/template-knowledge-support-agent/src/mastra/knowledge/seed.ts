import { createClient, type Client } from '@libsql/client';
import type { DbClient } from '@mastra/pg';
import {
  knowledgeLinkRefKey,
  type Knowledge,
  type KnowledgeNote,
  type KnowledgePage,
  type KnowledgePageBodyLink,
  type KnowledgeStorage,
  type KnowledgeUpsertPageResult,
} from '@mastra/core/knowledge';
import { policyReference } from '../../examples/support.ts';
import { createStore } from '../database/store.ts';
import { createKnowledge, createPostgresWriterKnowledge } from './index.ts';
import { withWriterLock, type WriterContext } from './writer-lock.ts';
import { upsertPageAtRevision } from './versioned-page.ts';
import {
  prepareDataset,
  validatePreparedPolicies,
  type DatasetConfiguration,
  type PreparedDataset,
  type PreparedNote,
  type PreparedPage,
} from './seed-manifest.ts';
import { reportRetainedSeedRecords } from './seed-retention.ts';

export interface SeedOptions {
  dryRun?: boolean;
  databaseUrl?: string;
  reportRetention?: boolean;
  policyApprovalFile?: string;
}
export interface SeedReport {
  dataset: string;
  version: string;
  dryRun: boolean;
  pages: {
    key: string;
    destination: string;
    status: 'planned' | 'created' | 'updated' | 'unchanged';
    id?: string;
    version?: number;
  }[];
  notes: {
    pageKey: string;
    key: string;
    status: 'planned' | 'created' | 'updated' | 'unchanged' | 'repaired';
    id?: string;
  }[];
  retained: string[];
  repairedLinks: boolean;
}

async function allNotes(storage: KnowledgeStorage, pageId: string) {
  const result: KnowledgeNote[] = [];
  let cursor: string | undefined;
  do {
    const batch = await storage.listNotes({ pageId, read: 'all', cursor, limit: 100 });
    result.push(...batch.notes);
    cursor = batch.nextCursor;
  } while (cursor);
  return result;
}
function ownedPage(page: KnowledgePage, wanted: PreparedPage, author: string) {
  if (page.createdBy.author !== author) return false;
  if (page.body?.split('\n')[0] === wanted.marker) return true;
  // Native upsert creates blank parent scaffolding. It is safe to fill only our own blank scaffold.
  return !page.body && !page.description && page.name === page.key;
}
function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sortedB = [...b].sort();
  return [...a].sort().every((value, index) => value === sortedB[index]);
}
function exactNote(note: KnowledgeNote, wanted: PreparedNote, scopeId: string, mentions: string[], author: string) {
  return (
    note.text === wanted.text &&
    note.when?.getTime() === wanted.when?.getTime() &&
    sameSet(note.stampScopeIds, [scopeId]) &&
    sameSet(note.mentions, mentions) &&
    note.provenance.author === author
  );
}

type SeedLinkDatabase = { postgres: DbClient } | { libsql: Client };

// Native link traversal only reports resolved, visible edges. Seed repair needs the stored rows.
async function readBodyLinkRows(database: SeedLinkDatabase, pageId: string, limit: number) {
  if ('postgres' in database)
    return database.postgres.manyOrNone<KnowledgePageBodyLink>(
      `SELECT "ref", "toPageId", "count" FROM "public"."mastra_knowledge_page_links" WHERE "fromPageId" = $1 LIMIT $2`,
      [pageId, limit],
    );
  const { rows } = await database.libsql.execute({
    sql: `SELECT "ref", "toPageId", "count" FROM "mastra_knowledge_page_links" WHERE "fromPageId" = ? LIMIT ?`,
    args: [pageId, limit],
  });
  return rows.map(row => ({
    ref: String(row.ref),
    toPageId: row.toPageId === null ? null : String(row.toPageId),
    count: Number(row.count),
  }));
}

async function writeDataset(
  knowledge: Knowledge,
  dataset: PreparedDataset,
  report: SeedReport,
  reportRetention: boolean,
  context: WriterContext,
  database: SeedLinkDatabase,
  initialize = false,
) {
  const storage = await knowledge.getStorage();
  const author = `seed:${dataset.id}`;
  const scopes = new Map(
    (await storage.getScopesByAddress([...new Set(dataset.pages.map(page => page.scope))])).map(scope => [
      scope.address!,
      scope,
    ]),
  );
  // Read every target before writes so a collision cannot leave earlier pages partially overwritten.
  const scanned = new Map<PreparedPage, KnowledgePage | null>();
  for (const wanted of dataset.pages) {
    const scope = scopes.get(wanted.scope);
    const existing =
      scope && (await storage.getPageByPath({ scopeId: scope.id, path: wanted.path.split('/'), read: 'all' }));
    if (existing && !ownedPage(existing, wanted, author))
      throw new Error(`Destination is not owned by this seed: ${wanted.scope}#${wanted.path}`);
    scanned.set(wanted, existing ?? null);
  }
  const written = new Map<string, KnowledgeUpsertPageResult>();
  // Write managed parents before their children so a child cannot create a managed parent as scaffolding.
  const ordered = [...dataset.pages].sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  for (const wanted of ordered) {
    const { scope, path, name, description, body } = wanted;
    const existing = scanned.get(wanted) ?? null;
    if (initialize && wanted.requiredPolicyFile && existing?.body && existing.body !== body) {
      // Preserve policy revisions deployed before the initialization marker was introduced.
      written.set(`${scope}#${path}`, { status: 'unchanged', page: existing });
      continue;
    }
    const result = await upsertPageAtRevision(
      knowledge,
      storage,
      { scope, path, name, description, body, author },
      existing,
      undefined,
      context.postgres,
    );
    written.set(`${wanted.scope}#${wanted.path}`, result);
  }
  for (const wanted of dataset.pages) {
    const destination = `${wanted.scope}#${wanted.path}`;
    const result = written.get(destination)!;
    report.pages.push({
      key: wanted.key,
      destination,
      status: result.status,
      id: result.page.id,
      version: result.page.version,
    });
  }
  // Verify managed links after all their destinations exist. Repair only the seed's own pages.
  for (const wanted of dataset.pages) {
    const { page: current } = written.get(`${wanted.scope}#${wanted.path}`)!;
    if (initialize && wanted.requiredPolicyFile && current.body !== wanted.body) continue;
    const links = [...wanted.links].map(([ref, count]) => ({
      ref: knowledgeLinkRefKey(ref),
      toPageId: written.get(ref)!.page.id,
      count,
    }));
    const expected = new Map(links.map(link => [link.ref, link]));
    async function indexMatches() {
      const indexed = await readBodyLinkRows(database, current.id, expected.size + 1);
      return (
        indexed.length === expected.size &&
        indexed.every(row => {
          const wanted = expected.get(row.ref);
          return wanted?.toPageId === row.toPageId && wanted.count === row.count;
        })
      );
    }
    if (!(await indexMatches())) {
      await storage.replacePageBodyLinks({ pageId: current.id, links });
      if (!(await indexMatches())) throw new Error('Knowledge link index repair did not converge');
      report.repairedLinks = true;
    }
    const existing = wanted.notes.length ? await allNotes(storage, current.id) : [];
    for (const note of wanted.notes) {
      const owned = existing.filter(
        item => item.text.split('\n')[0] === note.marker && item.provenance.author === author,
      );
      const mentions = note.refs.map(ref => written.get(ref)!.page.id);
      let kept = owned.find(item => exactNote(item, note, current.scopeId, mentions, author));
      let status: SeedReport['notes'][number]['status'] = 'unchanged';
      if (!kept) {
        kept = await storage.addNote({
          pageId: current.id,
          text: note.text,
          when: note.when,
          stampScopeIds: [current.scopeId],
          mentions,
          provenance: { author },
        });
        status = owned.length ? 'updated' : 'created';
      }
      const duplicates = owned.filter(item => item.id !== kept.id);
      for (const duplicate of duplicates) await knowledge.removeNote({ id: duplicate.id, author });
      if (status === 'unchanged' && duplicates.length) status = 'repaired';
      report.notes.push({ pageKey: wanted.key, key: note.key, status, id: kept.id });
    }
  }
  if (!reportRetention) return;
  const selectedNotes = new Map(
    dataset.pages.map(wanted => [
      written.get(`${wanted.scope}#${wanted.path}`)!.page.id,
      new Set(wanted.notes.map(note => note.marker)),
    ]),
  );
  report.retained = await reportRetainedSeedRecords(storage, dataset.id, selectedNotes, context);
}

function seedReport(dataset: PreparedDataset, dryRun = false): SeedReport {
  return {
    dataset: dataset.id,
    version: dataset.version,
    dryRun,
    pages: [],
    notes: [],
    retained: [],
    repairedLinks: false,
  };
}

async function withSeedDatabase<T>(
  context: WriterContext,
  operation: (knowledge: Knowledge, database: SeedLinkDatabase) => Promise<T>,
): Promise<T> {
  const { libsql, postgres } = context;
  if (postgres) return operation(createPostgresWriterKnowledge(postgres, true), { postgres });
  const store = createStore('knowledge-seed', libsql);
  try {
    const client = createClient({ url: libsql.url, authToken: libsql.authToken });
    try {
      return await operation(createKnowledge(store), { libsql: client });
    } finally {
      client.close();
    }
  } finally {
    await store.close();
  }
}

/** CLI and deterministic checks use this same path. Validation and dry-run never initialize storage. */
export async function seedDataset(config: DatasetConfiguration, options: SeedOptions = {}): Promise<SeedReport> {
  const dataset = await prepareDataset(config, policyReference, options.policyApprovalFile);
  const report = seedReport(dataset, options.dryRun);
  if (options.dryRun) {
    report.pages = dataset.pages.map(page => ({
      key: page.key,
      destination: `${page.scope}#${page.path}`,
      status: 'planned',
    }));
    report.notes = dataset.pages.flatMap(page =>
      page.notes.map(note => ({ pageKey: page.key, key: note.key, status: 'planned' })),
    );
    return report;
  }
  return withWriterLock(async context => {
    await validatePreparedPolicies(dataset, options.policyApprovalFile);
    await withSeedDatabase(context, (knowledge, database) =>
      writeDataset(knowledge, dataset, report, options.reportRetention ?? true, context, database),
    );
    return report;
  }, options.databaseUrl);
}

async function hasSeedInitialization(database: SeedLinkDatabase, id: string) {
  const table = 'support_seed_initializations';
  if ('postgres' in database) {
    await database.postgres.none(`CREATE TABLE IF NOT EXISTS public.${table} (dataset_id TEXT PRIMARY KEY)`);
    return !!(await database.postgres.oneOrNone(`SELECT dataset_id FROM public.${table} WHERE dataset_id = $1`, [id]));
  }
  await database.libsql.execute(`CREATE TABLE IF NOT EXISTS ${table} (dataset_id TEXT PRIMARY KEY)`);
  const { rows } = await database.libsql.execute({
    sql: `SELECT dataset_id FROM ${table} WHERE dataset_id = ?`,
    args: [id],
  });
  return rows.length > 0;
}

/** Run the bundled seed only until initialization succeeds for this database and dataset. */
export async function seedDatasetOnce(
  config: DatasetConfiguration,
  options: Pick<SeedOptions, 'databaseUrl' | 'policyApprovalFile'> = {},
) {
  await withWriterLock(
    context =>
      withSeedDatabase(context, async (knowledge, database) => {
        if (await hasSeedInitialization(database, config.id)) return;
        const dataset = await prepareDataset(config, policyReference, options.policyApprovalFile);
        await writeDataset(knowledge, dataset, seedReport(dataset), false, context, database, true);
        if ('postgres' in database)
          await database.postgres.none('INSERT INTO public.support_seed_initializations (dataset_id) VALUES ($1)', [
            config.id,
          ]);
        else
          await database.libsql.execute({
            sql: 'INSERT INTO support_seed_initializations (dataset_id) VALUES (?)',
            args: [config.id],
          });
      }),
    options.databaseUrl,
  );
}

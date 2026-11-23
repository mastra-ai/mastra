import {
  knowledgeLinkRefKey,
  type Knowledge,
  type KnowledgeNote,
  type KnowledgePage,
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

async function writeDataset(
  knowledge: Knowledge,
  dataset: PreparedDataset,
  report: SeedReport,
  reportRetention: boolean,
  context: WriterContext,
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
    const result = await upsertPageAtRevision(
      knowledge,
      storage,
      { scope, path, name, description, body, author },
      scanned.get(wanted)!,
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
    const links = [...wanted.links].map(([ref, count]) => ({
      ref: knowledgeLinkRefKey(ref),
      toPageId: written.get(ref)!.page.id,
      count,
    }));
    const expected = new Map(
      links.filter(link => link.toPageId !== current.id).map(link => [link.toPageId, link.count]),
    );
    async function indexMatches() {
      const indexed = await storage.listPageLinks({
        pageIds: [current.id],
        read: 'all',
        direction: 'out',
        kinds: ['body'],
        limit: 1000,
      });
      return indexed.length === expected.size && indexed.every(edge => expected.get(edge.toPageId) === edge.count);
    }
    const unexpectedReferences =
      wanted.unexpectedBodyRefs.length &&
      (await storage.listPageBodyLinkSources({ refs: wanted.unexpectedBodyRefs })).includes(current.id);
    if (unexpectedReferences || !(await indexMatches())) {
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

/** CLI and deterministic checks use this same path. Validation and dry-run never initialize storage. */
export async function seedDataset(config: DatasetConfiguration, options: SeedOptions = {}): Promise<SeedReport> {
  const dataset = await prepareDataset(config, policyReference, options.policyApprovalFile);
  const report: SeedReport = {
    dataset: dataset.id,
    version: dataset.version,
    dryRun: !!options.dryRun,
    pages: [],
    notes: [],
    retained: [],
    repairedLinks: false,
  };
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
    const { libsql, postgres } = context;
    if (postgres) {
      await writeDataset(
        createPostgresWriterKnowledge(postgres, true),
        dataset,
        report,
        options.reportRetention ?? true,
        context,
      );
      return report;
    }
    const store = createStore('knowledge-seed', libsql);
    try {
      await writeDataset(createKnowledge(store), dataset, report, options.reportRetention ?? true, context);
      return report;
    } finally {
      await store.close();
    }
  }, options.databaseUrl);
}

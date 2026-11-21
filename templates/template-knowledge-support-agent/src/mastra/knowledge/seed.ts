import {
  KnowledgeConflictError,
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
import { withWriterLock } from './writer-lock.ts';
import {
  prepareDataset,
  type DatasetConfiguration,
  type PreparedDataset,
  type PreparedNote,
  type PreparedPage,
} from './seed-manifest.ts';

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

async function writePage(
  knowledge: Knowledge,
  storage: KnowledgeStorage,
  wanted: PreparedPage,
  scanned: KnowledgePage | null,
  author: string,
): Promise<KnowledgeUpsertPageResult> {
  const destination = `${wanted.scope}#${wanted.path}`;
  const path = wanted.path.split('/');
  // Abort the native retry on a leaf conflict. The native upsert still manages scope, parent and link writes.
  const conflict = new Error(`Seed destination changed: ${destination}`);
  const createPage: KnowledgeStorage['createPage'] = async input => {
    if (input.body === undefined) return storage.createPage(input); // Native parent scaffolding.
    if (scanned) throw conflict;
    const [scope] = await storage.getScopesByAddress([wanted.scope]);
    const parent =
      scope && path.length > 1
        ? await storage.getPageByPath({ scopeId: scope.id, path: path.slice(0, -1), read: 'all' })
        : scope;
    if (parent?.id !== input.parentId) throw conflict;
    try {
      return await storage.createPage(input);
    } catch (error) {
      if ((error as Error)?.name === 'KnowledgePageKeyConflictError') throw conflict;
      throw error;
    }
  };
  const updatePage: KnowledgeStorage['updatePage'] = async input => {
    if (!scanned || input.id !== scanned.id || input.expectedVersion !== scanned.version) throw conflict;
    // Moving an ancestor can change the destination without bumping the leaf version.
    const current = await storage.getPageByPath({ scopeId: scanned.scopeId, path, read: 'all' });
    if (current?.id !== scanned.id || current.version !== scanned.version) throw conflict;
    try {
      return await storage.updatePage(input);
    } catch (error) {
      if (['KnowledgeNotFoundError', 'KnowledgeConflictError'].includes((error as Error)?.name)) throw conflict;
      throw error;
    }
  };
  const checkedStorage = new Proxy(storage, {
    get(target, property) {
      if (property === 'createPage') return createPage;
      if (property === 'updatePage') return updatePage;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  // This Knowledge instance is private to the seed. Limit the guard to one native upsert.
  const getStorage = knowledge.getStorage;
  knowledge.getStorage = async () => checkedStorage;
  try {
    const { scope, path, name, description, body } = wanted;
    const result = await knowledge.upsertPage({ scope, path, name, description, body, author });
    if (
      result.status === 'unchanged' &&
      (!scanned || result.page.id !== scanned.id || result.page.version !== scanned.version)
    )
      throw conflict;
    return result;
  } catch (error) {
    if (error === conflict) throw new KnowledgeConflictError(destination);
    throw error;
  } finally {
    knowledge.getStorage = getStorage;
  }
}

async function writeDataset(
  knowledge: Knowledge,
  dataset: PreparedDataset,
  report: SeedReport,
  reportRetention: boolean,
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
    const result = await writePage(knowledge, storage, wanted, scanned.get(wanted)!, author);
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
  const selectedIds = new Set([...written.values()].map(({ page }) => page.id));
  const selectedNotes = new Set(dataset.pages.flatMap(page => page.notes.map(note => note.marker)));
  const pagePrefix = `<!-- knowledge-seed:page:${dataset.id}:`;
  const notePrefix = `Seed note: ${dataset.id}/`;
  let cursor: string | undefined;
  do {
    const batch = await storage.listPages({ read: 'all', cursor, limit: 100 });
    const noteCounts = await storage.countNotes({ pageIds: batch.pages.map(page => page.id), read: 'all' });
    for (const page of batch.pages) {
      if (page.createdBy.author === author && page.body?.startsWith(pagePrefix) && !selectedIds.has(page.id))
        report.retained.push(`page:${page.id}`);
      if (!noteCounts[page.id]) continue;
      for (const note of await allNotes(storage, page.id)) {
        const marker = note.text.split('\n')[0]!;
        if (
          note.provenance.author === author &&
          marker.startsWith(notePrefix) &&
          (!selectedIds.has(page.id) || !selectedNotes.has(marker))
        )
          report.retained.push(`note:${note.id}`);
      }
    }
    cursor = batch.nextCursor;
  } while (cursor);
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
  return withWriterLock(async ({ libsql, postgres }) => {
    if (postgres) {
      await writeDataset(
        createPostgresWriterKnowledge(postgres, true),
        dataset,
        report,
        options.reportRetention ?? true,
      );
      return report;
    }
    const store = createStore('knowledge-seed', libsql);
    try {
      await writeDataset(createKnowledge(store), dataset, report, options.reportRetention ?? true);
      return report;
    } finally {
      await store.close();
    }
  }, options.databaseUrl);
}

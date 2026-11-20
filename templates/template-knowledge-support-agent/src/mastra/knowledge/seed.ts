import { LibSQLStore } from '@mastra/libsql';
import type { Knowledge, KnowledgeNote, KnowledgePage, KnowledgeStorage } from '@mastra/core/knowledge';
import { policyReference } from '../../examples/support.ts';
import { databaseUrlForPath, hostedMode, storageConfiguration } from '../database.ts';
import { createKnowledge } from './index.ts';
import { acquireWriterLock } from './writer-lock.ts';
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
  return a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);
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

async function writeDataset(knowledge: Knowledge, dataset: PreparedDataset, report: SeedReport) {
  const storage = await knowledge.getStorage();
  const author = `seed:${dataset.id}`;
  const scopes = new Map(
    (await storage.getScopesByAddress([...new Set(dataset.pages.map(page => page.scope))])).map(scope => [
      scope.address!,
      scope,
    ]),
  );
  // Read every target before writes so a collision cannot leave earlier pages partially overwritten.
  for (const wanted of dataset.pages) {
    const scope = scopes.get(wanted.scope);
    const existing =
      scope && (await storage.getPageByPath({ scopeId: scope.id, path: wanted.path.split('/'), read: 'all' }));
    if (existing && !ownedPage(existing, wanted, author))
      throw new Error(`Destination is not owned by this seed: ${wanted.scope}#${wanted.path}`);
  }
  const stored = new Map<string, KnowledgePage>();
  for (const wanted of dataset.pages) {
    const result = await knowledge.upsertPage({
      scope: wanted.scope,
      path: wanted.path,
      name: wanted.name,
      description: wanted.description,
      body: wanted.body,
      author,
    });
    const destination = `${wanted.scope}#${wanted.path}`;
    stored.set(destination, result.page);
    report.pages.push({
      key: wanted.key,
      destination,
      status: result.status,
      id: result.page.id,
      version: result.page.version,
    });
  }
  // Native writes usually resolve forward links when targets appear. Check the persisted index before repair.
  for (const wanted of dataset.pages) {
    const current = stored.get(`${wanted.scope}#${wanted.path}`)!;
    const expected = [...new Set(wanted.refs.map(ref => stored.get(ref)!.id).filter(id => id !== current.id))];
    const indexed = (
      await storage.listPageLinks({
        pageIds: [current.id],
        read: 'all',
        direction: 'out',
        kinds: ['body'],
        limit: 1000,
      })
    ).map(edge => edge.toPageId);
    if (!sameSet(indexed, expected)) {
      report.repairedLinks = true;
      break;
    }
  }
  if (report.repairedLinks) await knowledge.reindexLinks();
  for (const wanted of dataset.pages) {
    const current = stored.get(`${wanted.scope}#${wanted.path}`)!;
    const expected = [...new Set(wanted.refs.map(ref => stored.get(ref)!.id).filter(id => id !== current.id))];
    const indexed = (
      await storage.listPageLinks({
        pageIds: [current.id],
        read: 'all',
        direction: 'out',
        kinds: ['body'],
        limit: 1000,
      })
    ).map(edge => edge.toPageId);
    if (!sameSet(indexed, expected)) throw new Error('Knowledge link index repair did not converge');
    const existing = wanted.notes.length ? await allNotes(storage, current.id) : [];
    for (const note of wanted.notes) {
      const owned = existing.filter(
        item => item.text.split('\n')[0] === note.marker && item.provenance.author === author,
      );
      const mentions = [...new Set(note.refs.map(ref => stored.get(ref)!.id))];
      let kept = owned.find(item => exactNote(item, note, current.scopeId, mentions, author));
      let status: SeedReport['notes'][number]['status'] = 'unchanged';
      if (!kept) {
        const previous = owned[0];
        const input = { text: note.text, when: note.when, stamps: [wanted.scope], author };
        // Native updateNote omission preserves the date. Clearing it requires add-then-prune.
        if (previous && !(previous.when && !note.when)) {
          kept = await knowledge.updateNote({ id: previous.id, ...input });
          status = 'updated';
        } else {
          kept = await knowledge.addNote({ scope: wanted.scope, path: wanted.path, ...input });
          status = previous ? 'updated' : 'created';
        }
      }
      const duplicates = owned.filter(item => item.id !== kept.id);
      for (const duplicate of duplicates) await knowledge.removeNote({ id: duplicate.id, author });
      if (status === 'unchanged' && duplicates.length) status = 'repaired';
      report.notes.push({ pageKey: wanted.key, key: note.key, status, id: kept.id });
    }
  }
  const selectedIds = new Set([...stored.values()].map(page => page.id));
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
  const dataset = await prepareDataset(config, policyReference);
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
  const lock = await acquireWriterLock(options.databaseUrl);
  try {
    const storage = new LibSQLStore({
      id: 'knowledge-seed',
      ...storageConfiguration(hostedMode() ? options.databaseUrl : databaseUrlForPath(lock.databasePath)),
    });
    try {
      await writeDataset(createKnowledge(storage), dataset, report);
      return report;
    } finally {
      await storage.close();
    }
  } finally {
    await lock.release();
  }
}

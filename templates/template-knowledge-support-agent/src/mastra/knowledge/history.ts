import { knowledgeScopeAddress, MAX_KNOWLEDGE_PAGE_DEPTH } from '@mastra/core/knowledge';
import type { Knowledge, KnowledgePage, KnowledgeNote } from '@mastra/core/knowledge';
import { isCustomerHistoryPath, supportConfiguration } from '../../examples/support.ts';
import { principals, type Profile } from '../identity.ts';
import { recordOperation } from '../observability.ts';
import { MAX_SUPPORT_RECORD_BODY_LENGTH, validateSupportRecord, type SupportRecord } from './seed-manifest.ts';
import { supportRecordEnvelope } from './support-record-envelope.ts';

// Search prioritizes relevant pages beyond the enumeration window. Neither native search nor
// this bounded fallback promises exhaustive ranking across an arbitrarily large history.
const bounds = {
  batch: 100,
  enumeration: 100,
  hits: 100,
  candidates: 300,
  queries: 12,
  notes: 100,
  noteConcurrency: 8,
  records: 3,
};
type Evidence = SupportRecord & { ref: string };
type PageLocation = Pick<KnowledgePage, 'id' | 'scopeId' | 'isScope' | 'key' | 'parentId' | 'version'>;
export type History = {
  status: 'ready' | 'empty' | 'no-relevant-records' | 'partial' | 'unavailable';
  records: Evidence[];
};

function record(body = ''): SupportRecord | undefined {
  if (body.length > MAX_SUPPORT_RECORD_BODY_LENGTH) throw new Error('Support record exceeds the read bound');
  const envelope = supportRecordEnvelope(body);
  if (envelope) return validateSupportRecord(JSON.parse(envelope.value));
}

function location({ id, scopeId, isScope, key, parentId, version }: KnowledgePage): PageLocation {
  return { id, scopeId, isScope, key, parentId, version };
}

/** Scoped native search, verified canonical ancestry, and a bounded small-corpus fallback. */
export async function prepareHistory(knowledge: Knowledge, profile: Profile, question: string): Promise<History> {
  const started = performance.now();
  const records: Evidence[] = [];
  let partial = false;
  let inspected = 0;
  const finish = (status: History['status'], selected: Evidence[] = []): History => {
    recordOperation('history-retrieval', status, started, inspected);
    return { status, records: selected };
  };
  const words = new Set(
    question
      .normalize('NFC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) ?? [],
  );
  const topics = new Set(
    Object.entries(supportConfiguration.topicTerms)
      .filter(([tag, terms]) => words.has(tag) || terms.some(term => words.has(term.normalize('NFC').toLowerCase())))
      .map(([tag]) => tag),
  );
  try {
    const scope = knowledgeScopeAddress('customer:$tenantId:$customerId', { ...profile });
    const read = await knowledge.readScopeFor(principals(profile));
    const store = await knowledge.getStorage();
    const [customer] = await store.getScopesByAddress([scope]);
    if (!customer) return finish('empty');
    let historyReadable = false;
    const candidateIds = new Set<string>();
    const noteHits = new Map<string, Set<string>>();
    const add = (page: KnowledgePage) => {
      if (page.scopeId !== customer.id || page.isScope || page.deletedAt) return;
      if (candidateIds.size >= bounds.candidates && !candidateIds.has(page.id)) {
        partial = true;
        return;
      }
      candidateIds.add(page.id);
    };
    // Search tags as well as question words: a tag may be absent from title and prose.
    const queries = [...new Set([...topics, ...words])];
    // Enumeration and note listing can establish complete coverage even if search fails, reaches
    // its hit limit, or omits queries.
    for (const query of queries.slice(0, bounds.queries)) {
      try {
        const hits = await store.searchPages({ query, scopeIds: [customer.id], read, limit: bounds.hits });
        historyReadable = true;
        for (const hit of hits) {
          add(hit.page);
          if (hit.type === 'note' && candidateIds.has(hit.page.id)) {
            const notes = noteHits.get(hit.page.id) ?? new Set<string>();
            notes.add(hit.note.id);
            noteHits.set(hit.page.id, notes);
          }
        }
      } catch {
        // Scoped enumeration can still find the evidence.
      }
    }
    // Preserve exhaustive behavior for small customer scopes, including note-only matches and
    // unusual tags. Scope-filtered pagination bounds both calls and returned pages; canonical
    // ancestry below still excludes pages outside configured customer roots.
    let enumerated = 0;
    let cursor: string | undefined;
    try {
      do {
        const batch = await store.listPages({
          scopeId: customer.id,
          read,
          limit: Math.min(bounds.batch, bounds.enumeration - enumerated),
          cursor,
        });
        historyReadable = true;
        for (const page of batch.pages) add(page);
        enumerated += batch.pages.length;
        cursor = batch.nextCursor;
        if (cursor && enumerated >= bounds.enumeration) {
          partial = true;
          break;
        }
      } while (cursor);
    } catch {
      partial = true;
    }
    if (!historyReadable) return finish('unavailable');
    // A search or list snapshot can outlive a deletion. Use only the pages still readable here.
    const ids = [...candidateIds];
    const candidateBodies = new Map<string, string | undefined>();
    const pages = new Map<string, PageLocation>();
    for (let index = 0; index < ids.length; index += bounds.batch) {
      try {
        const current = await store.getPages({ ids: ids.slice(index, index + bounds.batch), read });
        for (const page of current) {
          if (page.scopeId !== customer.id || page.isScope || page.deletedAt) continue;
          pages.set(page.id, location(page));
          candidateBodies.set(page.id, page.body);
        }
      } catch {
        partial = true;
      }
    }
    // Search hits have no canonical path. Resolve parents in batches using the public store API,
    // then reject foreign scopes, missing/deleted ancestors, cycles, and paths outside allowed roots.
    for (let depth = 0; depth < MAX_KNOWLEDGE_PAGE_DEPTH; depth++) {
      const missing = [...new Set([...pages.values()].map(page => page.parentId))].filter(
        (id): id is string => !!id && id !== customer.id && !pages.has(id),
      );
      if (!missing.length) break;
      for (let index = 0; index < missing.length; index += bounds.batch) {
        try {
          const parents = await store.getPages({ ids: missing.slice(index, index + bounds.batch), read });
          for (const page of parents)
            if (page.scopeId === customer.id && !page.deletedAt) pages.set(page.id, location(page));
        } catch {
          partial = true;
        }
      }
    }
    let noteCounts: Record<string, number> = {};
    try {
      noteCounts = await store.countNotes({ pageIds: [...candidateBodies.keys()], read });
    } catch {
      partial = true;
    }
    async function scanNotes(pageId: string, visit: (note: KnowledgeNote) => void) {
      let cursor: string | undefined;
      let count = 0;
      do {
        const batch = await store.listNotes({ pageId, read, cursor, limit: bounds.batch });
        for (const note of batch.notes.slice(0, bounds.notes - count)) {
          count++;
          visit(note);
        }
        cursor = batch.nextCursor;
        if (cursor && count >= bounds.notes) {
          partial = true;
          break;
        }
      } while (cursor);
    }
    const pagesToInspect = candidateBodies.entries();
    async function inspect(pageId: string, body: string | undefined) {
      const path: string[] = [];
      const ancestry = new Map<string, PageLocation>();
      let current = pages.get(pageId);
      while (current && current.id !== customer.id && path.length < MAX_KNOWLEDGE_PAGE_DEPTH) {
        if (ancestry.has(current.id) || current.scopeId !== customer.id || current.isScope || !current.key) break;
        ancestry.set(current.id, current);
        path.unshift(current.key);
        if (current.parentId === customer.id) {
          current = customer;
          break;
        }
        current = current.parentId ? pages.get(current.parentId) : undefined;
      }
      if (current?.id !== customer.id) {
        partial = true;
        return;
      }
      const canonical = path.join('/');
      if (!isCustomerHistoryPath(canonical)) return;
      const ref = `${scope}#${canonical}`;
      const evidence: Evidence[] = [];
      inspected++;
      try {
        const parsed = record(body);
        if (parsed) evidence.push({ ...parsed, ref });
      } catch {
        partial = true;
      }
      const seenNotes = new Set<string>();
      const noteEvidence: Array<{ id: string; version: number; listed: boolean; record: Evidence }> = [];
      const includeNote = (note: KnowledgeNote, listed: boolean) => {
        if (seenNotes.has(note.id) || note.pageId !== pageId || note.deletedAt) return;
        seenNotes.add(note.id);
        if (
          !/^<!-- knowledge-review:[a-f0-9-]{36}:[a-f0-9]{64} -->\nReviewed by: /u.test(note.text) ||
          !note.provenance.author?.startsWith('review:')
        )
          return;
        try {
          if (note.text.length > 8000) throw new Error('Approved note exceeds the read bound');
          const parsed = record(note.text);
          if (parsed?.state === 'approved')
            noteEvidence.push({
              id: note.id,
              version: note.version,
              listed,
              record: { ...parsed, ref: `${ref}?note=${note.id}` },
            });
        } catch {
          partial = true;
        }
      };
      if (noteCounts[pageId] !== 0) {
        try {
          await scanNotes(pageId, note => includeNote(note, true));
        } catch {
          partial = true;
        }
      }
      // Retrieve search hits outside the bounded listing.
      for (const id of noteHits.get(pageId) ?? []) {
        if (seenNotes.has(id)) continue;
        try {
          const note = await store.getNote({ id, read });
          if (note) includeNote(note, false);
        } catch {
          partial = true;
        }
      }
      // Removing or editing a note does not change its parent page's revision.
      const listedVersions = new Map<string, number>();
      if (noteEvidence.some(note => note.listed)) {
        try {
          await scanNotes(pageId, note => {
            if (note.pageId === pageId && !note.deletedAt) listedVersions.set(note.id, note.version);
          });
        } catch {
          partial = true;
        }
      }
      for (const observed of noteEvidence) {
        try {
          let currentVersion = listedVersions.get(observed.id);
          if (!observed.listed) {
            const note = await store.getNote({ id: observed.id, read });
            if (note?.id === observed.id && note.pageId === pageId && !note.deletedAt) currentVersion = note.version;
          }
          if (currentVersion === observed.version) {
            evidence.push(observed.record);
            continue;
          }
        } catch {
          // A failed recheck leaves the note unverified.
        }
        partial = true;
      }
      if (!evidence.length) return;
      try {
        // A note can be added after its case or an ancestor moves. Recheck the full path
        // in one scoped read after collecting evidence, including moves away and back.
        const verified = await store.getPages({ ids: [...ancestry.keys()], read });
        if (
          verified.length === ancestry.size &&
          verified.every(current => {
            const prior = ancestry.get(current.id);
            return (
              prior &&
              current.scopeId === customer.id &&
              current.parentId === prior.parentId &&
              current.key === prior.key &&
              current.version === prior.version
            );
          })
        ) {
          records.push(...evidence);
          return;
        }
      } catch {
        // A failed recheck leaves the evidence unverified.
      }
      partial = true;
    }
    await Promise.all(
      Array.from({ length: Math.min(bounds.noteConcurrency, candidateBodies.size) }, async () => {
        for (const [pageId, body] of pagesToInspect) await inspect(pageId, body);
      }),
    );
  } catch {
    return finish('unavailable');
  }
  const ranked = records
    .map(record => ({ record, score: record.topicTags.filter(tag => topics.has(tag) || words.has(tag)).length }))
    .filter(item => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.record.observedOn.localeCompare(a.record.observedOn) ||
        a.record.ref.localeCompare(b.record.ref),
    )
    .slice(0, bounds.records)
    .map(item => item.record);
  return finish(
    partial ? 'partial' : !records.length ? 'empty' : ranked.length ? 'ready' : 'no-relevant-records',
    ranked,
  );
}

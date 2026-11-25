import { knowledgeScopeAddress, MAX_KNOWLEDGE_PAGE_DEPTH } from '@mastra/core/knowledge';
import type { Knowledge, KnowledgeNote, KnowledgeStorage } from '@mastra/core/knowledge';
import { isCustomerHistoryPath, supportConfiguration } from '../../examples/support.ts';
import type { OpenHistoryStorage, PageLocation } from '../database/history-storage.ts';
import type { KnowledgeReadSnapshot } from '../database/knowledge-snapshot.ts';
import { principals, type Profile } from '../identity.ts';
import { recordOperation } from '../observability.ts';
import { MAX_SUPPORT_RECORD_BODY_LENGTH, validateSupportRecord, type SupportRecord } from './seed-manifest.ts';
import { supportRecordEnvelope } from './support-record-envelope.ts';

// Search prioritizes relevant pages beyond the enumeration window. Neither search nor
// this bounded fallback promises exhaustive ranking across an arbitrarily large history.
const bounds = {
  batch: 100,
  pageBatch: 20,
  enumeration: 100,
  hits: 100,
  candidates: 300,
  bodyBytes: 8 * 1024 * 1024,
  queries: 12,
  notes: 100,
  noteConcurrency: 8,
  verificationRetries: 16,
  records: 3,
};
type Evidence = SupportRecord & { ref: string };
type PageRecord = { parsed?: SupportRecord; invalid?: true };
type NoteEvidence = { id: string; version: number; listed: boolean; record: Evidence };
export type HistoryKnowledge = Knowledge & {
  openHistoryStorage: OpenHistoryStorage;
  withReadSnapshot: KnowledgeReadSnapshot;
};
export type History = {
  status: 'ready' | 'empty' | 'no-relevant-records' | 'partial' | 'unavailable';
  records: Evidence[];
};

function record(body = ''): SupportRecord | undefined {
  if (body.length > MAX_SUPPORT_RECORD_BODY_LENGTH) throw new Error('Support record exceeds the read bound');
  const envelope = supportRecordEnvelope(body);
  if (envelope) return validateSupportRecord(JSON.parse(envelope.value));
}

/** Scoped keyword search, verified canonical ancestry, and a bounded small-corpus fallback. */
export async function prepareHistory(
  knowledge: HistoryKnowledge,
  profile: Profile,
  question: string,
): Promise<History> {
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
  let history: ReturnType<OpenHistoryStorage> | undefined;
  try {
    const scope = knowledgeScopeAddress('customer:$tenantId:$customerId', { ...profile });
    const read = await knowledge.readScopeFor(principals(profile));
    const store = await knowledge.getStorage();
    const [customer] = await store.getScopesByAddress([scope]);
    if (!customer) return finish('empty');
    const historyScope = { scopeId: customer.id, read };
    history = knowledge.openHistoryStorage();
    let enumerated = false;
    const candidateIds = new Set<string>();
    const noteHits = new Map<string, Set<string>>();
    const add = (id: string) => {
      if (candidateIds.size >= bounds.candidates && !candidateIds.has(id)) {
        partial = true;
        return;
      }
      candidateIds.add(id);
    };
    // Search tags as well as question words: a tag may be absent from title and prose.
    const queries = [...new Set([...topics, ...words])];
    // Enumeration and note listing can establish complete coverage even if search fails, reaches
    // its hit limit, or omits queries.
    for (const query of queries.slice(0, bounds.queries)) {
      try {
        const hits = await history.search(historyScope, query, bounds.hits);
        for (const hit of hits) {
          add(hit.pageId);
          if (hit.noteId && candidateIds.has(hit.pageId)) {
            const notes = noteHits.get(hit.pageId) ?? new Set<string>();
            notes.add(hit.noteId);
            noteHits.set(hit.pageId, notes);
          }
        }
      } catch {
        // Scoped enumeration can still find the evidence.
      }
    }
    // Preserve exhaustive behavior for small customer scopes, including note-only matches and
    // unusual tags. The extra result signals incomplete enumeration.
    try {
      const listed = await history.list(historyScope, bounds.enumeration + 1);
      enumerated = true;
      for (const { id } of listed.slice(0, bounds.enumeration)) add(id);
      if (listed.length > bounds.enumeration) partial = true;
    } catch {
      partial = true;
    }
    // A search or list snapshot can outlive a deletion. Use only the pages still readable here.
    const ids = [...candidateIds];
    if (!ids.length) return finish(enumerated ? 'empty' : 'unavailable');
    const candidateRecords = new Map<string, PageRecord>();
    const pages = new Map<string, PageLocation>();
    // A UTF-16 code unit accounts for at most three UTF-8 bytes. The aggregate limit also
    // bounds reads when many individually valid pages match.
    let remainingBytes = bounds.bodyBytes;
    let candidatesReadable = false;
    for (let index = 0; index < ids.length; index += bounds.pageBatch) {
      try {
        const current = await history.candidates(
          historyScope,
          ids.slice(index, index + bounds.pageBatch),
          MAX_SUPPORT_RECORD_BODY_LENGTH * 3,
          remainingBytes,
        );
        candidatesReadable = true;
        for (const page of current) {
          const { body, bodyOmitted, ...location } = page;
          pages.set(page.id, location);
          if (body !== null) remainingBytes -= Buffer.byteLength(body);
          try {
            candidateRecords.set(page.id, bodyOmitted ? { invalid: true } : { parsed: record(body ?? undefined) });
          } catch {
            candidateRecords.set(page.id, { invalid: true });
          }
        }
      } catch {
        partial = true;
      }
    }
    if (!candidatesReadable) return finish('unavailable');
    // Search hits have no canonical path. Resolve parents in metadata batches,
    // then reject foreign scopes, missing/deleted ancestors, cycles, and paths outside allowed roots.
    for (let depth = 0; depth < MAX_KNOWLEDGE_PAGE_DEPTH; depth++) {
      const missing = [...new Set([...pages.values()].map(page => page.parentId))].filter(
        (id): id is string => !!id && id !== customer.id && !pages.has(id),
      );
      if (!missing.length) break;
      for (let index = 0; index < missing.length; index += bounds.pageBatch) {
        try {
          const parents = await history.locations(historyScope, missing.slice(index, index + bounds.pageBatch));
          for (const page of parents) pages.set(page.id, page);
        } catch {
          partial = true;
        }
      }
    }
    let noteCounts: Record<string, number> = {};
    try {
      noteCounts = await store.countNotes({ pageIds: [...candidateRecords.keys()], read });
    } catch {
      partial = true;
    }
    async function scanNotes(
      source: Pick<KnowledgeStorage, 'listNotes'>,
      pageId: string,
      visit: (note: KnowledgeNote) => void,
    ) {
      let cursor: string | undefined;
      let count = 0;
      do {
        const batch = await source.listNotes({ pageId, read, cursor, limit: bounds.batch });
        for (const note of batch.notes.slice(0, bounds.notes - count)) {
          count++;
          visit(note);
        }
        cursor = batch.nextCursor;
        if (cursor && count >= bounds.notes) return true;
      } while (cursor);
      return false;
    }
    const pagesToInspect = candidateRecords.entries();
    const checks: Array<{ pageId: string; ancestry: PageLocation[]; pageRecord?: Evidence; notes: NoteEvidence[] }> =
      [];
    async function inspect(pageId: string, { parsed, invalid }: PageRecord) {
      const path: string[] = [];
      const ancestry = new Map<string, PageLocation>();
      let reachedScope = false;
      let current = pages.get(pageId);
      while (current && path.length < MAX_KNOWLEDGE_PAGE_DEPTH) {
        if (ancestry.has(current.id)) break;
        if (!current.key) return;
        ancestry.set(current.id, current);
        path.unshift(current.key);
        if (current.parentId === customer.id) {
          reachedScope = true;
          break;
        }
        current = current.parentId ? pages.get(current.parentId) : undefined;
      }
      if (!reachedScope) {
        partial = true;
        return;
      }
      const canonical = path.join('/');
      if (!isCustomerHistoryPath(canonical)) return;
      const ref = `${scope}#${canonical}`;
      const pageRecord = parsed && { ...parsed, ref };
      inspected++;
      if (invalid) partial = true;
      const seenNotes = new Set<string>();
      const noteEvidence: NoteEvidence[] = [];
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
          if (await scanNotes(store, pageId, note => includeNote(note, true))) partial = true;
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
      if (pageRecord || noteEvidence.length)
        checks.push({ pageId, ancestry: [...ancestry.values()], pageRecord, notes: noteEvidence });
    }
    await Promise.all(
      Array.from({ length: Math.min(bounds.noteConcurrency, candidateRecords.size) }, async () => {
        for (const [pageId, candidate] of pagesToInspect) await inspect(pageId, candidate);
      }),
    );
    async function verifyBatch(batch: typeof checks) {
      // Note revisions and every ancestor must agree in the same scoped read snapshot.
      return knowledge.withReadSnapshot(async snapshot => {
        const ancestryIds = [...new Set(batch.flatMap(check => check.ancestry.map(page => page.id)))];
        const currentPages = new Map<string, PageLocation>();
        for (let index = 0; index < ancestryIds.length; index += bounds.pageBatch) {
          const batch = await snapshot.locations(historyScope, ancestryIds.slice(index, index + bounds.pageBatch));
          for (const current of batch) currentPages.set(current.id, current);
        }
        const evidence: Evidence[] = [];
        let incomplete = false;
        for (const { pageId, ancestry, pageRecord, notes } of batch) {
          if (
            !ancestry.every(prior => {
              const current = currentPages.get(prior.id);
              return (
                current?.parentId === prior.parentId && current.key === prior.key && current.version === prior.version
              );
            })
          ) {
            incomplete = true;
            continue;
          }
          if (pageRecord) evidence.push(pageRecord);
          const listedVersions = new Map<string, number>();
          if (notes.some(note => note.listed)) {
            const truncated = await scanNotes(snapshot, pageId, note => {
              if (note.pageId === pageId && !note.deletedAt) listedVersions.set(note.id, note.version);
            });
            incomplete ||= truncated;
          }
          for (const observed of notes) {
            let currentVersion = listedVersions.get(observed.id);
            if (!observed.listed) {
              const note = await snapshot.getNote({ id: observed.id, read });
              if (note?.pageId === pageId && !note.deletedAt) currentVersion = note.version;
            }
            if (currentVersion === observed.version) evidence.push(observed.record);
            else incomplete = true;
          }
        }
        return { evidence, incomplete };
      });
    }
    async function verify(batch: typeof checks) {
      const pending = [batch];
      for (const group of pending) {
        try {
          const { evidence, incomplete } = await verifyBatch(group);
          records.push(...evidence);
          partial ||= incomplete;
        } catch {
          // Failed snapshots contribute no evidence. Retry halves breadth-first within the same worker.
          if (group.length === 1 || pending.length + 2 > 1 + bounds.verificationRetries) {
            partial = true;
            continue;
          }
          const middle = Math.floor(group.length / 2);
          pending.push(group.slice(0, middle), group.slice(middle));
        }
      }
    }
    // Independent batches bound each read transaction and preserve evidence if another batch fails.
    const verification: Promise<void>[] = [];
    for (let index = 0; index < checks.length; index += bounds.batch)
      verification.push(verify(checks.slice(index, index + bounds.batch)));
    await Promise.all(verification);
  } catch {
    return finish('unavailable');
  } finally {
    history?.close();
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

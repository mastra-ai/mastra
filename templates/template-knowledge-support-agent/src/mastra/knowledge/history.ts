import { knowledgeScopeAddress, MAX_KNOWLEDGE_PAGE_DEPTH } from '@mastra/core/knowledge';
import type { Knowledge, KnowledgePage, KnowledgeNote } from '@mastra/core/knowledge';
import { supportConfiguration } from '../../examples/support.ts';
import { principals, type Profile } from '../identity.ts';
import { recordOperation } from '../observability.ts';
import { validateSupportRecord, type SupportRecord } from './seed-manifest.ts';

// Search prioritizes relevant pages beyond the enumeration window. Neither native search nor
// this bounded fallback promises exhaustive ranking across an arbitrarily large history.
const bounds = { batch: 100, enumeration: 100, hits: 100, candidates: 300, queries: 12, notes: 100, records: 3 };
type Evidence = SupportRecord & { ref: string };
export type History = {
  status: 'ready' | 'empty' | 'no-relevant-records' | 'partial' | 'unavailable';
  records: Evidence[];
};

function record(body = ''): SupportRecord | undefined {
  if (body.length > 1_000_000) throw new Error('Support record exceeds the read bound');
  const envelopes = [...body.matchAll(/^```support-record\n([\s\S]*?)\n```[ \t]*$/gmu)];
  if (!envelopes.length && !body.includes('```support-record')) return;
  if (envelopes.length !== 1) throw new Error('Invalid support record');
  return validateSupportRecord(JSON.parse(envelopes[0]![1]!));
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
    const candidates = new Map<string, KnowledgePage>();
    const pages = new Map<string, KnowledgePage>();
    const noteHits = new Map<string, KnowledgeNote[]>();
    const add = (page: KnowledgePage) => {
      if (page.scopeId !== customer.id || page.isScope || page.deletedAt) return;
      if (candidates.size >= bounds.candidates && !candidates.has(page.id)) {
        partial = true;
        return;
      }
      candidates.set(page.id, page);
      pages.set(page.id, page);
    };
    // Search tags as well as question words: a tag may be absent from title and prose.
    const queries = [...new Set([...topics, ...words])];
    if (queries.length > bounds.queries) partial = true;
    for (const query of queries.slice(0, bounds.queries)) {
      try {
        const hits = await store.searchPages({ query, scopeIds: [customer.id], read, limit: bounds.hits });
        if (hits.length >= bounds.hits) partial = true;
        for (const hit of hits) {
          add(hit.page);
          if (hit.type === 'note' && candidates.has(hit.page.id)) {
            const notes = noteHits.get(hit.page.id) ?? [];
            if (!notes.some(note => note.id === hit.note.id)) notes.push(hit.note);
            noteHits.set(hit.page.id, notes);
          }
        }
      } catch {
        partial = true;
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
          for (const page of parents) if (page.scopeId === customer.id && !page.deletedAt) pages.set(page.id, page);
        } catch {
          partial = true;
        }
      }
    }
    let noteCounts: Record<string, number> = {};
    try {
      noteCounts = await store.countNotes({ pageIds: [...candidates.keys()], read });
    } catch {
      partial = true;
    }
    for (const page of candidates.values()) {
      const path: string[] = [];
      const seen = new Set<string>();
      let current: KnowledgePage | undefined = page;
      while (current && current.id !== customer.id && path.length < MAX_KNOWLEDGE_PAGE_DEPTH) {
        if (seen.has(current.id) || current.scopeId !== customer.id || current.isScope || !current.key) break;
        seen.add(current.id);
        path.unshift(current.key);
        if (current.parentId === customer.id) {
          current = customer;
          break;
        }
        current = current.parentId ? pages.get(current.parentId) : undefined;
      }
      if (current?.id !== customer.id) {
        partial = true;
        continue;
      }
      const canonical = path.join('/');
      if (!supportConfiguration.customerRoots.some(root => canonical === root || canonical.startsWith(`${root}/`)))
        continue;
      const ref = `${scope}#${canonical}`;
      inspected++;
      try {
        const parsed = record(page.body);
        if (parsed) records.push({ ...parsed, ref });
      } catch {
        partial = true;
      }
      const seenNotes = new Set<string>();
      const includeNote = (note: KnowledgeNote) => {
        if (seenNotes.has(note.id) || note.pageId !== page.id) return;
        seenNotes.add(note.id);
        if (
          !/^<!-- knowledge-review:[a-f0-9-]{36}:[a-f0-9]{64} -->\nReviewed by: /u.test(note.text) ||
          !note.provenance.author?.startsWith('review:')
        )
          return;
        try {
          if (note.text.length > 8000) throw new Error('Approved note exceeds the read bound');
          const parsed = record(note.text);
          if (parsed?.state === 'approved') records.push({ ...parsed, ref: `${ref}?note=${note.id}` });
        } catch {
          partial = true;
        }
      };
      // Native note hits already passed the scoped reader's stamps/mentions visibility checks.
      // Keep relevant notes even when they fall outside the oldest-first listing window.
      for (const note of noteHits.get(page.id) ?? []) includeNote(note);
      if (noteCounts[page.id] === 0) continue;
      try {
        let cursor: string | undefined;
        let count = 0;
        do {
          const batch = await store.listNotes({ pageId: page.id, read, cursor, limit: bounds.batch });
          for (const note of batch.notes.slice(0, bounds.notes - count)) {
            count++;
            includeNote(note);
          }
          cursor = batch.nextCursor;
          if (cursor && count >= bounds.notes) {
            partial = true;
            break;
          }
        } while (cursor);
      } catch {
        partial = true;
      }
    }
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

import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { prepareHistory } from '../../src/mastra/knowledge/preflight.ts';
import type { HistoryKnowledge } from '../../src/mastra/knowledge/history.ts';
import { exampleProfiles } from '../../src/examples/retail-pos/profiles.ts';
import { datasets } from '../../src/examples/datasets.ts';
import { seedDataset } from '../../src/mastra/knowledge/seed.ts';
import { resourceId } from '../../src/mastra/identity.ts';
import { hasDuplicatePage } from '../../src/mastra/review/duplicate.ts';
import { generateHistoryCorpus, historyRecord, reviewedNote } from '../fixtures/history-corpus.ts';
import { runtimeFixture, syntheticSafetyPolicy, useLocalTestDatabase } from '../fixtures/runtime.ts';

useLocalTestDatabase();

const profile = exampleProfiles[0]!;
type Discovery = ReturnType<HistoryKnowledge['openHistoryStorage']>;

function observeDiscovery(knowledge: HistoryKnowledge, observe: (storage: Discovery) => Discovery) {
  const original = knowledge.openHistoryStorage;
  knowledge.openHistoryStorage = () => observe(original());
}

test(
  'large customer histories retain older ranked evidence and isolate malformed entries over HTTP',
  { timeout: 180000 },
  async t => {
    const f = await runtimeFixture({
      syntheticKnowledge: false,
      modelScript: body => {
        const messages = body.messages as Array<{ role: string; content?: string }>;
        const evidence = messages.find(message => message.content?.startsWith('Customer history preflight'))?.content;
        assert.ok(evidence, 'First model request receives prepared customer evidence');
        const history = JSON.parse(evidence.slice(evidence.indexOf('\n') + 1));
        assert.equal(history.status, 'partial');
        assert.deepEqual(
          history.records.map((record: { summary: string }) => record.summary),
          ['BEST_A', 'BEST_B', 'APPROVED_NOTE_ONLY'],
        );
        assert.doesNotMatch(evidence, /FOREIGN_|NOISE_|OUTSIDE_ROOT|HIDDEN_STAMP_NOTE|UNREVIEWED_NOTE/u);
        return { content: 'Partial customer history: two older cases and an approved note. More history may exist.' };
      },
    });
    try {
      const generatedAt = performance.now();
      const corpus = await generateHistoryCorpus(f.supportKnowledge);
      t.diagnostic(
        JSON.stringify({
          corpus: { ...corpus, addMalformedRecords: undefined },
          generatedMs: performance.now() - generatedAt,
        }),
      );
      const expected = [
        'customer:north:store-1#cases/z-a-best',
        'customer:north:store-1#cases/z-b-best',
        corpus.noteRef,
      ];
      const samples: number[] = [];
      for (let i = 0; i < 20; i++) {
        const started = performance.now();
        const result = await prepareHistory(f.supportKnowledge, profile, 'network printer');
        samples.push(performance.now() - started);
        assert.equal(result.status, 'partial');
        assert.deepEqual(
          result.records.map(record => record.ref),
          expected,
        );
      }
      samples.sort((a, b) => a - b);
      t.diagnostic(
        JSON.stringify({
          historyTimingMs: {
            count: samples.length,
            p95: samples[Math.ceil(samples.length * 0.95) - 1],
            min: samples[0],
            max: samples.at(-1),
          },
        }),
      );
      const older = await prepareHistory(f.supportKnowledge, profile, 'network legacy');
      assert.ok(
        older.records.some(record => record.summary === 'OLDER_RELEVANT'),
        'A six-year-old record survives 600 newer unrelated cases',
      );
      const scope = 'customer:north:store-1';
      const path = 'cases/markdown-example';
      const example = `\`\`\`\`markdown\n${historyRecord('EXAMPLE_ONLY', ['connectivity', 'printing'], '2026-11-20')}\n\`\`\`\``;
      await f.supportKnowledge.upsertPage({ scope, path, name: 'Markdown example', body: example });
      await f.supportKnowledge.addNote({
        scope,
        path,
        text: reviewedNote(example),
        author: 'review:synthetic-reviewer',
      });
      const afterExample = await prepareHistory(f.supportKnowledge, profile, 'network printer');
      assert.deepEqual(
        afterExample.records.map(record => record.ref),
        expected,
        'Code samples cannot become history',
      );
      await corpus.addMalformedRecords();
      const degraded = await prepareHistory(f.supportKnowledge, profile, 'network printer');
      assert.equal(degraded.status, 'partial');
      assert.deepEqual(
        degraded.records.map(record => record.ref),
        expected,
      );
      const foreign = await prepareHistory(f.supportKnowledge, exampleProfiles[2]!, 'network printer');
      assert.equal(foreign.status, 'partial');
      assert.equal(foreign.records.length, 3);
      assert.ok(foreign.records.every(record => record.ref.startsWith('customer:south:store-1#cases/')));
      assert.doesNotMatch(JSON.stringify(foreign), /BEST_A|BEST_B|APPROVED_NOTE_ONLY/u);
      assert.equal(
        (await prepareHistory(f.supportKnowledge, { ...profile, customerId: 'absent' }, 'network')).status,
        'empty',
      );
      assert.equal(
        (await prepareHistory(f.supportKnowledge, profile, 'unmatched-topic')).status,
        'partial',
        'Incomplete coverage never claims no relevant records',
      );
      // Measure the seed and duplicate lookup separately from the review workflow.
      const seedSamples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const started = performance.now();
        await seedDataset(datasets['retail-pos-docs']!, { databaseUrl: f.databaseUrl });
        seedSamples.push(performance.now() - started);
      }
      const duplicateSamples: number[] = [];
      const store = await f.supportKnowledge.getStorage();
      const [home] = await store.getScopesByAddress(['customer:north:store-1']);
      assert.ok(home);
      for (let i = 0; i < 5; i++) {
        const started = performance.now();
        assert.equal(
          await f.withEnvironment(() => hasDuplicatePage(home.id, 'ABSENT_DUPLICATE_CANDIDATE', undefined)),
          false,
        );
        duplicateSamples.push(performance.now() - started);
      }
      seedSamples.sort((a, b) => a - b);
      duplicateSamples.sort((a, b) => a - b);
      t.diagnostic(
        JSON.stringify({
          writerTimingMs: {
            seed: { count: seedSamples.length, p95: seedSamples[Math.ceil(seedSamples.length * 0.95) - 1] },
            duplicateLookup: {
              count: duplicateSamples.length,
              p95: duplicateSamples[Math.ceil(duplicateSamples.length * 0.95) - 1],
            },
          },
        }),
      );
      await f.approvePolicy('tenant:north#policies/safe-changes', syntheticSafetyPolicy);
      await f.supportKnowledge.upsertPage({
        scope: 'tenant:north',
        path: 'policies/safe-changes',
        name: 'Safety policy',
        body: syntheticSafetyPolicy,
        author: 'synthetic-fixture',
      });
      await f.start();
      const created = await f.request('/memory/threads?agentId=support', 0, {
        method: 'POST',
        body: JSON.stringify({ resourceId: resourceId(profile) }),
      });
      assert.equal(created.status, 200, await created.clone().text());
      const { id } = (await created.json()) as { id: string };
      for (const route of ['generate', 'stream']) {
        const requestStart = f.model.requests.length;
        const response = await f.request(`/agents/support/${route}`, 0, {
          method: 'POST',
          body: JSON.stringify({ messages: [{ role: 'user', content: 'network printer' }], memory: { thread: id } }),
        });
        assert.equal(response.status, 200);
        assert.match(await response.text(), /Partial customer history/u);
        assert.ok(
          f.model.requests.slice(requestStart).some(body => {
            const messages = body.messages as Array<{ role: string; content?: string }>;
            return messages.some(
              message =>
                message.role === 'system' &&
                message.content?.startsWith('Customer history preflight') &&
                expected.every(ref => message.content?.includes(ref)),
            );
          }),
          `${route} must send prepared history to the provider`,
        );
      }
      await f.stop();
      await f.storage.close();
      assert.deepEqual(
        await prepareHistory(f.supportKnowledge, profile, 'network printer'),
        {
          status: 'unavailable',
          records: [],
        },
        'A closed database is unavailable, never an empty customer history',
      );
    } finally {
      await f.close();
    }
  },
);

test('a complete fallback finds matches beyond the search query cap', { timeout: 30000 }, async () => {
  const f = await runtimeFixture({ syntheticKnowledge: false });
  try {
    const scope = 'customer:north:store-1';
    const path = 'cases/fallback-match';
    const { page: match } = await f.supportKnowledge.upsertPage({
      scope,
      path,
      name: 'Fallback match',
      body: historyRecord('MATCHING_PAGE', ['late-match']),
    });
    const store = await f.supportKnowledge.getStorage();
    const [home] = await store.getScopesByAddress([scope]);
    assert.ok(home);
    const unkeyed = await store.createPage({
      parentId: home.id,
      name: 'Imported parent',
      body: historyRecord('UNKEYED_PARENT', ['late-match']),
      provenance: { author: 'fixture' },
    });
    assert.ok(!unkeyed.key);
    await store.createPage({
      parentId: unkeyed.id,
      key: 'imported-child',
      name: 'Imported child',
      body: historyRecord('UNKEYED_ANCESTOR', ['late-match']),
      provenance: { author: 'fixture' },
    });
    const queries: string[] = [];
    const enumerated = new Set<string>();
    observeDiscovery(f.supportKnowledge, storage => ({
      ...storage,
      async search(scope, query, limit) {
        queries.push(query);
        return storage.search(scope, query, limit);
      },
      async list(...args) {
        const pages = await storage.list(...args);
        for (const page of pages) enumerated.add(page.id);
        return pages;
      },
    }));
    const result = await prepareHistory(
      f.supportKnowledge,
      profile,
      'one two three four five six seven eight nine ten eleven twelve late-match',
    );
    assert.ok(queries.length && !queries.includes('late-match'));
    assert.ok(enumerated.has(match.id));
    assert.equal(result.status, 'ready');
    assert.deepEqual(
      result.records.map(record => record.ref),
      [`${scope}#${path}`],
    );
  } finally {
    await f.close();
  }
});

test('history discovery returns metadata and bounds candidate payloads before fetching', async () => {
  const f = await runtimeFixture({ syntheticKnowledge: false });
  try {
    const scope = 'customer:north:store-1';
    const anchor = 'cases/network-anchor';
    await f.supportKnowledge.upsertPage({ scope, path: anchor, name: 'Network anchor' });
    for (let index = 0; index < 35; index++) {
      await f.supportKnowledge.upsertPage({ scope, path: `cases/large-${index}`, name: `Network case ${index}` });
    }
    const { page: oversized } = await f.supportKnowledge.upsertPage({
      scope,
      path: 'cases/oversized',
      name: 'Network connectivity oversized record',
    });
    const body = `${historyRecord('LARGE_NETWORK_RECORD')}\n${'é'.repeat(131072)}`;
    const db = createClient({ url: f.databaseUrl });
    try {
      await db.execute({ sql: "UPDATE mastra_knowledge_pages SET body = ? WHERE key GLOB 'large-*'", args: [body] });
      await db.execute({
        sql: 'UPDATE mastra_knowledge_pages SET body = ? WHERE id = ?',
        args: ['漢'.repeat(1_000_001), oversized.id],
      });
    } finally {
      db.close();
    }
    const note = await f.supportKnowledge.addNote({
      scope,
      path: anchor,
      text: reviewedNote(historyRecord('APPROVED_SMALL_NOTE', ['connectivity'], '2027-01-01')),
      author: 'review:synthetic',
    });
    let transferred = 0;
    let omitted = 0;
    let matchingQueries = 0;
    let omittedOversized = false;
    const candidates: string[] = [];
    const searchFields = new Set<string>();
    const listingFields = new Set<string>();
    observeDiscovery(f.supportKnowledge, storage => ({
      ...storage,
      async search(...args) {
        const hits = await storage.search(...args);
        if (hits.length >= 35) matchingQueries++;
        for (const hit of hits) for (const field of Object.keys(hit)) searchFields.add(field);
        return hits;
      },
      async list(...args) {
        const entries = await storage.list(...args);
        for (const entry of entries) for (const field of Object.keys(entry)) listingFields.add(field);
        return entries;
      },
      async candidates(...args) {
        const rows = await storage.candidates(...args);
        for (const row of rows) {
          candidates.push(row.id);
          transferred += Buffer.byteLength(row.body ?? '');
          omitted += row.bodyOmitted;
          if (row.id === oversized.id) omittedOversized = row.bodyOmitted === 1 && row.body === null;
        }
        return rows;
      },
    }));
    const history = await prepareHistory(f.supportKnowledge, profile, 'network connectivity');
    assert.equal(matchingQueries, 2);
    assert.deepEqual(searchFields, new Set(['pageId', 'noteId']));
    assert.deepEqual(listingFields, new Set(['id']));
    assert.equal(new Set(candidates).size, candidates.length, 'Repeated hits must not reload a candidate body');
    assert.ok(transferred > 0 && transferred <= 8 * 1024 * 1024, `Candidate bytes transferred: ${transferred}`);
    assert.ok(omittedOversized, 'The database must withhold an oversized candidate body');
    assert.ok(omitted > 1, 'The cumulative limit must withhold individually eligible bodies too');
    assert.equal(history.status, 'partial');
    assert.ok(history.records.some(record => record.ref === `${scope}#${anchor}?note=${note.id}`));
  } finally {
    await f.close();
  }
});

test('complete enumeration recovers from saturated history search', { timeout: 30000 }, async () => {
  const f = await runtimeFixture({ syntheticKnowledge: false });
  try {
    const scope = 'customer:north:store-1';
    await f.supportKnowledge.upsertPage({ scope, path: 'cases', name: 'Network cases' });
    for (let index = 0; index < 98; index++) {
      await f.supportKnowledge.upsertPage({
        scope,
        path: `cases/network-${index}`,
        name: `Network case ${index}`,
        body: historyRecord(`Network finding ${index}`),
      });
    }
    await f.supportKnowledge.addNote({ scope, path: 'cases/network-0', text: 'Network diagnostic observation.' });
    const { page: fallback } = await f.supportKnowledge.upsertPage({
      scope,
      path: 'cases/fallback-first',
      name: 'Follow-up',
      // JSON decodes the tag for history ranking, while native text search sees the escaped spelling.
      body: historyRecord('Fallback finding', ['connectivity'], '2026-02-01').replace(
        '"connectivity"',
        '"\\u0063onnectivity"',
      ),
    });
    const searched = new Map<string, string[]>();
    observeDiscovery(f.supportKnowledge, storage => ({
      ...storage,
      async search(scope, query, limit) {
        const hits = await storage.search(scope, query, limit);
        searched.set(
          query,
          hits.map(hit => hit.pageId),
        );
        return hits;
      },
    }));
    const history = await prepareHistory(f.supportKnowledge, profile, 'network');
    assert.equal(searched.get('network')?.length, 100);
    assert.ok([...searched.values()].flat().every(id => id !== fallback.id));
    assert.equal(history.status, 'ready');
    assert.equal(history.records.length, 3);
    assert.equal(history.records[0]!.ref, `${scope}#cases/fallback-first`);
  } finally {
    await f.close();
  }
});

test('a page or note removed after discovery does not enter scoped history', { timeout: 30000 }, async () => {
  const f = await runtimeFixture({ syntheticKnowledge: false });
  try {
    const { supportKnowledge } = f;
    const scope = 'customer:north:store-1';
    const path = 'cases/current-check';
    const deletedPath = 'cases/deleted-check';
    await supportKnowledge.upsertPage({ scope, path, name: 'Current check', body: historyRecord('MATCHING_PAGE') });
    const { page: deleted } = await supportKnowledge.upsertPage({
      scope,
      path: deletedPath,
      name: 'Deleted check',
      body: historyRecord('DELETED_PAGE'),
    });
    const note = await supportKnowledge.addNote({
      scope,
      path,
      text: reviewedNote(historyRecord('REVIEWED_CONNECTIVITY_NOTE')),
      author: 'review:synthetic-reviewer',
    });
    const noteRef = `${scope}#${path}?note=${note.id}`;
    const question = 'network printer';
    const baseline = await prepareHistory(supportKnowledge, profile, question);
    assert.ok(baseline.records.some(record => record.ref === noteRef));
    assert.ok(baseline.records.some(record => record.ref === `${scope}#${deletedPath}`));
    let noteRemoved = false;
    let pageRemoved = false;
    observeDiscovery(supportKnowledge, storage => ({
      ...storage,
      async search(...args) {
        const hits = await storage.search(...args);
        if (!noteRemoved && hits.some(hit => hit.noteId === note.id)) {
          noteRemoved = true;
          await supportKnowledge.removeNote({ id: note.id, author: 'synthetic-fixture' });
        }
        if (!pageRemoved && hits.some(hit => hit.pageId === deleted.id)) {
          pageRemoved = true;
          await supportKnowledge.removePage({ scope, path: deletedPath, author: 'synthetic-fixture' });
        }
        return hits;
      },
    }));
    const result = await prepareHistory(supportKnowledge, profile, question);
    assert.ok(noteRemoved && pageRemoved, 'The scoped search returned both deleted entries');
    assert.ok(result.records.some(record => record.summary === 'MATCHING_PAGE'));
    assert.ok(result.records.every(record => record.ref !== noteRef && record.ref !== `${scope}#${deletedPath}`));
  } finally {
    await f.close();
  }
});

test('history verifies note visibility and case ancestry at the same point in time', async () => {
  const f = await runtimeFixture({ syntheticKnowledge: false });
  try {
    const { supportKnowledge } = f;
    const scope = 'customer:north:store-1';
    const path = 'cases/snapshot-check';
    const { page } = await supportKnowledge.upsertPage({
      scope,
      path,
      name: 'Snapshot check',
      body: historyRecord('CASE_BODY'),
    });
    await supportKnowledge.upsertPage({ scope, path: 'archive', name: 'Archive' });
    const add = (summary: string) =>
      supportKnowledge.addNote({ scope, path, text: reviewedNote(historyRecord(summary)), author: 'review:synthetic' });
    const removedBefore = await add('WITHDRAWN_BEFORE_SNAPSHOT');
    const removedDuring = await add('WITHDRAWN_AFTER_SNAPSHOT');
    const run = () => prepareHistory(supportKnowledge, profile, 'network');
    assert.equal((await run()).records.length, 3);
    const withReadSnapshot = supportKnowledge.withReadSnapshot;
    supportKnowledge.withReadSnapshot = async read => {
      await supportKnowledge.removeNote({ id: removedBefore.id });
      return withReadSnapshot(async snapshot => {
        // Anchor the read transaction before changing what a live ancestry lookup would see.
        assert.equal((await snapshot.locations({ scopeId: page.scopeId, read: 'all' }, [page.id])).length, 1);
        await supportKnowledge.removeNote({ id: removedDuring.id });
        await supportKnowledge.movePage({ scope, path, parent: 'archive' });
        return read(snapshot);
      });
    };
    const result = await run();
    supportKnowledge.withReadSnapshot = withReadSnapshot;
    assert.equal(result.status, 'partial');
    assert.deepEqual(
      result.records.map(record => record.ref).sort(),
      [`${scope}#${path}`, `${scope}#${path}?note=${removedDuring.id}`].sort(),
    );
    const next = await run();
    assert.equal(next.status, 'empty');
    assert.deepEqual(next.records, []);
  } finally {
    await f.close();
  }
});

test('history revalidates healthy pages when another page cannot list notes in its snapshot', async () => {
  const f = await runtimeFixture({ syntheticKnowledge: false });
  try {
    const { supportKnowledge } = f;
    const scope = 'customer:north:store-1';
    const stablePath = 'cases/healthy';
    const failedPath = 'cases/failed-listing';
    await supportKnowledge.upsertPage({
      scope,
      path: stablePath,
      name: 'Healthy case',
      body: historyRecord('HEALTHY_CASE'),
    });
    const { page: failed } = await supportKnowledge.upsertPage({
      scope,
      path: failedPath,
      name: 'Case with a note-listing fault',
      body: historyRecord('OTHER_CASE'),
    });
    await supportKnowledge.addNote({
      scope,
      path: failedPath,
      text: reviewedNote(historyRecord('OTHER_NOTE')),
      author: 'review:synthetic',
    });
    const run = () => prepareHistory(supportKnowledge, profile, 'network');
    const baseline = await run();
    assert.equal(baseline.status, 'ready');
    assert.equal(baseline.records.length, 3);

    const withReadSnapshot = supportKnowledge.withReadSnapshot;
    let failures = 0;
    let persistent = true;
    supportKnowledge.withReadSnapshot = operation =>
      withReadSnapshot(snapshot => {
        const listNotes = snapshot.listNotes.bind(snapshot);
        snapshot.listNotes = async input => {
          if (input.pageId === failed.id && (persistent || failures === 0)) {
            failures++;
            throw new Error('Injected note-listing failure in verification snapshot');
          }
          return listNotes(input);
        };
        return operation(snapshot);
      });
    const result = await run();
    assert.ok(failures > 0, 'Snapshot verification must encounter the note-listing fault');
    assert.equal(result.status, 'partial');
    assert.deepEqual(
      result.records.map(record => record.ref),
      [`${scope}#${stablePath}`],
    );

    persistent = false;
    failures = 0;
    assert.deepEqual(await run(), baseline, 'A fully revalidated transient failure must recover all evidence');
    assert.equal(failures, 1);
  } finally {
    await f.close();
  }
});

test(
  'history keeps current notes and drops evidence from a case moved during retrieval',
  { timeout: 30000 },
  async () => {
    const f = await runtimeFixture({ syntheticKnowledge: false });
    try {
      const { supportKnowledge } = f;
      const scope = 'customer:north:store-1';
      const stablePath = 'cases/current';
      const movingPath = 'cases/batch/relocated';
      await supportKnowledge.upsertPage({
        scope,
        path: stablePath,
        name: 'Current case',
        body: '\uFEFF' + historyRecord('CURRENT_PAGE'),
      });
      const note = await supportKnowledge.addNote({
        scope,
        path: stablePath,
        text: reviewedNote(historyRecord('CURRENT_NOTE')),
        author: 'review:synthetic-reviewer',
      });
      const removed = await supportKnowledge.addNote({
        scope,
        path: stablePath,
        text: reviewedNote(historyRecord('REMOVED_NOTE')),
        author: 'review:synthetic-reviewer',
      });
      const { page: moving } = await supportKnowledge.upsertPage({
        scope,
        path: movingPath,
        name: 'Relocated case',
        body: historyRecord('PREVIOUS_PAGE'),
      });
      await supportKnowledge.addNote({ scope, path: movingPath, text: 'Existing intake note.' });
      await supportKnowledge.upsertPage({ scope, path: 'archive', name: 'Archive' });
      const store = await supportKnowledge.getStorage();
      const getNote = store.getNote.bind(store);
      const listNotes = store.listNotes.bind(store);
      let matchingHits = 0;
      let moved = false;
      let removedAfterListing = false;
      let listedNotePointReads = 0;
      const countPointRead: typeof store.getNote = input => {
        if (input.read !== 'all' && (input.id === note.id || input.id === removed.id)) listedNotePointReads++;
        return getNote(input);
      };
      store.getNote = countPointRead;
      const withReadSnapshot = supportKnowledge.withReadSnapshot;
      supportKnowledge.withReadSnapshot = read =>
        withReadSnapshot(snapshot =>
          read({
            ...snapshot,
            getNote(input) {
              if (input.read !== 'all' && (input.id === note.id || input.id === removed.id)) listedNotePointReads++;
              return snapshot.getNote(input);
            },
          }),
        );
      observeDiscovery(supportKnowledge, storage => ({
        ...storage,
        async search(...args) {
          const hits = await storage.search(...args);
          matchingHits += hits.filter(hit => hit.noteId === note.id).length;
          return hits;
        },
      }));
      store.listNotes = async input => {
        if (input.pageId === moving.id && !moved) {
          moved = true;
          await supportKnowledge.movePage({ scope, path: 'cases/batch', parent: 'archive' });
          await supportKnowledge.addNote({
            scope,
            path: 'archive/batch/relocated',
            text: reviewedNote(historyRecord('POST_MOVE_NOTE')),
            author: 'review:synthetic-reviewer',
          });
        }
        const listed = await listNotes(input);
        if (!removedAfterListing && listed.notes.some(note => note.id === removed.id)) {
          await supportKnowledge.removeNote({ id: removed.id, author: 'synthetic-fixture' });
          removedAfterListing = true;
        }
        return listed;
      };
      const result = await prepareHistory(supportKnowledge, profile, 'network printer');
      assert.ok(
        moved && matchingHits > 0,
        'The real store must return the note hit and move the ancestor during listing',
      );
      assert.equal(result.status, 'partial');
      assert.ok(removedAfterListing, 'The real store must list the approved note before it is removed');
      assert.equal(listedNotePointReads, 0, 'Listed notes must be verified in a scoped batch');
      assert.deepEqual(
        result.records.map(record => [record.summary, record.ref]),
        [
          ['CURRENT_PAGE', `${scope}#${stablePath}`],
          ['CURRENT_NOTE', `${scope}#${stablePath}?note=${note.id}`],
        ],
      );
    } finally {
      await f.close();
    }
  },
);

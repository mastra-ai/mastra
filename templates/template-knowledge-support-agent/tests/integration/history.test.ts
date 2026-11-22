import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareHistory } from '../../src/mastra/knowledge/preflight.ts';
import { exampleProfiles } from '../../src/examples/retail-pos/profiles.ts';
import { datasets } from '../../src/examples/datasets.ts';
import { seedDataset } from '../../src/mastra/knowledge/seed.ts';
import { resourceId } from '../../src/mastra/identity.ts';
import { hasDuplicatePage } from '../../src/mastra/review/duplicate.ts';
import { generateHistoryCorpus, historyRecord, reviewedNote } from '../fixtures/history-corpus.ts';
import { runtimeFixture, syntheticSafetyPolicy } from '../fixtures/runtime.ts';

const profile = exampleProfiles[0]!;
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
    await f.supportKnowledge.upsertPage({
      scope,
      path,
      name: 'Fallback match',
      body: historyRecord('MATCHING_PAGE', ['late-match']),
    });
    const result = await prepareHistory(
      f.supportKnowledge,
      profile,
      'one two three four five six seven eight nine ten eleven twelve late-match',
    );
    assert.equal(result.status, 'ready');
    assert.deepEqual(
      result.records.map(record => record.ref),
      [`${scope}#${path}`],
    );
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
    const store = await f.supportKnowledge.getStorage();
    const search = store.searchPages.bind(store);
    const searched = new Map<string, string[]>();
    store.searchPages = async input => {
      const hits = await search(input);
      searched.set(
        input.query,
        hits.map(hit => hit.page.id),
      );
      return hits;
    };
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

test('a page or note removed after native search does not enter scoped history', { timeout: 30000 }, async () => {
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
    const store = await supportKnowledge.getStorage();
    const search = store.searchPages.bind(store);
    let noteRemoved = false;
    let pageRemoved = false;
    store.searchPages = async input => {
      const hits = await search(input);
      if (!noteRemoved && hits.some(hit => hit.type === 'note' && hit.note.id === note.id)) {
        noteRemoved = true;
        await supportKnowledge.removeNote({ id: note.id, author: 'synthetic-fixture' });
      }
      if (!pageRemoved && hits.some(hit => hit.page.id === deleted.id)) {
        pageRemoved = true;
        await supportKnowledge.removePage({ scope, path: deletedPath, author: 'synthetic-fixture' });
      }
      return hits;
    };
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
        assert.equal((await snapshot.getPages({ ids: [page.id], read: 'all' })).length, 1);
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
      store.getNote = input => {
        if (input.read !== 'all' && (input.id === note.id || input.id === removed.id)) listedNotePointReads++;
        return getNote(input);
      };
      const search = store.searchPages.bind(store);
      store.searchPages = async input => {
        const hits = await search(input);
        matchingHits += hits.filter(hit => hit.type === 'note' && hit.note.id === note.id).length;
        return hits;
      };
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

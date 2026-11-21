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

test('a note removed after native search does not enter scoped history', { timeout: 30000 }, async () => {
  const f = await runtimeFixture();
  try {
    const { supportKnowledge } = f;
    const { noteRef } = await generateHistoryCorpus(supportKnowledge);
    const id = noteRef.split('?note=')[1]!;
    const store = await supportKnowledge.getStorage();
    const search = store.searchPages.bind(store);
    let removed = false;
    store.searchPages = async input => {
      const hits = await search(input);
      if (!removed && hits.some(hit => hit.type === 'note' && hit.note.id === id)) {
        removed = true;
        await supportKnowledge.removeNote({ id, author: 'synthetic-fixture' });
      }
      return hits;
    };
    const result = await prepareHistory(supportKnowledge, profile, 'network printer');
    assert.ok(removed, 'The note must be removed after the scoped search returned it');
    assert.ok(result.records.some(record => record.summary === 'BEST_A'));
    assert.ok(result.records.every(record => record.ref !== noteRef));
  } finally {
    await f.close();
  }
});

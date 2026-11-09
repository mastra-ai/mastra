import { runExperiment } from '@mastra/core/datasets';
import { describe, expect, it } from 'vitest';
import { goldenThreadFixture } from './fixtures/golden-thread';

describe('when replaying a production conversation through the HTTP API', () => {
  it('previews and persists ten turns, scores the baseline, and leaves the source unchanged', async () => {
    const { app, mastra, memory, storage, liveCalls, trajectory, similarity } = await goldenThreadFixture();
    try {
      const store = (await storage.getStore('memory'))!;
      const before = await store.listMessages({ threadId: 'golden-thread', perPage: false });
      const stateBefore = await memory.getWorkingMemory({ threadId: 'golden-thread', resourceId: 'support' });
      const request = (path: string, body: unknown) =>
        app.request(`/api${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const source = { agentId: 'support', threadId: 'golden-thread', resourceId: 'support' };
      const preview = await request('/datasets/replay/preview', source);
      expect(preview.status).toBe(200);
      expect(await preview.json()).toEqual({ turnCount: 10, historyLimit: 10 });
      const dataset = await mastra.datasets.create({
        name: 'Golden thread replay',
        targetType: 'agent',
        targetIds: ['support'],
      });
      const response = await request(`/datasets/${dataset.id}/items/from-thread`, source);
      const converted = await response.json();
      expect(converted, JSON.stringify(converted)).toMatchObject({ turnCount: 10, itemIds: expect.any(Array) });
      expect(response.status).toBe(200);
      expect(converted.itemIds).toHaveLength(10);
      const itemsBefore = structuredClone(await dataset.listItems({ perPage: 100 }));
      expect(itemsBefore.items.map(item => item.memorySeed?.workingMemory)).toEqual(
        Array(10).fill('# Customer\nAda Lovelace — priority support'),
      );
      liveCalls.length = 0;
      const baseline = await runExperiment(mastra, {
        datasetId: dataset.id,
        targetType: 'agent',
        targetId: 'support',
        scorers: [trajectory, similarity],
        maxConcurrency: 1,
      });
      expect(baseline.results.map(result => result.error)).toEqual(Array(10).fill(null));
      expect(baseline.succeededCount).toBe(10);
      for (const result of baseline.results) {
        expect(result.scores).toHaveLength(2);
        for (const score of result.scores) expect(score.score, JSON.stringify(score)).toBeGreaterThanOrEqual(0.9);
        expect(result.toolMockReport?.served).toHaveLength(1);
        expect(result.toolMockReport?.misses).toEqual([]);
      }
      const external = await dataset.createExperiment({ targetType: 'agent', targetId: 'support' });
      const item = await dataset.runExperimentItem({
        experimentId: external.experimentId,
        itemId: converted.itemIds[0],
      });
      expect(item.result.error).toBeNull();
      expect(item.result.toolMockReport?.served).toHaveLength(1);
      expect(liveCalls).toEqual([]);
      expect(await dataset.listItems({ perPage: 100 })).toEqual(itemsBefore);
      expect(await store.listMessages({ threadId: 'golden-thread', perPage: false })).toEqual(before);
      expect(await memory.getWorkingMemory({ threadId: 'golden-thread', resourceId: 'support' })).toBe(stateBefore);
      const forbidden = await request(`/datasets/${dataset.id}/items/from-thread`, {
        ...source,
        resourceId: 'another-customer',
      });
      expect(forbidden.status).toBe(403);
      expect((await dataset.listItems({ perPage: 100 })).items).toHaveLength(10);
      // Dataset errors map to HTTP statuses like the other item-writing routes.
      const missing = await request('/datasets/does-not-exist/items/from-thread', source);
      expect(missing.status).toBe(404);
    } finally {
      await mastra.observability.shutdown();
    }
  }, 60000);

  it('gives independent turns no history when the agent memory disables recall', async () => {
    // Memory `lastMessages: false` is "no recall"; replay must not read it as its own `false` ("all history").
    const { app, mastra } = await goldenThreadFixture({ replayLastMessages: false });
    try {
      const request = (path: string, body: unknown) =>
        app.request(`/api${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const source = { agentId: 'support', threadId: 'golden-thread', resourceId: 'support' };
      const preview = await request('/datasets/replay/preview', source);
      expect(await preview.json()).toEqual({ turnCount: 10, historyLimit: 0 });
      const dataset = await mastra.datasets.create({ name: 'No recall', targetType: 'agent', targetIds: ['support'] });
      const response = await request(`/datasets/${dataset.id}/items/from-thread`, source);
      expect(response.status).toBe(200);
      const { items } = await dataset.listItems({ perPage: 100 });
      expect(items).toHaveLength(10);
      // Each item carries only its own user message, matching what the production agent saw.
      expect(items.map(item => (item.input as { role: string }[]).map(message => message.role))).toEqual(
        Array(10).fill(['user']),
      );
    } finally {
      await mastra.observability.shutdown();
    }
  }, 60000);
});

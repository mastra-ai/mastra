/**
 * Round-trip tests for the libsql-backed WorkflowDefinitionsStorage domain.
 *
 * Verifies the same contract the in-memory impl ships:
 *  - upsert acts as create-or-update keyed by id
 *  - get / list / delete behave as documented
 *  - JSON columns (graph, schemas, metadata) survive the SQLite TEXT round-trip
 *  - the domain is reachable through the LibSQLStore composite
 */
import { createClient } from '@libsql/client';
import { TABLE_WORKFLOW_DEFINITIONS } from '@mastra/core/storage';
import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../index';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const inputSchema = {
  type: 'object',
  properties: { location: { type: 'string' } },
  required: ['location'],
};
const outputSchema = {
  type: 'object',
  properties: { headline: { type: 'string' } },
  required: ['headline'],
};

const graph: SerializedStepFlowEntry[] = [
  { type: 'tool', id: 'get-weather', toolId: 'get-weather' },
  {
    type: 'mapping',
    id: 'mapping_0',
    mapConfig: JSON.stringify({
      headline: { template: '${inputData.location}: ${stepResults.get-weather.conditions}' },
    }),
  },
];

describe('WorkflowDefinitionsLibSQL', () => {
  let store: LibSQLStore;
  let client: ReturnType<typeof createClient>;

  beforeEach(async () => {
    // Fresh in-memory db per test for full isolation.
    client = createClient({ url: ':memory:' });
    store = new LibSQLStore({ id: 'wd-test', client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
  });

  afterEach(async () => {
    await store.close?.();
  });

  it('exposes workflow-definitions through the composite store', async () => {
    const wd = await store.getStore('workflowDefinitions');
    expect(wd).toBeDefined();
  });

  it('upsert creates on first call and updates on second', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;

    const created = await wd.upsert({
      id: 'wf-1',
      description: 'first',
      inputSchema,
      outputSchema,
      graph,
    });
    expect(created.id).toBe('wf-1');
    expect(created.description).toBe('first');
    expect(created.status).toBe('active');
    expect(created.source).toBe('storage');

    const updated = await wd.upsert({ id: 'wf-1', description: 'second' });
    expect(updated.id).toBe('wf-1');
    expect(updated.description).toBe('second');
    // schemas + graph are preserved across a partial update
    expect(updated.inputSchema).toEqual(inputSchema);
    expect(updated.graph).toEqual(graph);
  });

  it('updates authorId on an existing row and keeps createdAt stable', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;

    const created = await wd.upsert({
      id: 'wf-author',
      inputSchema,
      outputSchema,
      graph,
      authorId: 'author-1',
    });
    expect(created.authorId).toBe('author-1');

    await new Promise(r => setTimeout(r, 5));
    const updated = await wd.upsert({ id: 'wf-author', authorId: 'author-2' });
    expect(updated.authorId).toBe('author-2');
    expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());

    const fetched = await wd.get('wf-author');
    expect(fetched?.authorId).toBe('author-2');
  });

  it('round-trips JSON columns intact', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;
    await wd.upsert({
      id: 'wf-json',
      inputSchema,
      outputSchema,
      stateSchema: { type: 'object', properties: { phase: { type: 'string' } } },
      requestContextSchema: { type: 'object', properties: { userId: { type: 'string' } } },
      metadata: { owner: 'alice', tags: ['demo', 'weather'] },
      graph,
    });

    const fetched = await wd.get('wf-json');
    expect(fetched).not.toBeNull();
    expect(fetched!.inputSchema).toEqual(inputSchema);
    expect(fetched!.outputSchema).toEqual(outputSchema);
    expect(fetched!.stateSchema).toEqual({ type: 'object', properties: { phase: { type: 'string' } } });
    expect(fetched!.requestContextSchema).toEqual({ type: 'object', properties: { userId: { type: 'string' } } });
    expect(fetched!.metadata).toEqual({ owner: 'alice', tags: ['demo', 'weather'] });
    expect(fetched!.graph).toEqual(graph);
  });

  it('list filters by status and authorId', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;
    await wd.upsert({ id: 'wf-a', inputSchema, outputSchema, graph, authorId: 'alice' });
    await wd.upsert({ id: 'wf-b', inputSchema, outputSchema, graph, authorId: 'bob' });
    await wd.upsert({ id: 'wf-c', inputSchema, outputSchema, graph });
    // Archive one to test status filtering
    await wd.upsert({ id: 'wf-a', status: 'archived' });

    const all = await wd.list();
    expect(all.total).toBe(3);

    const active = await wd.list({ status: 'active' });
    expect(active.total).toBe(2);
    expect(active.definitions.map(d => d.id).sort()).toEqual(['wf-b', 'wf-c']);

    const archived = await wd.list({ status: 'archived' });
    expect(archived.total).toBe(1);
    expect(archived.definitions[0]?.id).toBe('wf-a');

    const byAuthor = await wd.list({ authorId: 'bob' });
    expect(byAuthor.total).toBe(1);
    expect(byAuthor.definitions[0]?.id).toBe('wf-b');
  });

  it('surfaces malformed JSON columns instead of returning the raw string', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;
    await wd.upsert({ id: 'wf-corrupt', inputSchema, outputSchema, graph });

    // Corrupt the graph column directly, simulating storage-level damage.
    await client.execute({
      sql: `UPDATE "${TABLE_WORKFLOW_DEFINITIONS}" SET graph = ? WHERE id = ?`,
      args: ['{not valid json', 'wf-corrupt'],
    });

    // Corruption must fail loudly at read time — never hydrate a definition
    // whose graph is a raw string. The SQL-level json() wrapper catches JSONB
    // corruption; the JS-level parseJson guard covers anything that slips
    // past it (e.g. legacy TEXT rows read without the wrapper).
    await expect(wd.get('wf-corrupt')).rejects.toThrow(/malformed JSON/i);
  });

  it('preserves a malformed schedule value for lenient rehydration diagnostics', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;
    await wd.upsert({
      id: 'wf-corrupt-schedule',
      inputSchema,
      outputSchema,
      graph,
      schedule: { cron: '0 0 * * *' },
    });

    await client.execute({
      sql: `UPDATE "${TABLE_WORKFLOW_DEFINITIONS}" SET schedule = ? WHERE id = ?`,
      args: ['{not valid json', 'wf-corrupt-schedule'],
    });

    const fetched = await wd.get('wf-corrupt-schedule');
    expect(fetched?.schedule).toBe('{not valid json');
  });

  it('falls back to update when a concurrent upsert wins the insert race', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;

    // Another writer already created the row…
    const winner = await wd.upsert({ id: 'wf-race', description: 'winner', inputSchema, outputSchema, graph });
    // Ensure the loser's timestamp would differ if it clobbered the winner's row.
    await new Promise(r => setTimeout(r, 10));

    // …but our upsert's existence check raced it and saw nothing. Simulate the
    // stale read deterministically: first get() returns null, later reads are real.
    const getSpy = vi.spyOn(wd, 'get');
    getSpy.mockImplementationOnce(async () => null);

    // The create branch's insert hits the PRIMARY KEY violation and must fall
    // back to the update path instead of surfacing the constraint error.
    const result = await wd.upsert({ id: 'wf-race', description: 'loser', inputSchema, outputSchema, graph });
    expect(result.description).toBe('loser');
    expect(result.createdAt.getTime()).toBe(winner.createdAt.getTime());

    getSpy.mockRestore();
    const fetched = await wd.get('wf-race');
    expect(fetched?.description).toBe('loser');
  });

  it('delete removes the row', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;
    await wd.upsert({ id: 'wf-doomed', inputSchema, outputSchema, graph });
    expect(await wd.get('wf-doomed')).not.toBeNull();

    await wd.delete('wf-doomed');
    expect(await wd.get('wf-doomed')).toBeNull();
    // Idempotent — second delete is a no-op
    await expect(wd.delete('wf-doomed')).resolves.not.toThrow();
  });

  it('dangerouslyClearAll wipes the table', async () => {
    const wd = (await store.getStore('workflowDefinitions'))!;
    await wd.upsert({ id: 'wf-x', inputSchema, outputSchema, graph });
    await wd.upsert({ id: 'wf-y', inputSchema, outputSchema, graph });
    expect((await wd.list()).total).toBe(2);

    await wd.dangerouslyClearAll();
    expect((await wd.list()).total).toBe(0);
  });
});

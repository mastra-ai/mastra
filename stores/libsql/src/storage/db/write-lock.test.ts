import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LibSQLStore } from '..';
import { withClientWriteLock } from './write-lock';

describe('withClientWriteLock', () => {
  // The WeakMap key is the client identity; a bare object is enough for unit tests.
  const fakeClient = (): Client => ({}) as Client;

  it('serializes concurrent calls on the same client (no overlap)', async () => {
    const client = fakeClient();
    let active = 0;
    let maxActive = 0;
    const order: number[] = [];

    const task = (id: number) =>
      withClientWriteLock(client, async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        // Yield a few times so an unserialized implementation would interleave.
        await new Promise(r => setTimeout(r, 5));
        await new Promise(r => setTimeout(r, 5));
        order.push(id);
        active--;
        return id;
      });

    const results = await Promise.all([task(1), task(2), task(3)]);

    expect(maxActive).toBe(1); // never more than one critical section at a time
    expect(order).toEqual([1, 2, 3]); // FIFO
    expect(results).toEqual([1, 2, 3]);
  });

  it('runs independently for different clients', async () => {
    const a = fakeClient();
    const b = fakeClient();
    let active = 0;
    let maxActive = 0;

    const task = (client: Client) =>
      withClientWriteLock(client, async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise(r => setTimeout(r, 10));
        active--;
      });

    await Promise.all([task(a), task(b)]);
    expect(maxActive).toBe(2); // separate clients are not serialized against each other
  });

  it('does not wedge the chain when a queued write rejects', async () => {
    const client = fakeClient();
    const settled: string[] = [];

    const failing = withClientWriteLock(client, async () => {
      throw new Error('boom');
    }).catch(() => settled.push('failed'));

    const following = withClientWriteLock(client, async () => {
      settled.push('ran-after-failure');
      return 'ok';
    });

    await failing;
    await expect(following).resolves.toBe('ok');
    expect(settled).toEqual(['failed', 'ran-after-failure']);
  });
});

describe('LibSQL concurrent writes across domains (regression)', () => {
  let tmpDir: string;
  let store: LibSQLStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-write-lock-'));
  });

  afterEach(async () => {
    await store?.close?.();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Reproduces the lost-write seen when the evented engine runs workflow snapshot
  // transactions concurrently with an unrelated autocommit insert on the shared
  // connection: the insert used to leak into the open transaction and vanish.
  it('keeps an experiment insert that races interactive workflow transactions', async () => {
    store = new LibSQLStore({ id: 'write-lock-regression', url: `file:${path.join(tmpDir, 'race.db')}` });
    const workflows = store.stores.workflows;
    const experiments = store.stores.experiments;
    await workflows.init();
    await experiments.init();

    const workflowName = 'race-workflow';
    const runId = 'race-run';
    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: {
        context: {},
        activePaths: [],
        timestamp: Date.now(),
        suspendedPaths: {},
        serializedStepGraph: [],
        status: 'running',
        value: {},
        runId,
      } as any,
    });

    // Fire many interactive workflow-state transactions concurrently with the
    // experiment insert — the exact interleaving that previously dropped the row.
    const churn = Array.from({ length: 12 }, (_, i) =>
      workflows.updateWorkflowState({
        workflowName,
        runId,
        opts: { status: 'running', activePaths: [i] },
      }),
    );

    const createdExperiment = experiments.createExperiment({
      datasetId: 'race-dataset',
      datasetVersion: 1,
      targetType: 'agent',
      targetId: 'race-agent',
      totalItems: 2,
    });

    const [experiment] = await Promise.all([createdExperiment, ...churn]);

    const listed = await experiments.listExperiments({
      datasetId: 'race-dataset',
      pagination: { page: 0, perPage: 10 },
    });

    expect(listed.experiments.map(e => e.id)).toContain(experiment.id);
  });
});

describe('LibSQL observational-memory write-lock regression', () => {
  let tmpDir: string;
  let store: LibSQLStore;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-om-lock-'));
  });

  afterEach(async () => {
    await store?.close?.();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Reproduces the lost-write path where OM buffering (read-modify-write on
  // bufferedObservationChunks) races interactive workflow transactions on the
  // same LibSQL client. Before OM participated in withClientWriteLock, the
  // autocommit SELECT+UPDATE inside updateBufferedObservations could be swept
  // into an open workflow transaction, causing lost chunks or transaction
  // contamination.
  it('preserves all OM buffered chunks that race workflow transactions', async () => {
    store = new LibSQLStore({ id: 'om-lock-regression', url: `file:${path.join(tmpDir, 'om-race.db')}` });
    const memory = store.stores.memory!;
    const workflows = store.stores.workflows!;
    await memory.init();
    await workflows.init();

    const resourceId = `resource-${randomUUID()}`;
    const record = await memory.initializeObservationalMemory({
      threadId: null,
      resourceId,
      scope: 'resource',
      config: { observationThreshold: 5000, reflectionThreshold: 40000 },
    });

    // Set up a workflow snapshot to churn against
    const workflowName = 'om-race-workflow';
    const runId = 'om-race-run';
    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: {
        context: {},
        activePaths: [],
        timestamp: Date.now(),
        suspendedPaths: {},
        serializedStepGraph: [],
        status: 'running',
        value: {},
        runId,
      } as any,
    });

    const CHUNK_COUNT = 10;
    const labels = Array.from({ length: CHUNK_COUNT }, (_, i) => `om-chunk-${i}`);

    // Fire workflow-state transactions concurrently with OM buffer appends —
    // the exact interleaving that previously dropped buffered chunks.
    const workflowChurn = Array.from({ length: 12 }, (_, i) =>
      workflows.updateWorkflowState({
        workflowName,
        runId,
        opts: { status: 'running', activePaths: [i] },
      }),
    );

    const omAppends = labels.map(label =>
      memory.updateBufferedObservations({
        id: record.id,
        chunk: {
          cycleId: `cycle-${randomUUID()}`,
          observations: label,
          tokenCount: 50,
          messageIds: [`msg-${randomUUID()}`],
          messageTokens: 100,
          lastObservedAt: new Date(),
        },
      }),
    );

    await Promise.all([...omAppends, ...workflowChurn]);

    const updated = await memory.getObservationalMemory(null, resourceId);
    const chunks = updated?.bufferedObservationChunks ?? [];
    expect(chunks.length).toBe(CHUNK_COUNT);

    // Every uniquely identified chunk must be present — no lost writes.
    const observations = chunks.map(c => c.observations).sort();
    const expected = [...labels].sort();
    expect(observations).toEqual(expected);

    // The workflow snapshot must also survive the contention.
    const snapshot = await workflows.loadWorkflowSnapshot({ workflowName, runId });
    expect(snapshot).toBeDefined();
  });

  // Verifies that a failed OM operation does not contaminate or roll back
  // unrelated work that committed on the same client.
  it('does not contaminate unrelated writes when an OM operation fails', async () => {
    store = new LibSQLStore({ id: 'om-fail-regression', url: `file:${path.join(tmpDir, 'om-fail.db')}` });
    const memory = store.stores.memory!;
    await memory.init();

    const resourceId = `resource-${randomUUID()}`;
    const record = await memory.initializeObservationalMemory({
      threadId: null,
      resourceId,
      scope: 'resource',
      config: { observationThreshold: 5000, reflectionThreshold: 40000 },
    });

    // A valid flag update that should succeed and persist.
    await memory.setObservingFlag(record.id, true);

    // A failing OM operation — referencing a non-existent record id.
    await expect(
      memory.updateBufferedObservations({
        id: 'nonexistent-id',
        chunk: {
          cycleId: 'cycle-fail',
          observations: 'should-fail',
          tokenCount: 50,
          messageIds: ['msg-fail'],
          messageTokens: 100,
          lastObservedAt: new Date(),
        },
      }),
    ).rejects.toThrow();

    // The valid flag update must still be visible — the failure did not roll
    // it back or contaminate the client state.
    const updated = await memory.getObservationalMemory(null, resourceId);
    expect(updated?.isObserving).toBe(true);
  });
});

/**
 * The durable experiment workflow (`__mastra-experiment`): real Mastra, real
 * evented engine, real in-memory storage, and a real workflow as the target.
 */
import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createScorer } from '../../../evals/base';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { PubSub } from '../../../events/pubsub';
import type { Event, EventCallback } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MASTRA_AUTH_TOKEN_KEY } from '../../../request-context';
import { InMemoryStore } from '../../../storage';
import { createStep, createWorkflow } from '../../../workflows';
import { EXPERIMENT_NOT_DURABLE } from '../durable';
import type { StartExperimentAsyncConfig } from '../types';
import { EXPERIMENT_WORKFLOW_ID } from '../workflow';
import type { ExperimentWorkflowInput } from '../workflow';

const TextInput = z.object({ text: z.string() });

const newLog = () => ({ calls: [] as string[], contexts: [] as unknown[], inFlight: 0, maxInFlight: 0 });

/** A target workflow that logs each call, can be slow, and fails on `boom`. */
function echoTarget(log: ReturnType<typeof newLog>, delayMs = 0) {
  const step = createStep({
    id: 'echo',
    inputSchema: TextInput,
    outputSchema: TextInput,
    execute: async ({ inputData, requestContext }) => {
      log.calls.push(inputData.text);
      log.contexts.push(requestContext.get('user'));
      log.inFlight += 1;
      log.maxInFlight = Math.max(log.maxInFlight, log.inFlight);
      try {
        if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
        if (inputData.text === 'boom') throw new Error('target failed');
        return { text: inputData.text.toUpperCase() };
      } finally {
        log.inFlight -= 1;
      }
    },
  });
  return createWorkflow({ id: 'echo-target', inputSchema: TextInput, outputSchema: TextInput }).then(step).commit();
}

interface Setup {
  mastra: Mastra;
  storage: InMemoryStore;
  input: ExperimentWorkflowInput;
}

/** Seed a dataset and create an experiment targeting the echo workflow. */
async function seed(
  mastra: Mastra,
  texts: string[],
  run: Partial<ExperimentWorkflowInput> = {},
): Promise<ExperimentWorkflowInput> {
  const dataset = await mastra.datasets.create({ name: `durable-${randomUUID()}` });
  await dataset.addItems({ items: texts.map(text => ({ input: { text } })) });
  const { experimentId } = await dataset.createExperiment({
    targetType: 'workflow',
    targetId: 'echo-target',
    scorers: [],
  });
  return { datasetId: dataset.id, experimentId, ...run };
}

async function startRun(mastra: Mastra, input: ExperimentWorkflowInput) {
  await mastra.__ensureExperimentWorkflow();
  const run = await mastra.__getInternalWorkflow(EXPERIMENT_WORKFLOW_ID).createRun({ runId: input.experimentId });
  await run.startAsync({ inputData: input });
}

async function waitForExperiment(storage: InMemoryStore, experimentId: string, timeoutMs = 10_000) {
  const experiments = (await storage.getStore('experiments'))!;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const experiment = await experiments.getExperimentById({ id: experimentId });
    if (experiment?.status === 'completed' || experiment?.status === 'failed') return experiment;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`experiment ${experimentId} did not finish within ${timeoutMs}ms`);
}

async function resultRows(storage: InMemoryStore, experimentId: string) {
  const experiments = (await storage.getStore('experiments'))!;
  const { results } = await experiments.listExperimentResults({
    experimentId,
    pagination: { page: 0, perPage: 100 },
  });
  return results;
}

async function workflowStatus(storage: InMemoryStore, runId: string, timeoutMs = 5_000) {
  const workflows = (await storage.getStore('workflows'))!;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: EXPERIMENT_WORKFLOW_ID, runId });
    if (snapshot && snapshot.status !== 'running' && snapshot.status !== 'pending') return snapshot.status;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: EXPERIMENT_WORKFLOW_ID, runId });
  return snapshot ? 'running' : 'no run';
}

const alwaysOne = createScorer({ id: 'always-one', description: 'Scores every item 1' }).generateScore(() => 1);

describe('durable experiment workflow', () => {
  const started: Mastra[] = [];

  afterEach(async () => {
    const mastras = started.splice(0);
    await Promise.all(mastras.map(mastra => mastra.stopWorkers()));
    // The scorer hook lives on a process-wide emitter; release it so these
    // instances don't keep handling scorer runs in later tests.
    for (const mastra of mastras) mastra.__unregisterHooks();
  });

  async function setup(log: ReturnType<typeof newLog>, delayMs = 0): Promise<Omit<Setup, 'input'>> {
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      workflows: { 'echo-target': echoTarget(log, delayMs) },
      scorers: { 'always-one': alwaysOne },
      storage,
      pubsub: new EventEmitterPubSub(),
      logger: false,
    });
    await mastra.startWorkers();
    started.push(mastra);
    return { mastra, storage };
  }

  it('is registered when workers start, so a worker can pick up runs it did not start', async () => {
    const { mastra } = await setup(newLog());
    expect(mastra.__hasInternalWorkflow(EXPERIMENT_WORKFLOW_ID)).toBe(true);
  });

  it('runs every item once, records target errors on their row and completes', async () => {
    const log = newLog();
    const { mastra, storage } = await setup(log);
    const input = await seed(mastra, ['paris', 'boom', 'tokyo', 'rome']);

    await startRun(mastra, input);
    const experiment = await waitForExperiment(storage, input.experimentId);

    expect(experiment).toMatchObject({ status: 'completed', succeededCount: 3, failedCount: 1, skippedCount: 0 });
    expect(experiment.startedAt).toBeInstanceOf(Date);
    expect(log.calls.sort()).toEqual(['boom', 'paris', 'rome', 'tokyo']);

    const rows = await resultRows(storage, input.experimentId);
    expect(rows).toHaveLength(4);
    expect(rows.find(row => (row.input as { text: string }).text === 'boom')?.error?.message).toMatch(/target failed/);
    expect(await workflowStatus(storage, input.experimentId)).toBe('success');
  });

  it('marks the experiment failed when setup fails', async () => {
    const log = newLog();
    const { mastra, storage } = await setup(log);
    const seeded = await seed(mastra, ['paris']);
    // An experiment whose target was removed after it was created.
    const experiments = (await storage.getStore('experiments'))!;
    const { datasetVersion } = (await experiments.getExperimentById({ id: seeded.experimentId }))!;
    const orphan = await experiments.createExperiment({
      datasetId: seeded.datasetId,
      datasetVersion,
      targetType: 'workflow',
      targetId: 'removed-workflow',
      totalItems: 1,
    });
    const input = { datasetId: seeded.datasetId, experimentId: orphan.id };

    await startRun(mastra, input);
    const experiment = await waitForExperiment(storage, input.experimentId);

    expect(experiment.status).toBe('failed');
    expect(experiment.completedAt).toBeInstanceOf(Date);
    expect(await resultRows(storage, input.experimentId)).toEqual([]);
    expect(log.calls).toEqual([]);
    expect(await workflowStatus(storage, input.experimentId)).toBe('failed');
  });

  describe('a run naming another project', () => {
    // Created `pending`, the way a durable start leaves it before `prepare` runs.
    async function seedProject(mastra: Mastra, projectId: string) {
      const dataset = await mastra.datasets.create({ name: `durable-${projectId}`, projectId });
      await dataset.addItems({ items: [{ input: { text: projectId } }] });
      const { version } = await dataset.getDetails();
      const experiments = (await mastra.getStorage()!.getStore('experiments'))!;
      const experiment = await experiments.createExperiment({
        datasetId: dataset.id,
        datasetVersion: version,
        targetType: 'workflow',
        targetId: 'echo-target',
        totalItems: 1,
        projectId,
      });
      return { datasetId: dataset.id, experimentId: experiment.id, projectId };
    }

    const cases: [
      name: string,
      forge: (a: ExperimentWorkflowInput, b: ExperimentWorkflowInput) => ExperimentWorkflowInput,
    ][] = [
      ['its own dataset with the other project experiment', (a, b) => ({ ...a, experimentId: b.experimentId })],
      ['the other project dataset under its own project', (a, b) => ({ ...b, projectId: a.projectId })],
    ];

    it.each(cases)('fails without touching the experiment: %s', async (_name, forge) => {
      const log = newLog();
      const { mastra, storage } = await setup(log);
      const a = await seedProject(mastra, 'project-a');
      const b = await seedProject(mastra, 'project-b');
      const forged = forge(a, b);
      const experiments = (await storage.getStore('experiments'))!;
      const before = await experiments.getExperimentById({ id: b.experimentId });

      await startRun(mastra, forged);

      expect(await workflowStatus(storage, forged.experimentId)).toBe('failed');
      expect(await experiments.getExperimentById({ id: b.experimentId })).toEqual(before);
      expect(await resultRows(storage, b.experimentId)).toEqual([]);
      expect(log.calls).toEqual([]);
    });
  });

  it('runs at most maxConcurrency items at once', async () => {
    const log = newLog();
    const { mastra, storage } = await setup(log, 50);
    const input = await seed(mastra, ['a', 'b', 'c', 'd', 'e'], { maxConcurrency: 2 });

    await startRun(mastra, input);
    const experiment = await waitForExperiment(storage, input.experimentId);

    expect(experiment).toMatchObject({ status: 'completed', succeededCount: 5 });
    expect(log.maxInFlight).toBe(2);
  });

  it('passes the run options to every item', async () => {
    const log = newLog();
    const { mastra, storage } = await setup(log, 2_000);
    const input = await seed(mastra, ['slow'], { itemTimeout: 50 });

    await startRun(mastra, input);
    const experiment = await waitForExperiment(storage, input.experimentId);

    expect(experiment).toMatchObject({ status: 'completed', failedCount: 1 });
    const [row] = await resultRows(storage, input.experimentId);
    expect(row?.error?.message).toMatch(/timeout/i);
  });

  it('ignores a redelivered step event once the step finished', async () => {
    const log = newLog();
    const { mastra, storage } = await setup(log);
    const delivered: Event[] = [];
    await mastra.pubsub.subscribe('workflows', async (event, ack) => {
      if (event.type === 'workflow.step.run') delivered.push(event);
      await ack?.();
    });
    const input = await seed(mastra, ['paris', 'tokyo']);

    await startRun(mastra, input);
    await waitForExperiment(storage, input.experimentId);
    expect(await workflowStatus(storage, input.experimentId)).toBe('success');
    expect(delivered.length).toBeGreaterThan(0);

    for (const event of delivered) {
      const outcome = await mastra.handleWorkflowEvent(event);
      expect(outcome.ok).toBe(true);
    }

    expect(log.calls.sort()).toEqual(['paris', 'tokyo']);
    expect(await resultRows(storage, input.experimentId)).toHaveLength(2);
    expect(await waitForExperiment(storage, input.experimentId)).toMatchObject({
      status: 'completed',
      succeededCount: 2,
    });
  });

  describe('startExperimentAsync({ durable: true })', () => {
    const echoConfig = { targetType: 'workflow', targetId: 'echo-target' } as const;

    it('runs the experiment as the experiment workflow, keyed by the experiment id', async () => {
      const log = newLog();
      const { mastra, storage } = await setup(log);
      const dataset = await mastra.datasets.create({ name: 'durable-start' });
      await dataset.addItems({ items: ['paris', 'boom', 'tokyo'].map(text => ({ input: { text } })) });

      const started = await dataset.startExperimentAsync({
        ...echoConfig,
        durable: true,
        maxConcurrency: 2,
        scorers: ['always-one'],
      });

      expect(started).toMatchObject({ status: 'pending', totalItems: 3 });
      const experiment = await waitForExperiment(storage, started.experimentId);
      expect(experiment).toMatchObject({
        status: 'completed',
        succeededCount: 2,
        failedCount: 1,
        scorerIds: ['always-one'],
      });
      expect(await workflowStatus(storage, started.experimentId)).toBe('success');
      expect(log.calls.sort()).toEqual(['boom', 'paris', 'tokyo']);

      const scores = (await storage.getStore('scores'))!;
      const { scores: rows } = await scores.listScoresByRunId({
        runId: started.experimentId,
        pagination: { page: 0, perPage: 10 },
      });
      expect(rows.map(row => row.score)).toEqual([1, 1, 1]);
    });

    it('stores the item metadata on each row, as the in-process runner does', async () => {
      const { mastra, storage } = await setup(newLog());
      const dataset = await mastra.datasets.create({ name: 'durable-metadata' });
      await dataset.addItems({ items: [{ input: { text: 'paris' }, metadata: { split: 'holdout' } }] });

      const durable = await dataset.startExperimentAsync({ ...echoConfig, durable: true });
      const inProcess = await dataset.startExperimentAsync(echoConfig);
      await waitForExperiment(storage, durable.experimentId);
      await waitForExperiment(storage, inProcess.experimentId);

      const [durableRow] = await resultRows(storage, durable.experimentId);
      const [inProcessRow] = await resultRows(storage, inProcess.experimentId);
      expect(inProcessRow?.metadata).toEqual({ split: 'holdout' });
      expect(durableRow?.metadata).toEqual(inProcessRow?.metadata);
    });

    it('keeps the in-process path without the option', async () => {
      const log = newLog();
      const { mastra, storage } = await setup(log);
      const dataset = await mastra.datasets.create({ name: 'in-process-start' });
      await dataset.addItems({ items: [{ input: { text: 'paris' } }] });

      const started = await dataset.startExperimentAsync(echoConfig);

      expect(await waitForExperiment(storage, started.experimentId)).toMatchObject({ status: 'completed' });
      expect(await workflowStatus(storage, started.experimentId, 0)).toBe('no run');
    });

    const rejected: [option: string, config: Partial<StartExperimentAsyncConfig>][] = [
      ['task', { targetType: undefined, targetId: undefined, task: ({ input }) => input }],
      ['targetType', { targetType: undefined, targetId: undefined }],
      ['beforeAll', { beforeAll: () => {} }],
      ['beforeEach', { beforeEach: () => {} }],
      ['afterEach', { afterEach: () => {} }],
      ['afterAll', { afterAll: () => {} }],
      ['onEvent', { onEvent: async () => {} }],
      ['signal', { signal: new AbortController().signal }],
      ['scorers', { scorers: [alwaysOne] }],
      ['persistence', { persistence: { experiments: 'none' } }],
      ['persistence', { persistence: { scores: 'none' } }],
      ['agentModel', { targetType: 'agent', targetId: 'any-agent', agentModel: new MockLanguageModelV2() }],
      ['requestContext', { requestContext: { callback: () => 1 } }],
      ['requestContext', { requestContext: { user: { tags: ['a', { format: () => 'x' }] } } }],
      ['requestContext', { requestContext: { since: new Date() } }],
      ['requestContext', { requestContext: { missing: undefined } }],
      ['requestContext', { requestContext: { ratio: Number.NaN } }],
      ['maxConcurrency', { maxConcurrency: 0 }],
      ['maxConcurrency', { maxConcurrency: 2.5 }],
      ['itemTimeout', { itemTimeout: 0 }],
      ['maxRetries', { maxRetries: -1 }],
    ];

    it('carries a plain JSON requestContext to the target', async () => {
      const log = newLog();
      const { mastra, storage } = await setup(log);
      const dataset = await mastra.datasets.create({ name: 'durable-context' });
      await dataset.addItems({ items: [{ input: { text: 'paris' } }] });
      const user = { id: 'u1', tags: ['a', 1, true, null], nested: { level: 2 } };

      const started = await dataset.startExperimentAsync({ ...echoConfig, durable: true, requestContext: { user } });

      expect(await waitForExperiment(storage, started.experimentId)).toMatchObject({ status: 'completed' });
      expect(log.contexts).toEqual([user]);
    });

    it("keeps the caller's auth token and user out of the events and the snapshot", async () => {
      const { mastra, storage } = await setup(newLog());
      const events: Event[] = [];
      await mastra.pubsub.subscribe('workflows', event => {
        events.push(event);
      });
      const dataset = await mastra.datasets.create({ name: 'durable-live-keys' });
      await dataset.addItems({ items: [{ input: { text: 'paris' } }] });

      const started = await dataset.startExperimentAsync({
        ...echoConfig,
        durable: true,
        requestContext: {
          [MASTRA_AUTH_TOKEN_KEY]: 'secret-token',
          mastra__user: { id: 'secret-user' },
          mastra__userPermissions: ['secret-permission'],
          // The auth middleware's unprefixed copy of the user goes with it.
          user: { id: 'secret-user' },
          projectId: 'project-1',
        },
      });

      expect(await waitForExperiment(storage, started.experimentId)).toMatchObject({ status: 'completed' });
      const workflows = (await storage.getStore('workflows'))!;
      const snapshot = await workflows.loadWorkflowSnapshot({
        workflowName: EXPERIMENT_WORKFLOW_ID,
        runId: started.experimentId,
      });
      expect(snapshot).toBeTruthy();
      expect(events.length).toBeGreaterThan(0);
      for (const stored of [JSON.stringify(events), JSON.stringify(snapshot)]) {
        expect(stored).not.toContain('secret-');
      }
      expect(events[0]?.data.prevResult.output.requestContext).toEqual({ projectId: 'project-1' });
    });

    it.each(rejected)('rejects `%s` before creating anything', async (option, overrides) => {
      const { mastra } = await setup(newLog());
      const dataset = await mastra.datasets.create({ name: `rejects-${option}` });
      await dataset.addItems({ items: [{ input: { text: 'paris' } }] });

      const start = dataset.startExperimentAsync({ ...echoConfig, ...overrides, durable: true });

      await expect(start).rejects.toMatchObject({ id: EXPERIMENT_NOT_DURABLE });
      await expect(start).rejects.toThrow(`\`${option}\``);
      expect((await dataset.listExperiments()).experiments).toEqual([]);
    });
  });
});

/**
 * A broker that only queues: nothing is delivered until the test hands an
 * event to a Mastra, the way a push queue (e.g. Cloud Tasks) calls a handler.
 */
class QueuePubSub extends PubSub {
  readonly queue: Event[] = [];

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void> {
    if (topic === 'workflows') this.queue.push({ ...event, id: randomUUID(), createdAt: new Date() });
  }
  async subscribe(_topic: string, _cb: EventCallback): Promise<void> {}
  async unsubscribe(_topic: string, _cb: EventCallback): Promise<void> {}
  async flush(): Promise<void> {}
}

describe('durable experiment workflow, one fresh Mastra per event', () => {
  const created: Mastra[] = [];

  // No `shutdown()`: every instance shares the storage and broker.
  afterEach(() => {
    for (const mastra of created.splice(0)) mastra.__unregisterHooks();
  });

  it('completes when every event is handled by a new Mastra that never started it', async () => {
    const log = newLog();
    const storage = new InMemoryStore();
    const broker = new QueuePubSub();
    const freshMastra = () => {
      const mastra = new Mastra({
        workflows: { 'echo-target': echoTarget(log) },
        storage,
        pubsub: broker,
        logger: false,
      });
      created.push(mastra);
      return mastra;
    };

    const starter = freshMastra();
    const input = await seed(starter, ['paris', 'boom', 'tokyo'], { maxConcurrency: 2 });
    await startRun(starter, input);

    let handled = 0;
    while (broker.queue.length > 0) {
      const event = broker.queue.shift()!;
      const outcome = await freshMastra().handleWorkflowEvent(event);
      expect(outcome).toEqual({ ok: true });
      handled += 1;
      if (handled > 200) throw new Error('event loop did not settle');
    }

    expect(await waitForExperiment(storage, input.experimentId, 1_000)).toMatchObject({
      status: 'completed',
      succeededCount: 2,
      failedCount: 1,
    });
    expect(log.calls.sort()).toEqual(['boom', 'paris', 'tokyo']);
    expect(await resultRows(storage, input.experimentId)).toHaveLength(3);
  });
});

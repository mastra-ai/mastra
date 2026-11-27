import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow, WorkflowEventProcessor } from '@mastra/core/workflows/evented';
import { createClient } from 'redis';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { RedisStreamsPubSub } from './index';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

describe('localOnly evented workflow redelivery', () => {
  let mastra: Mastra | undefined;
  let pubsub: RedisStreamsPubSub | undefined;

  afterEach(async () => {
    await mastra?.stopWorkers();
    await pubsub?.close();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('executes a run-scoped workflow on its owner without creating an owner stream in Redis', async () => {
    const prefix = `owner-routing-${randomUUID()}`;
    const bus = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: prefix, blockMs: 50 });
    const publish = vi.spyOn(bus, 'publish');
    const redis = createClient({ url: REDIS_URL });
    const schema = z.object({ value: z.string() });
    const makeWorkflow = (value: string) =>
      createWorkflow({ id: 'owner-route', inputSchema: schema, outputSchema: schema })
        .then(createStep({ id: 'answer', inputSchema: schema, outputSchema: schema, execute: async () => ({ value }) }))
        .commit();
    const workflow = makeWorkflow('owner');
    const sibling = new Mastra({
      workflows: { workflow: makeWorkflow('sibling') },
      pubsub: bus,
      storage: new InMemoryStore(),
      logger: false,
    });
    const owner = new Mastra({ workflows: { workflow }, pubsub: bus, storage: new InMemoryStore(), logger: false });
    await redis.connect();
    try {
      await sibling.startWorkers('orchestration');
      await owner.startWorkers('orchestration');
      const run = await workflow.createRun();
      owner.__registerInternalWorkflow(workflow, run.runId);
      const output = run.stream({ inputData: { value: 'input' } });
      const events = [];
      const observer = run.observeStream().getReader();
      try {
        for (;;) {
          const { done, value } = await observer.read();
          if (done) break;
          events.push(value);
        }
      } finally {
        observer.releaseLock();
      }
      expect(await output.result).toMatchObject({ status: 'success', result: { value: 'owner' } });
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'workflow-step-start',
            runId: run.runId,
            payload: expect.objectContaining({ stepName: 'answer' }),
          }),
          expect.objectContaining({
            type: 'workflow-step-result',
            runId: run.runId,
            payload: expect.objectContaining({ output: { value: 'owner' } }),
          }),
        ]),
      );
      expect(publish).toHaveBeenCalledWith(
        expect.stringMatching(/^workflows\.local\./),
        expect.objectContaining({ type: 'workflow.start', runId: run.runId }),
        { localOnly: true },
      );
      expect(await redis.exists(bus.streamKey('workflows'))).toBe(1);
      for await (const keys of redis.scanIterator({ MATCH: `${prefix}:workflows.local.*` })) {
        expect(keys).toEqual([]);
      }
    } finally {
      await Promise.all([sibling.stopWorkers(), owner.stopWorkers()]);
      await bus.close();
      for await (const keys of redis.scanIterator({ MATCH: `${prefix}:*` })) {
        if (keys.length) await redis.del(keys);
      }
      await redis.quit();
    }
  }, 15_000);

  it.each([1, 3])(
    'settles the run after %i injected processing failures',
    async failures => {
      vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'true');
      const workflowId = `local-retry-${randomUUID()}`;
      const workflow = createWorkflow({
        id: workflowId,
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.object({ value: z.number() }),
      })
        .then(
          createStep({
            id: 'double',
            inputSchema: z.object({ value: z.number() }),
            outputSchema: z.object({ value: z.number() }),
            execute: async ({ inputData }) => ({ value: inputData.value * 2 }),
          }),
        )
        .commit();
      pubsub = new RedisStreamsPubSub({ url: REDIS_URL, keyPrefix: workflowId, blockMs: 50 });
      const publish = pubsub.publish.bind(pubsub);
      const publications = vi
        .spyOn(pubsub, 'publish')
        .mockImplementation((topic, event, options) =>
          publish(
            topic,
            event,
            topic === 'workflows' && event.data?.workflowId === workflowId ? { localOnly: true } : options,
          ),
        );
      mastra = new Mastra({ workflows: { workflow }, storage: new InMemoryStore(), pubsub, logger: false });
      await mastra.startWorkers('orchestration');
      const run = await mastra.getWorkflow('workflow').createRun();
      const loadData = WorkflowEventProcessor.prototype.loadData;
      let injected = 0;
      vi.spyOn(WorkflowEventProcessor.prototype, 'loadData').mockImplementation(
        function (this: WorkflowEventProcessor, args) {
          if (args.workflowId === workflowId && args.runId === run.runId && injected < failures) {
            injected++;
            return Promise.reject(new Error('LOADING Redis is loading the dataset in memory'));
          }
          return loadData.call(this, args);
        },
      );
      const deliveries = vi.spyOn(WorkflowEventProcessor.prototype, 'handle');
      const started = Date.now();
      const result = await run.start({ inputData: { value: 21 } });
      const starts = deliveries.mock.calls
        .map(([event]) => event)
        .filter(event => event.runId === run.runId && event.type === 'workflow.start');
      expect(injected).toBe(failures);
      expect(starts.map(event => event.deliveryAttempt)).toEqual(failures === 1 ? [1, 2] : [1, 2, 3]);
      expect(new Set(starts.map(event => event.id)).size).toBe(1);
      expect(Date.now() - started).toBeGreaterThanOrEqual(failures === 1 ? 1000 : 3000);
      const failPublications = () =>
        publications.mock.calls.filter(
          ([topic, event]) => topic === 'workflows' && event.runId === run.runId && event.type === 'workflow.fail',
        );
      if (failures === 1) {
        expect(result.status).toBe('success');
        if (result.status === 'success') expect(result.result).toEqual({ value: 42 });
        expect(failPublications()).toHaveLength(0);
      } else {
        expect(result.status).toBe('failed');
        expect(failPublications()).toHaveLength(1);
      }
      const count = deliveries.mock.calls.length;
      await new Promise(resolve => setTimeout(resolve, 4100));
      expect(deliveries.mock.calls).toHaveLength(count);
    },
    20_000,
  );
});

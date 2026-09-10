import { TripWire } from '@mastra/core/agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { init } from './index';

describe('native workflow guard terminal after serialized execution', () => {
  it.each([false, true])(
    'preserves a final guard rejection and skips following work: retry=%s',
    async retry => {
      const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network forbidden'));
      const inngest = new Inngest({ id: 'guard-workflow-test', isDev: true });
      let handler: ((context: any) => Promise<any>) | undefined;
      const originalCreate = inngest.createFunction.bind(inngest);
      vi.spyOn(inngest, 'createFunction').mockImplementation(((config: any, fn: any) => {
        handler = fn;
        return originalCreate(config, fn);
      }) as any);
      const { createWorkflow, createStep } = init(inngest);
      const guard = {
        reason: 'Final answer rejected',
        retry,
        metadata: { policy: 'workflow-guard' },
        processorId: 'output-guard',
      };
      const outputCheck = vi.fn(async () => {
        throw new TripWire(guard.reason, { retry: guard.retry, metadata: guard.metadata }, guard.processorId);
      });
      const followingWork = vi.fn(async () => ({ done: true }));
      const workflow = createWorkflow({
        id: 'guard-workflow',
        inputSchema: z.object({}).passthrough(),
        outputSchema: z.object({ done: z.boolean() }),
      })
        .then(
          createStep({
            id: 'final-output',
            inputSchema: z.object({}).passthrough(),
            outputSchema: z.object({}),
            execute: outputCheck,
          }),
        )
        .then(
          createStep({
            id: 'following-work',
            inputSchema: z.object({}),
            outputSchema: z.object({ done: z.boolean() }),
            execute: followingWork,
          }),
        )
        .commit();
      const pubsub = new EventEmitterPubSub();
      const publish = vi.spyOn(pubsub, 'publish');
      workflow.__setPubsubFactory(() => pubsub);
      const mastra = new Mastra({
        workflows: { workflow },
        storage: new InMemoryStore(),
        logger: false,
        workers: false,
        scheduler: { enabled: false },
      });
      const memo = new Map<string, { ok: true; value: unknown } | { ok: false; value: string }>();
      const step = {
        run: vi.fn(async (id: string, fn: () => Promise<unknown>) => {
          let saved = memo.get(id);
          if (!saved) {
            try {
              const value = await fn();
              saved = { ok: true, value: value === undefined ? undefined : JSON.parse(JSON.stringify(value)) };
            } catch (error) {
              if (!(error instanceof Error)) throw error;
              saved = {
                ok: false,
                value: JSON.stringify({
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                  cause: error.cause,
                }),
              };
            }
            memo.set(id, saved);
          }
          if (!saved.ok) throw Object.assign(new Error(), JSON.parse(saved.value));
          return saved.value;
        }),
        sleep: vi.fn(),
        sleepUntil: vi.fn(),
      };
      try {
        workflow.getFunction();
        if (!handler) throw new Error('Native workflow handler was not registered');
        const context = {
          event: { data: { runId: 'guard-run', inputData: { __workflowKind: 'durable-agent', runId: 'guard-run' } } },
          step,
          attempt: 0,
        };
        const first = await handler(context);
        const replay = await handler(context);
        expect(first.result).toMatchObject({ status: 'tripwire', tripwire: guard });
        expect(replay.result).toMatchObject({ status: 'tripwire', tripwire: guard });
        expect(outputCheck).toHaveBeenCalledOnce();
        expect(followingWork).not.toHaveBeenCalled();
        const terminals = publish.mock.calls.filter(
          ([topic, event]) =>
            topic === AGENT_STREAM_TOPIC('guard-run') &&
            (event.type === AgentStreamEventTypes.ERROR ||
              event.type === AgentStreamEventTypes.FINISH ||
              (event.type === AgentStreamEventTypes.CHUNK && (event.data as { type?: string }).type === 'tripwire')),
        );
        expect(terminals).toHaveLength(1);
        expect(terminals[0]?.[1].data).toMatchObject({ type: 'tripwire', payload: guard });
        expect(network).not.toHaveBeenCalled();
      } finally {
        await mastra.shutdown();
        await pubsub.close();
        network.mockRestore();
      }
    },
    15_000,
  );
});

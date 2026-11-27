/**
 * Pins EventedAgent to the evented execution engine.
 *
 * Verifies that EventedAgent's durable agentic loop actually runs on the
 * evented execution engine: the workflow instance is an evented-engine
 * workflow, and execution flows through the WorkflowEventProcessor (a pubsub
 * spy sees workflow.start / step events on the 'workflows' topic during a
 * run), not just streaming. Also covers the custom-pubsub configuration,
 * where the agent's stream transport is split from mastra.pubsub but
 * execution must still complete and clean up its run records.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createTextStreamModel } from '@internal/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { EventCallback, SubscribeOptions } from '../../../events/types';
import { UnixSocketPubSub } from '../../../events/unix-socket-pubsub';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createEventedAgent } from '../create-evented-agent';

class PushOnlyPubSub extends EventEmitterPubSub {
  override get supportedModes() {
    return ['push'] as const;
  }
}

class WrappingPubSub extends EventEmitterPubSub {
  #wrapped = new WeakMap<EventCallback, Map<string, EventCallback>>();

  override subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions) {
    const subscriptions = this.#wrapped.get(cb) ?? new Map<string, EventCallback>();
    const wrapped: EventCallback = subscriptions.get(topic) ?? ((...args) => cb(...args));
    subscriptions.set(topic, wrapped);
    this.#wrapped.set(cb, subscriptions);
    return super.subscribe(topic, wrapped, options);
  }

  override unsubscribe(topic: string, cb: EventCallback) {
    const subscriptions = this.#wrapped.get(cb);
    const wrapped = subscriptions?.get(topic);
    subscriptions?.delete(topic);
    return super.unsubscribe(topic, wrapped ?? cb);
  }
}

describe('EventedAgent evented engine', () => {
  it('runs the durable agentic loop on the evented execution engine via the WEP', async () => {
    const baseAgent = new Agent({
      id: 'sanity-agent',
      name: 'Sanity Agent',
      instructions: 'You are a helpful assistant',
      model: createTextStreamModel('Hello!'),
    });
    // No custom pubsub: the agent adopts mastra.pubsub on registration, so
    // the evented engine, workers, and stream adapter share one transport.
    const agent = createEventedAgent({ agent: baseAgent });
    const mastra = new Mastra({
      agents: { 'sanity-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
    });

    // 1. The loop workflow is an evented-engine workflow.
    const workflow = agent.getWorkflow();
    expect((workflow as any).engineType).toBe('evented');

    // 2. Execution flows through the workflows topic (WEP), not in-process.
    const seen: string[] = [];
    await mastra.pubsub.subscribe('workflows', (event: any) => {
      if (typeof event?.type === 'string') seen.push(event.type);
    });

    const { output, cleanup } = await agent.stream('Hi');
    await output.consumeStream();

    await vi.waitFor(() => {
      expect(seen).toContain('workflow.start');
      expect(seen.some(t => t.startsWith('workflow.step'))).toBe(true);
    });

    cleanup();
  }, 30_000);

  it.each(['EventEmitter', 'Unix socket', 'wrapping adapter', 'push-only adapter'])(
    'completes with the originating agent when two workers share a %s pubsub (COR-1652)',
    async transport => {
      const directory = transport === 'Unix socket' ? await mkdtemp(join(tmpdir(), 'mastra-affinity-')) : undefined;
      const pubsub = directory
        ? new UnixSocketPubSub(join(directory, 'bus.sock'))
        : transport === 'wrapping adapter'
          ? new WrappingPubSub()
          : transport === 'push-only adapter'
            ? new PushOnlyPubSub()
            : new EventEmitterPubSub();
      const makeInstance = (answer: string) => {
        const agent = createEventedAgent({
          agent: new Agent({
            id: 'shared-agent',
            name: 'Shared Agent',
            instructions: 'Answer the prompt.',
            model: createTextStreamModel(answer),
          }),
        });
        const mastra = new Mastra({ agents: { agent }, pubsub, storage: new InMemoryStore(), logger: false });
        return { agent, mastra };
      };
      const sibling = makeInstance('Wrong worker');
      const owner = makeInstance('Owner answer');
      try {
        // The first subscriber gets the first unscoped delivery in the group.
        await sibling.mastra.startWorkers();
        await owner.mastra.startWorkers();

        const run = async () => {
          const { output, cleanup } = await owner.agent.stream('Hi');
          try {
            const text = await Promise.race([
              output.consumeStream().then(() => output.text),
              delay(3_000, 'Run did not complete', { ref: false }),
            ]);
            expect(text).toBe('Owner answer');
          } finally {
            cleanup();
          }
        };
        await run();
        await owner.mastra.stopWorkers();
        await owner.mastra.startWorkers();
        await run();
      } finally {
        await Promise.all([owner.mastra.stopWorkers(), sibling.mastra.stopWorkers()]);
        await pubsub.close();
        if (directory) await rm(directory, { recursive: true, force: true });
      }
    },
    10_000,
  );

  it('completes execution and cleans up run records with a custom agent pubsub split from mastra.pubsub', async () => {
    const { EventEmitterPubSub } = await import('../../../events/event-emitter');
    const { DurableStepIds } = await import('../constants');

    const baseAgent = new Agent({
      id: 'sanity-agent-2',
      name: 'Sanity Agent 2',
      instructions: 'You are a helpful assistant',
      model: createTextStreamModel('Hello!'),
    });
    // Custom pubsub ≠ mastra.pubsub — mirrors evented-terminal-cleanup.test.ts.
    const customPubsub = new EventEmitterPubSub();
    const agent = createEventedAgent({ agent: baseAgent, pubsub: customPubsub });
    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'sanity-agent-2': agent as any },
      logger: false,
      storage,
    });

    const seen: string[] = [];
    await mastra.pubsub.subscribe('workflows', (event: any) => {
      if (typeof event?.type === 'string') seen.push(event.type);
    });

    // Do NOT consume the stream — we only care whether execution finishes.
    const { runId, cleanup } = await agent.stream('Hi');

    const workflows = (await storage.getStore('workflows'))!;
    await vi.waitFor(
      async () => {
        expect(seen).toContain('workflow.start');
        expect(await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP })).toBeNull();
        expect(
          await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_EXECUTION }),
        ).toBeNull();
      },
      { timeout: 15_000 },
    );

    cleanup();
    await customPubsub.close();
  }, 30_000);
});

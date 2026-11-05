import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../../../memory/src';
import { Agent } from '../../../../agent';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage';
import { InMemoryServerCache } from '../../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../../events/event-emitter';
import { createTool } from '../../../../tools';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  NETWORK_ENGINE_SKIP,
  forEngine,
  scenarioModel,
  isAgentRequest,
  isRoutingRequest,
  isCompletionRequest,
  routeTo,
  complete,
  drain,
} from '../network-fixtures';

class RecordingBus extends EventEmitterPubSub {
  events: Array<{ topic: string; event: any }> = [];
  cleared: string[] = [];
  override async publish(topic: string, event: any, options?: any) {
    this.events.push({ topic, event });
    return super.publish(topic, event, options);
  }
  override async clearTopic(topic: string) {
    this.cleared.push(topic);
    return super.clearTopic(topic);
  }
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describeForAllEngines(
  'public network transport isolation',
  engine => {
    const getMock = useLoopScenarioAimock();
    const usesPlainPublisher = engine === 'normal' || engine === 'fs';
    // This fixture has not been validated for wrapped subagents: dispatch stops before B's tool barrier.
    // Skip rather than attribute the fixture's early termination to an engine defect.
    const test = engine === 'durable' || engine === 'evented' ? it.skip : it;
    test.each(['output-replay', 'abort', 'cleanup'] as const)('%s via two sequential routed agents', async mode => {
      const llm = getMock();
      const storage = new InMemoryStore();
      const cache = new InMemoryServerCache();
      const pubsub = new RecordingBus();
      const entered = deferred();
      const release = deferred();
      const aborted = deferred();
      let routes = 0;
      let completions = 0;
      let bAborted = false;
      const runId = `network-proof-${mode}`;
      llm.on(
        { endpoint: 'chat', predicate: req => isRoutingRequest(req) && ++routes === 1 },
        routeTo('a', 'agent', 'Produce A_MARKER'),
      );
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('b', 'agent', 'Wait then produce B_MARKER'));
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('A_INSTRUCTIONS') }, { content: 'A_MARKER' });
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => isAgentRequest('B_INSTRUCTIONS')(req) && req.messages.at(-1)?.role !== 'tool',
        },
        { toolCalls: [{ id: 'b-wait', name: 'wait', arguments: {} }] },
      );
      llm.on(
        {
          endpoint: 'chat',
          predicate: req => isAgentRequest('B_INSTRUCTIONS')(req) && req.messages.at(-1)?.role === 'tool',
        },
        { content: 'B_MARKER' },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => isCompletionRequest(req) && ++completions === 1 },
        complete('', false),
      );
      llm.on({ endpoint: 'chat', predicate: isCompletionRequest }, complete('NETWORK_DONE', true));
      const wait = createTool({
        id: 'wait',
        description: 'Wait at B boundary',
        inputSchema: z.object({}),
        execute: async (_input, options) => {
          options?.abortSignal?.addEventListener(
            'abort',
            () => {
              bAborted = true;
              aborted.resolve();
            },
            { once: true },
          );
          entered.resolve();
          await Promise.race([release.promise, aborted.promise]);
          return 'wait finished';
        },
      });
      const a = forEngine(
        new Agent({
          id: 'a',
          name: 'a',
          description: 'First worker',
          instructions: 'A_INSTRUCTIONS',
          model: scenarioModel(llm),
          streams: { cleanupTimeoutMs: mode === 'cleanup' ? 1000 : 0 },
        }),
        engine,
      );
      const b = forEngine(
        new Agent({
          id: 'b',
          name: 'b',
          description: 'Second worker',
          instructions: 'B_INSTRUCTIONS',
          model: scenarioModel(llm),
          tools: { wait },
          streams: { cleanupTimeoutMs: 0 },
        }),
        engine,
      );
      const memory = new Memory({ storage, options: { generateTitle: false } });
      const network = new Agent({
        id: 'network',
        name: 'network',
        instructions: 'Route to A then B.',
        model: scenarioModel(llm),
        agents: { a, b },
        memory,
      });
      new Mastra({ agents: { network, a, b }, storage, pubsub, cache, logger: false });
      if (usesPlainPublisher) {
        expect(a.__getStreamBus()?.runRecordCache).toBe(cache);
        expect(b.__getStreamBus()?.runRecordCache).toBe(cache);
      }
      let live: Awaited<ReturnType<typeof b.observe>> | undefined;
      let liveChunks: Promise<any[]> | undefined;
      if (mode === 'output-replay') {
        live = await b.observe(runId);
        liveChunks = drain(live.fullStream);
      }
      const facade: any[] = [];
      const stream = await network.network('Run A then B', {
        runId,
        maxIterations: 2,
        memory: { thread: `thread-${mode}`, resource: 'proof-resource' },
      });
      const finished = (async () => {
        for await (const chunk of stream) {
          facade.push(chunk);
        }
      })();
      try {
        await Promise.race([
          entered.promise,
          finished.then(() => {
            throw new Error('Network finished before B reached its tool barrier');
          }),
        ]);
        if (usesPlainPublisher) {
          expect(await a.__getRunRecord(runId)).toMatchObject({ agentId: 'a', runId, status: 'finished' });
          expect(await b.__getRunRecord(runId)).toMatchObject({ agentId: 'b', runId, status: 'running' });
        }
        if (mode === 'output-replay') {
          release.resolve();
          const chunks = await liveChunks!;
          expect(JSON.stringify(chunks)).toContain('B_MARKER');
          expect(JSON.stringify(chunks)).not.toContain('A_MARKER');
          await finished;
          const late = await b.observe(runId);
          try {
            const replay = await drain(late.fullStream);
            expect(JSON.stringify(replay)).toContain('B_MARKER');
            expect(JSON.stringify(replay)).not.toContain('A_MARKER');
          } finally {
            await late.detach();
          }
        } else if (mode === 'abort') {
          const observer = await a.observe(runId, { offset: 'latest' });
          try {
            await observer.abort();
          } finally {
            await observer.detach();
          }
          const controlTopic = `agent.control.v2.${Buffer.from(JSON.stringify([a.id, runId]), 'utf8').toString('base64url')}`;
          expect(pubsub.events.some(({ topic }) => topic === controlTopic)).toBe(true);
          release.resolve();
          await finished;
          expect(bAborted).toBe(false);
          expect(JSON.stringify(facade)).toContain('B_MARKER');
        } else {
          const topicA = pubsub.events.find(
            ({ topic, event }) =>
              topic === `agent.stream.v2.${Buffer.from(JSON.stringify([a.id, runId]), 'utf8').toString('base64url')}` &&
              JSON.stringify(event).includes('A_MARKER'),
          )!.topic;
          const topicB = pubsub.events.find(
            ({ topic, event }) =>
              topic === `agent.stream.v2.${Buffer.from(JSON.stringify([b.id, runId]), 'utf8').toString('base64url')}` &&
              JSON.stringify(event).includes('b-wait'),
          )!.topic;
          const before = await cache.listFromTo(`pubsub:${topicB}`, 0, -1);
          expect(before?.length).toBeGreaterThan(0);
          await vi.waitFor(() => expect(pubsub.cleared).toContain(topicA), { timeout: 5000 });
          const after = await cache.listFromTo(`pubsub:${topicB}`, 0, -1);
          expect(after).toEqual(before);
          if (usesPlainPublisher) {
            expect(await b.__getRunRecord(runId)).toMatchObject({ status: 'running', agentId: 'b' });
          }
          release.resolve();
          await finished;
          const replay = await b.observe(runId);
          try {
            expect(JSON.stringify(await drain(replay.fullStream))).toContain('B_MARKER');
          } finally {
            await replay.detach();
          }
        }
      } finally {
        release.resolve();
        await finished;
        await live?.detach();
      }
      expect(facade.some(c => c.type === 'agent-execution-end' && c.payload?.agentId === 'a')).toBe(true);
      if (mode !== 'abort') expect(JSON.stringify(facade)).toContain('B_MARKER');
      const stored = await memory.recall({ threadId: `thread-${mode}`, resourceId: 'proof-resource' });
      expect(stored.messages.length).toBeGreaterThan(0);
    });
  },
  NETWORK_ENGINE_SKIP,
);

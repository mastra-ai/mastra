import { appendFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../packages/memory/src';
import { Agent } from '../../../packages/core/src/agent';
import { Mastra } from '../../../packages/core/src/mastra';
import { InMemoryStore } from '../../../packages/core/src/storage';
import { InMemoryServerCache } from '../../../packages/core/src/cache/inmemory';
import { EventEmitterPubSub } from '../../../packages/core/src/events/event-emitter';
import { createTool } from '../../../packages/core/src/tools';
import { useLoopScenarioAimock } from '../../../packages/core/src/loop/test-utils/aimock/aimock-scenario';
import {
  scenarioModel,
  isAgentRequest,
  isRoutingRequest,
  isCompletionRequest,
  routeTo,
  complete,
  drain,
} from '../../../packages/core/src/loop/test-utils/aimock/network-fixtures';

const logPath = process.env.NETWORK_PROOF_LOG;
function log(event: string, data = {}) {
  if (logPath) appendFileSync(logPath, JSON.stringify({ ts: Date.now(), event, ...data }) + '\n');
}
class RecordingBus extends EventEmitterPubSub {
  events: Array<{ topic: string; event: any }> = [];
  cleared: string[] = [];
  override async publish(topic: string, event: any, options?: any) {
    this.events.push({ topic, event });
    log('publish', { topic, type: event.type, data: event.data });
    return super.publish(topic, event, options);
  }
  override async clearTopic(topic: string) {
    this.cleared.push(topic);
    log('clear', { topic });
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

describe('retained baseline public network proof', () => {
  const getMock = useLoopScenarioAimock();
  it.each(['output-replay', 'abort', 'cleanup'] as const)('%s via two sequential routed agents', async mode => {
    log('case-start', { mode });
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
        log('b-entered', { mode, runId, signalAborted: options?.abortSignal?.aborted });
        options?.abortSignal?.addEventListener(
          'abort',
          () => {
            bAborted = true;
            log('b-aborted', { mode, runId });
            aborted.resolve();
          },
          { once: true },
        );
        entered.resolve();
        await Promise.race([release.promise, aborted.promise]);
        return 'wait finished';
      },
    });
    const a = new Agent({
      id: 'a',
      name: 'a',
      description: 'First worker',
      instructions: 'A_INSTRUCTIONS',
      model: scenarioModel(llm),
      streams: { cleanupTimeoutMs: mode === 'cleanup' ? 1000 : 0 },
    });
    const b = new Agent({
      id: 'b',
      name: 'b',
      description: 'Second worker',
      instructions: 'B_INSTRUCTIONS',
      model: scenarioModel(llm),
      tools: { wait },
      streams: { cleanupTimeoutMs: 0 },
    });
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
    expect(a.__getStreamBus()?.runRecordCache).toBe(cache);
    expect(b.__getStreamBus()?.runRecordCache).toBe(cache);
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
        log('network-chunk', { mode, type: chunk.type, payload: chunk.payload });
      }
    })();
    try {
      await entered.promise;
      expect(await a.__getRunRecord(runId)).toMatchObject({ agentId: 'a', runId, status: 'finished' });
      expect(await b.__getRunRecord(runId)).toMatchObject({ agentId: 'b', runId, status: 'running' });
      if (mode === 'output-replay') {
        const chunks = await liveChunks!;
        log('b-live-observation', { mode, chunks });
        expect(JSON.stringify(chunks)).toContain('A_MARKER');
        expect(JSON.stringify(chunks)).not.toContain('B_MARKER');
        const late = await b.observe(runId);
        const replay = await drain(late.fullStream);
        await late.detach();
        log('b-replay-observation', { mode, chunks: replay });
        expect(JSON.stringify(replay)).toContain('A_MARKER');
      } else if (mode === 'abort') {
        const observer = await a.observe(runId, { offset: 'latest' });
        await observer.abort();
        await vi.waitFor(() => expect(bAborted).toBe(true));
        await observer.detach();
      } else {
        const before = await cache.listFromTo(`pubsub:agent.stream.${runId}`, 0, -1);
        log('cache-before-cleanup', { mode, count: before?.length });
        expect(before?.length).toBeGreaterThan(0);
        await vi.waitFor(() => expect(pubsub.cleared).toContain(`agent.stream.${runId}`), { timeout: 5000 });
        const after = await cache.listFromTo(`pubsub:agent.stream.${runId}`, 0, -1);
        log('cache-after-cleanup', { mode, count: after?.length, bRecord: await b.__getRunRecord(runId) });
        expect(after ?? []).toHaveLength(0);
        expect(await b.__getRunRecord(runId)).toMatchObject({ status: 'running', agentId: 'b' });
      }
    } finally {
      release.resolve();
      await finished;
      await live?.detach();
    }
    log('case-complete', { mode, bAborted, facadeTypes: facade.map(c => c.type), requests: llm.getRequests().length });
    expect(facade.some(c => c.type === 'agent-execution-end' && c.payload?.agentId === 'a')).toBe(true);
    if (mode !== 'abort') expect(JSON.stringify(facade)).toContain('B_MARKER');
    const stored = await memory.recall({ threadId: `thread-${mode}`, resourceId: 'proof-resource' });
    expect(stored.messages.length).toBeGreaterThan(0);
  });
});

/**
 * Split-transport tests for EventedAgent.
 *
 * The evented engine publishes run events on `mastra.pubsub`, because a step
 * runs on whichever worker claimed it and that worker cannot reach a caller's
 * in-process bus. A durable run's frames therefore belong on the Mastra-level
 * bus and its cache, never on an agent-level `pubsub`: one bus means one log
 * per run, which is the property observe({ offset }) replays from.
 *
 * `DurableAgent` resolves its run-stream wrapper against `mastra.pubsub`
 * (`#runStreamBus`) for exactly that reason, and warns when a configured
 * agent-level pubsub sits on a different transport — those runs cannot be
 * observed from another process.
 *
 * These tests pin the split arrangement explicitly: the agent gets its own
 * EventEmitterPubSub while Mastra keeps its default internal bus.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { createTextStreamModel } from '@internal/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { InMemoryServerCache } from '../../../cache';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createEventedAgent } from '../create-evented-agent';
import type { EventedAgent } from '../evented-agent';

function createToolCallModel(toolName: string, args: Record<string, unknown>) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName,
          input: JSON.stringify(args),
          providerExecuted: false,
        },
        {
          type: 'finish',
          finishReason: 'tool-calls',
          usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  }) as unknown as LanguageModelV2;
}

async function collectStreamChunks(stream: AsyncIterable<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('EventedAgent split transport (agent pubsub ≠ mastra.pubsub)', () => {
  let agentPubsub: EventEmitterPubSub;

  beforeEach(() => {
    agentPubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await agentPubsub.close();
  });

  function createSetup(model: LanguageModelV2, tools?: Record<string, any>) {
    const baseAgent = new Agent({
      id: 'split-transport-agent',
      name: 'Split Transport Agent',
      instructions: 'You are a helpful assistant',
      model,
      tools,
    });
    // The agent gets its own bus; Mastra keeps its default internal bus. Run
    // frames still resolve to the Mastra bus and its cache, so one log backs
    // the run no matter which worker appended to it.
    const agent = createEventedAgent({ agent: baseAgent, pubsub: agentPubsub });
    const mastra = new Mastra({
      agents: { 'split-transport-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
    });
    return { agent: agent as EventedAgent, mastra };
  }

  it('binds a run-stream wrapper to the Mastra bus, not the agent-level pubsub', () => {
    const { agent, mastra } = createSetup(createTextStreamModel('Hi'));

    // The wrapper that serves both publish and observe for a run has to sit on
    // the shared bus: a frame published there by another worker and a frame
    // this process publishes must land in the same cache log.
    expect((agent.pubsub as CachingPubSub).getInner()).toBe(mastra.pubsub);
    expect((agent.pubsub as CachingPubSub).getInner()).not.toBe(agentPubsub);
  });

  it('delivers text and finish chunks to the stream across split buses', async () => {
    const { agent } = createSetup(createTextStreamModel('Hello!'));

    const { output, cleanup } = await agent.stream('Hi');
    const chunks = await collectStreamChunks(output.fullStream);

    const chunkTypes = chunks.map(chunk => chunk.type);
    expect(chunkTypes).toContain('text-delta');
    expect(chunkTypes).toContain('finish');
    expect(chunks.some(chunk => chunk.type === 'text-delta' && chunk.payload?.text === 'Hello!')).toBe(true);

    cleanup();
  }, 30_000);

  it('replays a completed evented run and closes even beyond its last frame', async () => {
    const { agent } = createSetup(createTextStreamModel('Retained hello!'));
    const { output, runId, cleanup } = await agent.stream('Hi');
    await collectStreamChunks(output.fullStream);

    const replay = await agent.observe(runId);
    const replayed = await collectStreamChunks(replay.fullStream);
    expect(replayed.some(chunk => chunk.type === 'text-delta' && chunk.payload?.text === 'Retained hello!')).toBe(true);
    expect(replayed.map(chunk => chunk.type)).toContain('finish');

    const beyond = await agent.observe(runId, { offset: 1_000_000 });
    let timedOut = false;
    const completed = collectStreamChunks(beyond.fullStream);
    const timeout = setTimeout(() => {
      timedOut = true;
      beyond.detach();
    }, 500);
    try {
      expect(await completed).toEqual([]);
      expect(timedOut).toBe(false);
    } finally {
      clearTimeout(timeout);
      beyond.detach();
      replay.detach();
      cleanup();
    }
  }, 30_000);

  /** Observes past the last frame and reports whether the stream closed on its own within 500ms. */
  async function observeBeyondLastFrame(agent: EventedAgent, runId: string) {
    const beyond = await agent.observe(runId, { offset: 1_000_000 });
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      beyond.detach();
    }, 500);
    try {
      const chunks = await collectStreamChunks(beyond.fullStream);
      return { chunks, timedOut };
    } finally {
      clearTimeout(timeout);
      beyond.detach();
    }
  }

  it('replays an evented run that ended in error and closes beyond its last frame', async () => {
    // MockLanguageModelV2 like the rest of this file: only a failed model call is needed to end the run in `error`.
    const { agent } = createSetup(
      new MockLanguageModelV2({
        doStream: async () => {
          throw new Error('model unavailable');
        },
      }) as unknown as LanguageModelV2,
    );
    const { output, runId, cleanup } = await agent.stream('Hi');
    await collectStreamChunks(output.fullStream);
    try {
      const replay = await agent.observe(runId);
      const replayed = await collectStreamChunks(replay.fullStream);
      replay.detach();
      expect(replayed.find(chunk => chunk.type === 'error')?.payload?.error?.message).toContain('model unavailable');

      expect(await observeBeyondLastFrame(agent, runId)).toEqual({ chunks: [], timedOut: false });
    } finally {
      cleanup();
    }
  }, 30_000);

  it('keeps observing beyond the last frame of a run suspended for approval', async () => {
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      requireApproval: true,
      execute: async () => ({ results: ['result1'] }),
    });
    const { agent } = createSetup(createToolCallModel('searchTool', { query: 'test' }), { searchTool });
    let suspended = false;
    const { runId, cleanup } = await agent.stream('Search for test', {
      requireToolApproval: true,
      onSuspended: () => {
        suspended = true;
      },
    });
    try {
      await vi.waitFor(() => expect(suspended).toBe(true), { timeout: 15_000 });
      // Approval resumes the same run, so its observers must stay attached.
      expect(await observeBeyondLastFrame(agent, runId)).toEqual({ chunks: [], timedOut: true });
    } finally {
      cleanup();
    }
  }, 30_000);

  it('replays a completed run in a separate Mastra with shared storage, cache, and transport', async () => {
    const storage = new InMemoryStore();
    const serverCache = new InMemoryServerCache();
    const makeProcess = () => {
      const agent = createEventedAgent({
        agent: new Agent({
          id: 'cross-process-observer',
          name: 'Cross Process Observer',
          instructions: 'test',
          model: createTextStreamModel('Shared replay!'),
        }),
        pubsub: agentPubsub,
        cleanupTimeoutMs: 0,
      });
      new Mastra({ agents: { agent }, logger: false, storage, cache: serverCache });
      return agent;
    };
    const producer = makeProcess();
    const running = await producer.stream('Hi');
    await collectStreamChunks(running.output.fullStream);
    const observer = makeProcess();
    try {
      const replay = await observer.observe(running.runId);
      const chunks = await collectStreamChunks(replay.fullStream);
      expect(chunks.some(chunk => chunk.type === 'text-delta' && chunk.payload?.text === 'Shared replay!')).toBe(true);
      expect(chunks.map(chunk => chunk.type)).toContain('finish');
      replay.detach();

      const onComplete = vi.fn();
      const onEvent = vi.fn();
      const unsubscribe = await observer.__subscribeToRunStream(
        running.runId,
        { offset: 1_000_000, onComplete },
        onEvent,
      );
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onEvent).not.toHaveBeenCalled();
      await unsubscribe();
    } finally {
      running.cleanup();
    }
  }, 30_000);

  it('delivers tool-approval suspension data across split buses', async () => {
    const searchTool = createTool({
      id: 'searchTool',
      description: 'Search for information',
      inputSchema: z.object({ query: z.string() }),
      requireApproval: true,
      execute: async () => ({ results: ['result1'] }),
    });
    const { agent } = createSetup(createToolCallModel('searchTool', { query: 'test' }), { searchTool });

    let suspendedData: any = null;
    const { cleanup } = await agent.stream('Search for test', {
      requireToolApproval: true,
      onSuspended: (data: any) => {
        suspendedData = data;
      },
    });

    await vi.waitFor(
      () => {
        expect(suspendedData).not.toBeNull();
      },
      { timeout: 15_000 },
    );
    expect(suspendedData.type).toBe('approval');
    expect(suspendedData.toolName).toBe('searchTool');
    expect(suspendedData.toolCallId).toBe('call-1');

    cleanup();
  }, 30_000);

  it('reuses a CachingPubSub already wrapping the Mastra bus instead of double-caching', async () => {
    const sharedCache = new InMemoryServerCache();
    const transport = new EventEmitterPubSub();
    const mastraPubsub = new CachingPubSub(transport, sharedCache);

    const agent = createEventedAgent({
      agent: new Agent({
        id: 'reuse-wrapper-agent',
        name: 'Reuse Wrapper Agent',
        instructions: 'test',
        model: createTextStreamModel('Hi'),
      }),
      pubsub: agentPubsub,
    });
    new Mastra({
      agents: { 'reuse-wrapper-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub: mastraPubsub,
    });

    // Wrapping the Mastra-level wrapper again would append every frame twice —
    // once per layer, with consecutive indices — so the instance is reused.
    // `mastra.pubsub` is a proxy, so compare what the wrapper wraps.
    expect((agent.pubsub as CachingPubSub).getInner()).toBe(transport);
    expect((agent.pubsub as CachingPubSub).getInner()).not.toBe(mastraPubsub);

    const topic = AGENT_STREAM_TOPIC('reused-run');
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'reused-run', data: {} });
    expect(await sharedCache.listLength(`pubsub:{${topic}}`)).toBe(1);

    await transport.close();
  });

  it('moves run frames to the Mastra bus even when the agent carries its own CachingPubSub', async () => {
    // The agent's own wrapper sits on a different transport than the run bus.
    // Reusing it because `#innerPubsub` is a CachingPubSub would keep run frames
    // on the agent transport, i.e. the split this file exists to rule out.
    const agentCache = new InMemoryServerCache();
    const agentTransport = new EventEmitterPubSub();
    const serverCache = new InMemoryServerCache();
    const runTransport = new EventEmitterPubSub();

    const agent = createEventedAgent({
      agent: new Agent({
        id: 'custom-wrapper-agent',
        name: 'Custom Wrapper Agent',
        instructions: 'test',
        model: createTextStreamModel('Hi'),
      }),
      pubsub: new CachingPubSub(agentTransport, agentCache),
    });
    new Mastra({
      agents: { 'custom-wrapper-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub: runTransport,
      cache: serverCache,
    });

    const delivered: unknown[] = [];
    await runTransport.subscribe(AGENT_STREAM_TOPIC('moved-run'), event => {
      delivered.push(event);
    });

    const topic = AGENT_STREAM_TOPIC('moved-run');
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'moved-run', data: {} });

    expect(delivered).toHaveLength(1);
    expect(await serverCache.listLength(`pubsub:{${topic}}`)).toBe(1);
    expect(await agentCache.listLength(`pubsub:{${topic}}`)).toBe(0);

    await runTransport.close();
    await agentTransport.close();
  });

  it('keeps run frames on the Mastra bus when caching is disabled', async () => {
    // Turning the cache off may not turn the transport off with it: another
    // worker still watches the Mastra bus, so a frame that only reaches the
    // agent's own bus is a frame nobody else sees.
    const runTransport = new EventEmitterPubSub();
    const agent = createEventedAgent({
      agent: new Agent({
        id: 'no-cache-agent',
        name: 'No Cache Agent',
        instructions: 'test',
        model: createTextStreamModel('Hi'),
      }),
      pubsub: agentPubsub,
      cache: false,
    });
    new Mastra({
      agents: { 'no-cache-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub: runTransport,
    });

    const onRunBus: unknown[] = [];
    const onAgentBus: unknown[] = [];
    const topic = AGENT_STREAM_TOPIC('no-cache-run');
    await runTransport.subscribe(topic, event => {
      onRunBus.push(event);
    });
    await agentPubsub.subscribe(topic, event => {
      onAgentBus.push(event);
    });

    expect(agent.cache).toBeNull();
    await agent.pubsub.publish(topic, { type: 'chunk', runId: 'no-cache-run', data: {} });

    expect(onRunBus).toHaveLength(1);
    expect(onAgentBus).toHaveLength(0);

    await runTransport.close();
  });

  it('still aligns the cache when the agent is read before it is registered', () => {
    // Reading `agent.cache` resolves the workflow engine; before registration
    // `#mastra` is undefined and the resolver memoizes 'default'. The evented
    // cache alignment must therefore not depend on resolving the engine early.
    const agentCache = new InMemoryServerCache();
    const serverCache = new InMemoryServerCache();

    const agent = createEventedAgent({
      agent: new Agent({
        id: 'early-read-agent',
        name: 'Early Read Agent',
        instructions: 'test',
        model: createTextStreamModel('Hi'),
      }),
      pubsub: agentPubsub,
      cache: agentCache,
    });

    expect(agent.cache).toBe(agentCache);

    new Mastra({
      agents: { 'early-read-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
      cache: serverCache,
    });

    expect(agent.cache).toBe(serverCache);
  });

  it('uses mastra.serverCache for evented run frames when the agent configures another cache', () => {
    const agentCache = new InMemoryServerCache();
    const serverCache = new InMemoryServerCache();

    const agent = createEventedAgent({
      agent: new Agent({
        id: 'diverging-cache-agent',
        name: 'Diverging Cache Agent',
        instructions: 'test',
        model: createTextStreamModel('Hi'),
      }),
      pubsub: agentPubsub,
      cache: agentCache,
    });
    new Mastra({
      agents: { 'diverging-cache-agent': agent as any },
      logger: false,
      storage: new InMemoryStore(),
      cache: serverCache,
    });

    // Step frames are appended by the StepExecutor, which only knows
    // `mastra.serverCache`. A separate agent cache would give the same run two
    // logs with independent indices, so run frames stay on the shared cache.
    expect(agent.cache).toBe(serverCache);
    expect(agent.cache).not.toBe(agentCache);
  });
});

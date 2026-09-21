/**
 * Tests for createInngestAgent factory function
 *
 * These tests verify the new simplified API for creating Inngest-powered durable agents.
 * Full streaming tests are covered by inngest-durable-agent-suite.test.ts which tests
 * the same workflow infrastructure with complete Inngest integration.
 */

import { Agent } from '@mastra/core/agent';
import {
  AGENT_CONTROL_TOPIC,
  AGENT_STREAM_TOPIC,
  AgentStreamEventTypes,
  createDurableAgent,
  globalRunRegistry,
  ON_BEFORE_TOOL_EXECUTION_KEY,
  ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY,
  TOOL_PERMISSION_POLICY_KEY,
  TOOL_PERMISSION_POLICY_REQUIRED_KEY,
} from '@mastra/core/agent/durable';
import { InMemoryServerCache } from '@mastra/core/cache';
import { CachingPubSub, EventEmitterPubSub, PubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from '@mastra/core/test-utils/llm-mock';
import { DefaultStorage } from '@mastra/libsql';
import { Inngest } from 'inngest';
import { describe, it, expect, vi } from 'vitest';

import { createInngestDurableAgenticWorkflowIds } from '../durable-agent/create-inngest-agentic-workflow';
import { collectInngestFunctions } from '../functions';
import { createInngestAgent, isInngestAgent } from '../index';

// Mock model for testing
function createMockModel() {
  return {
    provider: 'test',
    modelId: 'test-model',
    specificationVersion: 'v1',
    supportsStructuredOutputs: true,
    doGenerate: vi.fn(),
    doStream: vi.fn().mockImplementation(async () => {
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', textDelta: 'Hello ' });
            controller.enqueue({ type: 'text-delta', textDelta: 'World!' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { promptTokens: 10, completionTokens: 5 },
            });
            controller.close();
          },
        }),
        rawCall: { rawPrompt: '', rawSettings: {} },
      };
    }),
  };
}

const INNGEST_PORT = 4100;

const workflowIdsFor = createInngestDurableAgenticWorkflowIds;

describe('createInngestAgent factory function', () => {
  const inngest = new Inngest({
    id: 'create-inngest-agent-tests',
    baseUrl: `http://localhost:${INNGEST_PORT}`,
  });

  it('should create an InngestAgent from a regular Agent', () => {
    const agent = new Agent({
      id: 'factory-test',
      name: 'Factory Test',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });

    expect(durableAgent.id).toBe('factory-test');
    expect(durableAgent.name).toBe('Factory Test');
    expect(durableAgent.agent).toBe(agent);
    expect(durableAgent.inngest).toBe(inngest);
    expect(typeof durableAgent.stream).toBe('function');
    expect(typeof durableAgent.resume).toBe('function');
    expect(typeof durableAgent.prepare).toBe('function');
    expect(typeof durableAgent.getDurableWorkflows).toBe('function');
  });

  it('should be detected by isInngestAgent type guard', () => {
    const agent = new Agent({
      id: 'type-guard-test',
      name: 'Type Guard Test',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });

    expect(isInngestAgent(durableAgent)).toBe(true);
    expect(isInngestAgent(agent)).toBe(false);
    expect(isInngestAgent(null)).toBe(false);
    expect(isInngestAgent({})).toBe(false);
  });

  it('should return durable workflows from getDurableWorkflows', () => {
    const agent = new Agent({
      id: 'workflows-test',
      name: 'Workflows Test',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });
    const workflows = durableAgent.getDurableWorkflows();

    expect(Array.isArray(workflows)).toBe(true);
    expect(workflows.length).toBe(1);
    expect(workflows[0].id).toBe(workflowIdsFor('workflows-test').AGENTIC_LOOP);
  });

  it('should prepare for durable execution', async () => {
    const agent = new Agent({
      id: 'prepare-test',
      name: 'Prepare Test',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });
    const result = await durableAgent.prepare([{ role: 'user', content: 'Hello' }]);

    expect(result.runId).toBeDefined();
    expect(typeof result.runId).toBe('string');
    expect(result.messageId).toBeDefined();
    expect(result.workflowInput).toBeDefined();
    expect(result.workflowInput.agentId).toBe('prepare-test');
  });

  it('should have observe method for reconnecting to streams', () => {
    const agent = new Agent({
      id: 'observe-test',
      name: 'Observe Test',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });

    // Verify observe method exists and is a function
    expect(typeof durableAgent.observe).toBe('function');
  });
});

describe('createInngestAgent observe-replay wiring', () => {
  const inngest = new Inngest({
    id: 'create-inngest-agent-observe-replay',
    baseUrl: `http://localhost:${INNGEST_PORT}`,
  });

  function makeAgent(id: string) {
    return new Agent({
      id,
      name: id,
      instructions: 'Test',
      model: createMockModel() as any,
    });
  }

  it('always wraps the inner pubsub in CachingPubSub, even without a configured cache', () => {
    // Regression: bare InngestPubSub has no history replay, so `observe()` would only see
    // chunks emitted after subscription. The factory must wrap with CachingPubSub by default
    // (mirroring the in-memory DurableAgent), falling back to InMemoryServerCache.
    const durableAgent = createInngestAgent({ agent: makeAgent('observe-replay-default'), inngest });

    expect(durableAgent.pubsub).toBeInstanceOf(CachingPubSub);
    expect(durableAgent.pubsub.indexedReplay).toMatchObject({
      scope: 'process',
      retentionMs: expect.any(Number),
      maxEvents: expect.any(Number),
    });
    expect(durableAgent.cache).toBeInstanceOf(InMemoryServerCache);
  });

  it('honors a user-provided cache instead of the InMemoryServerCache fallback', () => {
    const customCache = new InMemoryServerCache();
    const durableAgent = createInngestAgent({
      agent: makeAgent('observe-replay-custom-cache'),
      inngest,
      cache: customCache,
    });

    expect(durableAgent.cache).toBe(customCache);
    expect(durableAgent.pubsub).toBeInstanceOf(CachingPubSub);
    expect(durableAgent.pubsub.indexedReplay).toBeDefined();
  });

  it('shares a caller-provided exact CachingPubSub live path with workflow publishers', async () => {
    const customCache = new InMemoryServerCache();
    const customPubsub = new CachingPubSub(new EventEmitterPubSub(), customCache, {
      indexedReplay: { retentionMs: 60_000, maxEvents: 100 },
    });
    const durableAgent = createInngestAgent({
      agent: makeAgent('observe-replay-custom-pubsub-cache'),
      inngest,
      pubsub: customPubsub,
    });

    expect(durableAgent.pubsub).toBe(customPubsub);
    expect(durableAgent.cache).toBe(customCache);

    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    const factory = workflow.__getPubsubFactory?.();
    const workflowPubsub = factory(new EventEmitterPubSub());
    expect(workflowPubsub).toBe(customPubsub);

    const runId = 'custom-live-path-run';
    const topic = AGENT_STREAM_TOPIC(runId);
    const received: any[] = [];
    await durableAgent.pubsub.subscribeWithReplay(topic, event => {
      received.push(event);
    });
    await workflowPubsub.publish(topic, {
      type: AgentStreamEventTypes.CHUNK,
      runId,
      data: { chunk: 'live-from-workflow' },
    } as any);

    await vi.waitFor(() => {
      expect(received.map(event => event.data)).toContainEqual({ chunk: 'live-from-workflow' });
    });
  });

  // The next two tests mirror packages/core/src/agent/durable/__tests__/resumable-streams.test.ts
  // ("Late subscriber replay") to prove createInngestAgent wires the same replay semantics
  // that the in-memory DurableAgent provides. Without the CachingPubSub wrapper these would
  // both fail: bare InngestPubSub has no history and a late observer would miss every chunk
  // emitted before its subscribe call.
  //
  // Replace the inner InngestPubSub with an in-process EventEmitterPubSub. The wrapper's
  // history-replay path is the code under test; we just need a live-event broker that
  // doesn't try to hit Inngest realtime. This mirrors the inner used by the in-memory
  // resumable-streams test in packages/core/src/agent/durable/__tests__.
  function swapInnerToInProcess(durableAgent: any) {
    (durableAgent.pubsub as any).inner = new EventEmitterPubSub();
  }

  it('should replay all events to a late subscriber', async () => {
    const durableAgent = createInngestAgent({ agent: makeAgent('observe-replay-late'), inngest });
    swapInnerToInProcess(durableAgent);
    const pubsub = durableAgent.pubsub;
    const runId = 'inngest-observe-run-late';
    const topic = AGENT_STREAM_TOPIC(runId);
    const receivedEvents: any[] = [];

    // 1. Publish some events before any subscriber
    await pubsub.publish(topic, {
      type: AgentStreamEventTypes.CHUNK,
      runId,
      data: { chunk: 'Hello ' },
    } as any);
    await pubsub.publish(topic, {
      type: AgentStreamEventTypes.CHUNK,
      runId,
      data: { chunk: 'World!' },
    } as any);
    await pubsub.publish(topic, {
      type: AgentStreamEventTypes.FINISH,
      runId,
      data: { text: 'Hello World!' },
    } as any);

    // Wait for cache writes
    await new Promise(resolve => setTimeout(resolve, 20));

    // 2. Late subscriber joins and should receive all events
    await pubsub.subscribeWithReplay(topic, event => {
      receivedEvents.push(event);
    });

    // 3. Verify all events were received in order
    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents[0].type).toBe(AgentStreamEventTypes.CHUNK);
    expect(receivedEvents[0].data).toEqual({ chunk: 'Hello ' });
    expect(receivedEvents[1].type).toBe(AgentStreamEventTypes.CHUNK);
    expect(receivedEvents[1].data).toEqual({ chunk: 'World!' });
    expect(receivedEvents[2].type).toBe(AgentStreamEventTypes.FINISH);
  });

  it("wraps each workflow's local pubsub in a cache-sharing CachingPubSub", async () => {
    // Regression: previously the InngestWorkflow function constructed its own bare
    // `new InngestPubSub(...)` inside the durable handler, so workflow steps published
    // chunk events to a pubsub instance the agent's `observe()` never sees.
    //
    // The fix is an `__setPubsubFactory` override that wraps each workflow's *own*
    // workflow-local default InngestPubSub with a CachingPubSub backed by the same
    // cache as the agent's pubsub. This preserves per-workflow event channels
    // (workflow-events on `workflow:<workflowId>:<runId>` must stay workflow-local,
    // otherwise nested-workflow watch isolation breaks) while still routing all
    // publishes through the cache that observe() reads from.
    const durableAgent = createInngestAgent({ agent: makeAgent('observe-replay-factory'), inngest });
    swapInnerToInProcess(durableAgent);

    const workflows = durableAgent.getDurableWorkflows();
    const workflow = workflows.find((w: any) => w.id === workflowIdsFor('observe-replay-factory').AGENTIC_LOOP) as any;
    expect(workflow).toBeDefined();

    const factory = workflow.__getPubsubFactory?.();
    expect(typeof factory).toBe('function');

    // Simulate what the workflow function does at runtime: pass in a workflow-local
    // InngestPubSub default. The factory must wrap it (not substitute it) so the
    // workflow-id-scoped channels survive.
    const parentDefault = new EventEmitterPubSub(); // stand-in for the workflow's default InngestPubSub
    const wrapped = factory(parentDefault);
    expect(wrapped).toBeInstanceOf(CachingPubSub);
    expect((wrapped as any).inner).toBe(parentDefault);
    // Must reuse the same backing cache as the agent's pubsub so observe() sees workflow writes.
    expect((wrapped as any).cache).toBe(durableAgent.cache);

    // Nested InngestWorkflows (e.g. the single-iteration loop body) run as their
    // own Inngest functions and resolve their own pubsub at runtime. Each must
    // get its own workflow-local CachingPubSub - same cache, different inner -
    // otherwise chunk events emitted by tool/llm steps inside the inner loop
    // bypass the cache and `observe()` can never replay them.
    const collectNested = (steps: any[]): any[] => {
      const found: any[] = [];
      for (const step of steps ?? []) {
        // `type: 'step'` holds the workflow directly; loop/foreach wrap their
        // body in a `SingleStepEntry`, so the workflow lives at `step.step.step`.
        const inner = step.type === 'step' ? step.step : (step.step?.step ?? step.step);
        if ((step.type === 'step' || step.type === 'loop' || step.type === 'foreach') && inner?.executionGraph) {
          found.push(inner);
          found.push(...collectNested(inner.executionGraph.steps));
        } else if (step.type === 'parallel' || step.type === 'conditional') {
          found.push(...collectNested(step.steps));
        }
      }
      return found;
    };
    const nested = collectNested(workflow.executionGraph.steps);
    expect(nested.length).toBeGreaterThan(0);
    for (const inner of nested) {
      const innerFactory = inner.__getPubsubFactory?.();
      expect(typeof innerFactory).toBe('function');
      const nestedDefault = new EventEmitterPubSub();
      const nestedWrapped = innerFactory(nestedDefault);
      expect(nestedWrapped).toBeInstanceOf(CachingPubSub);
      // Each nested workflow keeps its own workflow-local inner...
      expect((nestedWrapped as any).inner).toBe(nestedDefault);
      // ...but shares the cache, so writes from any workflow show up on observe().
      expect((nestedWrapped as any).cache).toBe(durableAgent.cache);
    }

    // Internal workflow watch events must remain live but stay out of replay history.
    const watchTopic = 'workflow.events.v2.inngest-observe-factory-run';
    const watchEvents: any[] = [];
    await wrapped.subscribe(watchTopic, event => {
      watchEvents.push(event);
    });
    await wrapped.publish(watchTopic, {
      type: 'watch',
      runId: 'inngest-observe-factory-run',
      data: { type: 'workflow-step-result', payload: { large: 'payload' } },
    } as any);
    expect(watchEvents).toHaveLength(1);
    expect(await wrapped.getHistory(watchTopic)).toEqual([]);

    // Agent stream publishes from factory-produced pubsubs still become replayable
    // via the agent's pubsub because they share a cache.
    const runId = 'inngest-observe-factory-run';
    const topic = AGENT_STREAM_TOPIC(runId);
    await wrapped.publish(topic, {
      type: AgentStreamEventTypes.CHUNK,
      runId,
      data: { chunk: 'from-workflow' },
    } as any);
    await new Promise(resolve => setTimeout(resolve, 20));

    const replayed: any[] = [];
    await durableAgent.pubsub.subscribeWithReplay(topic, event => {
      replayed.push(event);
    });
    expect(replayed).toHaveLength(1);
    expect(replayed[0].data).toEqual({ chunk: 'from-workflow' });
  });

  it('should receive both cached and live events', async () => {
    const durableAgent = createInngestAgent({ agent: makeAgent('observe-replay-mixed'), inngest });
    swapInnerToInProcess(durableAgent);
    const pubsub = durableAgent.pubsub;
    const runId = 'inngest-observe-run-mixed';
    const topic = AGENT_STREAM_TOPIC(runId);
    const receivedEvents: any[] = [];

    // 1. Publish cached events
    await pubsub.publish(topic, {
      type: AgentStreamEventTypes.CHUNK,
      runId,
      data: { chunk: 'Cached ' },
    } as any);
    await new Promise(resolve => setTimeout(resolve, 20));

    // 2. Subscribe with replay
    await pubsub.subscribeWithReplay(topic, event => {
      receivedEvents.push(event);
    });

    // 3. Publish live events after subscription
    await pubsub.publish(topic, {
      type: AgentStreamEventTypes.CHUNK,
      runId,
      data: { chunk: 'Live!' },
    } as any);

    // Allow live publish to fan out
    await new Promise(resolve => setTimeout(resolve, 20));

    // 4. Verify both cached and live events received in order
    expect(receivedEvents).toHaveLength(2);
    expect(receivedEvents[0].data).toEqual({ chunk: 'Cached ' });
    expect(receivedEvents[1].data).toEqual({ chunk: 'Live!' });
  });
});

describe('createInngestAgent with Mastra auto-registration', () => {
  const inngest = new Inngest({
    id: 'auto-reg-tests',
    baseUrl: `http://localhost:${INNGEST_PORT}`,
  });

  it('should auto-register workflow when added to Mastra via config', () => {
    const agent = new Agent({
      id: 'auto-reg-agent',
      name: 'Auto Reg Agent',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });

    // Create Mastra with durable agent in config
    const mastra = new Mastra({
      storage: new DefaultStorage({
        id: 'auto-reg-test-storage',
        url: ':memory:',
      }),
      agents: { autoRegAgent: durableAgent },
    });

    // Verify agent is registered
    const registeredAgent = mastra.getAgentById('auto-reg-agent');
    expect(registeredAgent).toBeDefined();
    expect(registeredAgent?.id).toBe('auto-reg-agent');

    // Verify workflow is auto-registered
    const workflow = mastra.getWorkflow(workflowIdsFor('auto-reg-agent').AGENTIC_LOOP);
    expect(workflow).toBeDefined();
  });

  it('should auto-register workflow when added to Mastra via addAgent', () => {
    const agent = new Agent({
      id: 'add-agent-agent',
      name: 'Add Agent Agent',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const durableAgent = createInngestAgent({ agent, inngest });

    // Create empty Mastra
    const mastra = new Mastra({
      storage: new DefaultStorage({
        id: 'add-agent-test-storage',
        url: ':memory:',
      }),
    });

    // Add durable agent dynamically
    mastra.addAgent(durableAgent);

    // Verify agent is registered
    const registeredAgent = mastra.getAgentById('add-agent-agent');
    expect(registeredAgent).toBeDefined();

    // Verify workflow is auto-registered
    const workflow = mastra.getWorkflow(workflowIdsFor('add-agent-agent').AGENTIC_LOOP);
    expect(workflow).toBeDefined();
  });

  it('registers distinct parent and nested Inngest functions for multiple durable agents', async () => {
    const agent1 = new Agent({
      id: 'multi-agent-1',
      name: 'Multi Agent 1',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const agent2 = new Agent({
      id: 'multi-agent-2',
      name: 'Multi Agent 2',
      instructions: 'Test',
      model: createMockModel() as any,
    });

    const durableAgent1 = createInngestAgent({ agent: agent1, inngest });
    const durableAgent2 = createInngestAgent({ agent: agent2, inngest });

    // Create Mastra with both durable agents
    const mastra = new Mastra({
      storage: new DefaultStorage({
        id: 'multi-agent-test-storage',
        url: ':memory:',
      }),
      agents: {
        multiAgent1: durableAgent1,
        multiAgent2: durableAgent2,
      },
    });

    // Verify both agents are registered
    expect(mastra.getAgentById('multi-agent-1')).toBeDefined();
    expect(mastra.getAgentById('multi-agent-2')).toBeDefined();

    const firstIds = workflowIdsFor('multi-agent-1');
    const secondIds = workflowIdsFor('multi-agent-2');
    expect(firstIds).not.toEqual(secondIds);
    expect(mastra.listWorkflows()).toEqual({});
    expect(mastra.getWorkflow(firstIds.AGENTIC_LOOP)).toBe(durableAgent1.getDurableWorkflows()[0]);
    expect(mastra.getWorkflow(secondIds.AGENTIC_LOOP)).toBe(durableAgent2.getDurableWorkflows()[0]);

    const functionIds = collectInngestFunctions({ mastra }).map(fn => fn.id());
    expect(functionIds).toEqual(
      expect.arrayContaining([
        `workflow.${firstIds.AGENTIC_LOOP}`,
        `workflow.${firstIds.AGENTIC_EXECUTION}`,
        `workflow.${secondIds.AGENTIC_LOOP}`,
        `workflow.${secondIds.AGENTIC_EXECUTION}`,
      ]),
    );
    expect(new Set(functionIds).size).toBe(4);

    await mastra.shutdown();
  });

  it('isolates each durable agent workflow publisher and replay cache', async () => {
    const firstCache = new InMemoryServerCache();
    const secondCache = new InMemoryServerCache();
    const firstPubsub = new CachingPubSub(new EventEmitterPubSub(), firstCache, {
      indexedReplay: { retentionMs: 60_000, maxEvents: 100 },
    });
    const secondPubsub = new CachingPubSub(new EventEmitterPubSub(), secondCache, {
      indexedReplay: { retentionMs: 60_000, maxEvents: 100 },
    });
    const durableAgent1 = createInngestAgent({
      agent: new Agent({
        id: 'multi-transport-1',
        name: 'Multi Transport 1',
        instructions: 'Test',
        model: createMockModel() as any,
      }),
      inngest,
      pubsub: firstPubsub,
    });
    const durableAgent2 = createInngestAgent({
      agent: new Agent({
        id: 'multi-transport-2',
        name: 'Multi Transport 2',
        instructions: 'Test',
        model: createMockModel() as any,
      }),
      inngest,
      pubsub: secondPubsub,
    });
    const mastra = new Mastra({
      storage: new DefaultStorage({ id: 'multi-transport-storage', url: ':memory:' }),
      agents: { durableAgent1, durableAgent2 },
    });

    try {
      const firstWorkflow = mastra.getWorkflow(workflowIdsFor('multi-transport-1').AGENTIC_LOOP) as any;
      const secondWorkflow = mastra.getWorkflow(workflowIdsFor('multi-transport-2').AGENTIC_LOOP) as any;
      const firstPublisher = firstWorkflow.__getPubsubFactory?.()(new EventEmitterPubSub());
      const secondPublisher = secondWorkflow.__getPubsubFactory?.()(new EventEmitterPubSub());
      expect(firstPublisher).toBe(firstPubsub);
      expect(secondPublisher).toBe(secondPubsub);

      const replayTopic = AGENT_STREAM_TOPIC('multi-transport-replay-1');
      await firstPublisher.publish(replayTopic, {
        type: AgentStreamEventTypes.CHUNK,
        runId: 'multi-transport-replay-1',
        data: { owner: 'first' },
      });

      const firstReplay: any[] = [];
      const wrongReplay: any[] = [];
      await firstPubsub.subscribeWithReplay(replayTopic, event => firstReplay.push(event));
      await secondPubsub.subscribeWithReplay(replayTopic, event => wrongReplay.push(event));
      expect(firstReplay.map(event => event.data)).toEqual([{ owner: 'first' }]);
      expect(wrongReplay).toEqual([]);

      const liveTopic = AGENT_STREAM_TOPIC('multi-transport-live-2');
      const secondLive: any[] = [];
      const wrongLive: any[] = [];
      await secondPubsub.subscribeWithReplay(liveTopic, event => secondLive.push(event));
      await firstPubsub.subscribeWithReplay(liveTopic, event => wrongLive.push(event));
      await secondPublisher.publish(liveTopic, {
        type: AgentStreamEventTypes.CHUNK,
        runId: 'multi-transport-live-2',
        data: { owner: 'second' },
      });
      await vi.waitFor(() => expect(secondLive.map(event => event.data)).toEqual([{ owner: 'second' }]));
      expect(wrongLive).toEqual([]);
    } finally {
      await mastra.shutdown();
    }
  });

  it('persists each durable-agent start only under its owning workflow ID', async () => {
    const firstPubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache(), {
      indexedReplay: { retentionMs: 60_000, maxEvents: 100 },
    });
    const secondPubsub = new CachingPubSub(new EventEmitterPubSub(), new InMemoryServerCache(), {
      indexedReplay: { retentionMs: 60_000, maxEvents: 100 },
    });
    const durableAgent1 = createInngestAgent({
      agent: new Agent({
        id: 'multi-snapshot-1',
        name: 'Multi Snapshot 1',
        instructions: 'Test',
        model: createMockModel() as any,
      }),
      inngest,
      pubsub: firstPubsub,
    });
    const durableAgent2 = createInngestAgent({
      agent: new Agent({
        id: 'multi-snapshot-2',
        name: 'Multi Snapshot 2',
        instructions: 'Test',
        model: createMockModel() as any,
      }),
      inngest,
      pubsub: secondPubsub,
    });
    const mastra = new Mastra({
      logger: false,
      storage: new DefaultStorage({ id: 'multi-snapshot-storage', url: ':memory:' }),
      agents: { durableAgent1, durableAgent2 },
    });
    const sendSpy = vi.spyOn(inngest as any, 'send').mockResolvedValue({ ids: ['test-event'] } as any);
    const firstRunId = 'multi-snapshot-run-1';
    const secondRunId = 'multi-snapshot-run-2';
    const first = await durableAgent1.stream([{ role: 'user', content: 'first' }], { runId: firstRunId });
    const second = await durableAgent2.stream([{ role: 'user', content: 'second' }], { runId: secondRunId });

    try {
      for (const runId of [firstRunId, secondRunId]) {
        const deadline = Date.now() + 1_000;
        let execution = globalRunRegistry.get(runId)?.workflowExecution;
        while (!execution && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 0));
          execution = globalRunRegistry.get(runId)?.workflowExecution;
        }
        expect(execution).toBeInstanceOf(Promise);
        await expect(execution).resolves.toBeUndefined();
      }

      const firstIds = workflowIdsFor('multi-snapshot-1');
      const secondIds = workflowIdsFor('multi-snapshot-2');
      expect(sendSpy.mock.calls.map(call => call[0].name)).toEqual([
        `workflow.${firstIds.AGENTIC_LOOP}`,
        `workflow.${secondIds.AGENTIC_LOOP}`,
      ]);

      const workflowsStore = await mastra.getStorage()!.getStore('workflows');
      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: firstIds.AGENTIC_LOOP, runId: firstRunId }),
      ).resolves.toMatchObject({ status: 'running', runId: firstRunId });
      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: secondIds.AGENTIC_LOOP, runId: secondRunId }),
      ).resolves.toMatchObject({ status: 'running', runId: secondRunId });
      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: secondIds.AGENTIC_LOOP, runId: firstRunId }),
      ).resolves.toBeNull();
      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: firstIds.AGENTIC_LOOP, runId: secondRunId }),
      ).resolves.toBeNull();
    } finally {
      first.cleanup();
      second.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });
});

// ---------------------------------------------------------------------------
// Parity surface tests
//
// These tests exercise the InngestAgent execution surface that was added to
// match DurableAgent: the widened InngestAgentStreamOptions, the abort path,
// untilIdle on resume(), and the generate()/resumeGenerate() wrappers.
//
// We deliberately avoid spinning up a real Inngest dev server. `inngest.send`
// is stubbed to a no-op so stream()/resume() can complete their non-durable
// preparation phase (preparation, run-registry registration, stream
// subscription) and we can assert the observable side effects on
// globalRunRegistry and on the returned result. The durable workflow itself
// is covered by the integration suite.
// ---------------------------------------------------------------------------
describe('InngestAgent parity surface', () => {
  const inngest = new Inngest({
    id: 'parity-tests',
    baseUrl: `http://localhost:${INNGEST_PORT}`,
  });

  // Replace inngest.send so stream()/resume() don't attempt a real network
  // roundtrip. InngestRun admission requires the returned event id.
  function stubInngestSend(target: Inngest = inngest) {
    return vi.spyOn(target as any, 'send').mockResolvedValue({ ids: ['test-event'] } as any);
  }

  function makeAgent(id: string) {
    return new Agent({
      id,
      name: id,
      instructions: 'Test',
      model: createMockModel() as any,
    });
  }

  // The agent's CachingPubSub wraps an InngestPubSub. Without a real Inngest
  // dev server, terminal stream events (finish/error/abort) try to publish
  // over inngest realtime and produce unhandled fetch rejections. Swap the
  // inner with an in-process broker so the surface tests stay self-contained.
  function makeIsolatedAgent(
    id: string,
    options: {
      durableRequestContextKeys?: readonly string[];
      resolveToolPermission?: (input: any) => 'allow' | 'ask' | 'deny' | Promise<'allow' | 'ask' | 'deny'>;
    } = {},
  ) {
    const durableAgent = createInngestAgent({ agent: makeAgent(id), inngest, ...options });
    const mastra = new Mastra({
      logger: false,
      storage: new DefaultStorage({ id: `${id}-storage`, url: ':memory:' }),
      agents: { [id]: durableAgent },
    });
    (durableAgent.pubsub as any).inner = new EventEmitterPubSub();
    return { durableAgent, mastra };
  }

  async function makeAgentWithSnapshot(id: string, runId: string, snapshot: any) {
    const { durableAgent, mastra } = makeIsolatedAgent(id);
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflowIdsFor(id).AGENTIC_LOOP,
      runId,
      snapshot: {
        executionGeneration: `${runId}-generation`,
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
        status: 'suspended',
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        resumeLabels: {},
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
        ...snapshot,
        runId,
        context: {
          ...snapshot.context,
          input: { __workflowKind: 'durable-agent', runId, runtimeBindingId: `${runId}-binding` },
        },
      },
    });
    return { durableAgent, mastra };
  }

  it('threads widened execution options through prepare() into workflow input', async () => {
    // Slice 1: prove the widened option surface actually flows to
    // prepareForDurableExecution. We use prepare() instead of stream() because
    // it returns workflowInput synchronously without needing to mock the
    // workflow trigger, and prepare() shares the preparation path with
    // stream() / generate().
    const durableAgent = createInngestAgent({ agent: makeAgent('parity-prepare'), inngest });

    const result = await durableAgent.prepare([{ role: 'user', content: 'hi' }], {
      maxSteps: 7,
      disableBackgroundTasks: true,
      actor: { id: 'actor-1', type: 'user' } as any,
      system: 'extra system message',
      tracingOptions: { metadata: { feature: 'parity' } } as any,
    });

    const opts = result.workflowInput.options;
    expect(opts.maxSteps).toBe(7);
    expect(opts.disableBackgroundTasks).toBe(true);
    expect(opts.actor).toEqual({ id: 'actor-1', type: 'user' });
    expect(opts.systemMessage).toBe('extra system message');
    expect(opts.tracingOptions).toEqual({ metadata: { feature: 'parity' } });
  });

  it('rejects response-only recovery before Inngest dispatch', async () => {
    const runId = 'inngest-response-recovery-rejected';
    const { durableAgent, mastra } = makeIsolatedAgent('parity-response-recovery');
    const sendSpy = stubInngestSend();

    try {
      await expect(
        durableAgent.prepare([{ role: 'user', content: 'hi' }], { recoveryMaxSteps: 1 } as any),
      ).rejects.toThrow('Inngest durable agents do not support response-only recovery; recoveryMaxSteps must be 0');
      await expect(
        durableAgent.stream([{ role: 'user', content: 'hi' }], { runId, recoveryMaxSteps: 1 } as any),
      ).rejects.toThrow('Inngest durable agents do not support response-only recovery; recoveryMaxSteps must be 0');

      expect(sendSpy).not.toHaveBeenCalled();
      expect(globalRunRegistry.has(runId)).toBe(false);
    } finally {
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('rejects default response-only recovery before preparation side effects', async () => {
    const createThread = vi.fn();
    const getMemory = vi.fn().mockResolvedValue({ createThread } as any);
    const agent = new Agent({
      id: 'default-response-recovery',
      name: 'default-response-recovery',
      instructions: 'Test',
      model: createMockModel() as any,
      defaultOptions: { recoveryMaxSteps: 1 },
    });
    vi.spyOn(agent, 'getMemory').mockImplementation(getMemory);
    const durableAgent = createInngestAgent({ agent, inngest });
    const sendSpy = stubInngestSend();

    await expect(
      durableAgent.prepare([{ role: 'user', content: 'hi' }], {
        memory: { thread: 'thread-1', resource: 'resource-1' },
      } as any),
    ).rejects.toThrow('Inngest durable agents do not support response-only recovery; recoveryMaxSteps must be 0');

    await expect(
      durableAgent.stream([{ role: 'user', content: 'hi' }], {
        memory: { thread: 'thread-1', resource: 'resource-1' },
      } as any),
    ).rejects.toThrow('Inngest durable agents do not support response-only recovery; recoveryMaxSteps must be 0');

    expect(getMemory).not.toHaveBeenCalled();
    expect(createThread).not.toHaveBeenCalled();
    expect(sendSpy).not.toHaveBeenCalled();
    sendSpy.mockRestore();
  });

  it('exposes result.abort and flips the registry abortSignal', async () => {
    // Slice 2: stream() must own an AbortController, expose it via
    // result.abort, and surface its signal on the run-registry entry so the
    // durable LLM step (when co-located) can short-circuit.
    const { durableAgent, mastra } = makeIsolatedAgent('parity-abort');
    const sendSpy = stubInngestSend();

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
      expect(typeof result.abort).toBe('function');
      const entry = globalRunRegistry.get(result.runId);
      expect(entry?.abortSignal).toBeInstanceOf(AbortSignal);
      expect(entry?.abortSignal?.aborted).toBe(false);

      await result.abort('user-cancelled');

      expect(entry?.abortSignal?.aborted).toBe(true);
      await entry?.workflowExecution;
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('rejects an awaitable abort when remote dispatch cannot be confirmed', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-abort-dispatch-failure');
    const sendSpy = stubInngestSend();
    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    const entry = globalRunRegistry.get(result.runId);
    const runtimeBindingId = entry?.runtimeBindingId;
    expect(runtimeBindingId).toEqual(expect.any(String));
    const dispatchError = new Error('abort transport unavailable');
    const originalPublish = durableAgent.pubsub.publish.bind(durableAgent.pubsub);
    const publishSpy = vi.spyOn(durableAgent.pubsub, 'publish').mockImplementation(async (topic, event) => {
      if (topic === AGENT_CONTROL_TOPIC(result.runId, runtimeBindingId!)) throw dispatchError;
      return originalPublish(topic, event);
    });

    try {
      await expect(result.abort('user-cancelled')).rejects.toBe(dispatchError);
      expect(entry?.abortSignal?.aborted).toBe(true);
      await entry?.workflowExecution;
    } finally {
      publishSpy.mockRestore();
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('does not let stale stream cleanup delete a newer controller for the same durable binding', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-stale-stream-cleanup');
    const sendSpy = stubInngestSend();
    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    const previousEntry = globalRunRegistry.get(result.runId)!;
    const newerController = new AbortController();
    const newerEntry = {
      ...previousEntry,
      abortController: newerController,
      abortSignal: newerController.signal,
    };
    globalRunRegistry.set(result.runId, newerEntry);

    try {
      result.cleanup();
      expect(globalRunRegistry.get(result.runId)).toBe(newerEntry);
      expect(newerController.signal.aborted).toBe(false);
    } finally {
      globalRunRegistry.delete(result.runId);
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('retains an already-aborted external signal for a worker that subscribes later', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-abort-before-worker');
    const sendSpy = stubInngestSend();
    const external = new AbortController();
    external.abort(new Error('cancel-before-worker'));

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }], {
      abortSignal: external.signal,
    });
    const runtimeBindingId = globalRunRegistry.get(result.runId)?.runtimeBindingId;
    expect(runtimeBindingId).toEqual(expect.any(String));
    try {
      await vi.waitFor(async () => {
        const history = await durableAgent.pubsub.getHistory(AGENT_CONTROL_TOPIC(result.runId, runtimeBindingId!));
        expect(history).toEqual([expect.objectContaining({ type: 'abort-request', runId: result.runId })]);
      });
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('preserves a retained abort when workflow dispatch acknowledgement is ambiguous', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-abort-ambiguous-trigger');
    const sendSpy = vi.spyOn(inngest as any, 'send').mockRejectedValue(new Error('dispatch acknowledgement lost'));

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    const runtimeBindingId = globalRunRegistry.get(result.runId)?.runtimeBindingId;
    expect(runtimeBindingId).toEqual(expect.any(String));
    try {
      await result.abort('cancel-possibly-queued-run');

      await vi.waitFor(async () => {
        const history = await durableAgent.pubsub.getHistory(AGENT_CONTROL_TOPIC(result.runId, runtimeBindingId!));
        expect(history).toEqual([expect.objectContaining({ type: 'abort-request', runId: result.runId })]);
      });
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('forwards an external abortSignal onto the internal controller', async () => {
    // External signal must be wired through so either source (caller's
    // signal or result.abort) flips the registry-tracked AbortSignal that
    // workflow steps observe.
    const { durableAgent, mastra } = makeIsolatedAgent('parity-abort-external');
    const sendSpy = stubInngestSend();

    const external = new AbortController();
    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }], {
      abortSignal: external.signal,
    });
    try {
      const entry = globalRunRegistry.get(result.runId);
      expect(entry?.abortSignal?.aborted).toBe(false);

      external.abort(new Error('external-cancel'));

      // The forwarded controller is flipped synchronously by the abort
      // event listener installed in stream().
      expect(entry?.abortSignal?.aborted).toBe(true);
      await entry?.workflowExecution;
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('tracks the workflow trigger promise on globalRunRegistry.workflowExecution', async () => {
    // generate()/resumeGenerate() rely on awaiting workflowExecution after a
    // suspend to make sure the snapshot has landed before they return. This
    // covers the registration side of that contract.
    const { durableAgent, mastra } = makeIsolatedAgent('parity-workflow-exec');
    const workflowIds = workflowIdsFor('parity-workflow-exec');
    const sendSpy = stubInngestSend();

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
      // The `ready.then(() => triggerWorkflow(...))` chain attaches the
      // workflowExecution promise on the next microtask after `ready` settles.
      // Poll the registry until the promise lands instead of sleeping a fixed
      // amount of time, so this stays deterministic across machine speeds.
      const deadline = Date.now() + 1_000;
      let entry = globalRunRegistry.get(result.runId);
      while (!entry?.workflowExecution && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        entry = globalRunRegistry.get(result.runId);
      }
      expect(entry?.workflowExecution).toBeInstanceOf(Promise);
      // The promise should settle once the admitted Inngest dispatch resolves.
      await expect(entry?.workflowExecution).resolves.toBeUndefined();
      expect(sendSpy).toHaveBeenCalledTimes(1);

      const dispatch = sendSpy.mock.calls[0]?.[0];
      expect(dispatch).toMatchObject({
        id: expect.stringMatching(/^miwd:v1:/),
        name: `workflow.${workflowIds.AGENTIC_LOOP}`,
        data: {
          runId: result.runId,
          executionGeneration: expect.any(String),
          lifecycleResumeAttempt: 0,
          lifecycleStepStates: {},
        },
      });

      const workflowsStore = await mastra.getStorage()!.getStore('workflows');
      await expect(
        workflowsStore.loadWorkflowSnapshot({
          workflowName: workflowIds.AGENTIC_LOOP,
          runId: result.runId,
        }),
      ).resolves.toMatchObject({
        status: 'running',
        executionGeneration: dispatch.data.executionGeneration,
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
      });
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('fails closed instead of directly dispatching when the agent is not registered with workflow storage', async () => {
    const durableAgent = createInngestAgent({ agent: makeAgent('parity-unregistered-dispatch'), inngest });
    (durableAgent.pubsub as any).inner = new EventEmitterPubSub();
    const sendSpy = stubInngestSend();
    let resolveError!: () => void;
    const errorSeen = new Promise<void>(resolve => {
      resolveError = resolve;
    });

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }], {
      onError: () => resolveError(),
    });
    try {
      await errorSeen;
      expect(sendSpy).not.toHaveBeenCalled();
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
    }
  });

  it.each(['factory-option', 'manual-setter'] as const)(
    'rejects an unserved Mastra instance supplied through %s',
    async registrationPath => {
      const mastra = new Mastra({
        logger: false,
        storage: new DefaultStorage({ id: `parity-unserved-${registrationPath}-storage`, url: ':memory:' }),
      });
      const durableAgent = createInngestAgent({
        agent: makeAgent(`parity-unserved-${registrationPath}`),
        inngest,
        ...(registrationPath === 'factory-option' ? { mastra } : {}),
      });
      if (registrationPath === 'manual-setter') {
        durableAgent.__setMastra(mastra);
      }
      (durableAgent.pubsub as any).inner = new EventEmitterPubSub();
      const sendSpy = stubInngestSend();
      let resolveError!: () => void;
      const errorSeen = new Promise<void>(resolve => {
        resolveError = resolve;
      });

      const result = await durableAgent.stream([{ role: 'user', content: 'hi' }], {
        onError: () => resolveError(),
      });
      try {
        await errorSeen;
        expect(mastra.listWorkflows()).toEqual({});
        expect(sendSpy).not.toHaveBeenCalled();
      } finally {
        result.cleanup();
        sendSpy.mockRestore();
        await mastra.shutdown();
      }
    },
  );

  it('rejects an overlapping caller-reused run ID without replacing the active binding', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-overlapping-run-id');
    const sendSpy = stubInngestSend();
    const runId = 'overlapping-run-id';
    const first = await durableAgent.stream([{ role: 'user', content: 'first' }], { runId });
    const firstEntry = globalRunRegistry.get(runId);
    await firstEntry?.workflowExecution;

    try {
      await expect(durableAgent.stream([{ role: 'user', content: 'second' }], { runId })).rejects.toThrow(
        /already active/,
      );
      expect(globalRunRegistry.get(runId)).toBe(firstEntry);
      expect(sendSpy).toHaveBeenCalledTimes(1);
    } finally {
      first.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('rejects an Inngest run when only a pinned Core runtime occupies the caller-reused ID', async () => {
    const runId = 'pinned-core-runtime-collision';
    let markProcessorStarted!: () => void;
    let releaseProcessor!: () => void;
    const processorStarted = new Promise<void>(resolve => {
      markProcessorStarted = resolve;
    });
    const processorReleased = new Promise<void>(resolve => {
      releaseProcessor = resolve;
    });
    const corePubsub = new EventEmitterPubSub();
    const coreAgent = new Agent({
      id: 'pinned-core-runtime-owner',
      name: 'Pinned Core Runtime Owner',
      instructions: 'Test',
      model: new MockLanguageModelV2({
        doStream: (async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'stream-start', warnings: [] });
              controller.enqueue({
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              });
              controller.close();
            },
          }),
        })) as any,
      }) as any,
      inputProcessors: [
        {
          id: 'hold-pinned-runtime',
          processInputStep: async () => {
            markProcessorStarted();
            await processorReleased;
            return {};
          },
        },
      ],
    });
    const coreDurableAgent = createDurableAgent({ agent: coreAgent, pubsub: corePubsub });
    const coreResult = await coreDurableAgent.stream([{ role: 'user', content: 'first' }], { runId });
    const coreConsume = coreResult.output.consumeStream();
    const coreEntry = globalRunRegistry.get(runId)!;
    await processorStarted;

    // Keep the active execution only in Core's pinned registry. Inngest must
    // consult the bound lookup rather than the expiring public map before it
    // claims this caller-supplied identifier.
    globalRunRegistry.delete(runId);
    const { durableAgent, mastra } = makeIsolatedAgent('parity-pinned-core-collision');
    const sendSpy = stubInngestSend();

    try {
      await expect(durableAgent.stream([{ role: 'user', content: 'second' }], { runId })).rejects.toThrow(
        /already active/,
      );
      expect(globalRunRegistry.get(runId)).toBeUndefined();
      expect(sendSpy).not.toHaveBeenCalled();
    } finally {
      releaseProcessor();
      await coreEntry.workflowExecution;
      await coreConsume;
      coreResult.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
      await corePubsub.close();
      globalRunRegistry.delete(runId);
    }
  });

  it('does not leak initial registry or abort-listener state when pubsub setup fails', async () => {
    const runId = 'initial-setup-rollback-run';
    const innerPubsub = new EventEmitterPubSub();
    const invalidPubsub = new CachingPubSub(innerPubsub, new InMemoryServerCache());
    const durableAgent = createInngestAgent({
      agent: makeAgent('parity-initial-setup-rollback'),
      inngest,
      pubsub: invalidPubsub,
    });
    const external = new AbortController();

    try {
      await expect(
        durableAgent.stream([{ role: 'user', content: 'hi' }], { runId, abortSignal: external.signal }),
      ).rejects.toThrow(/indexedReplay/);
      expect(globalRunRegistry.has(runId)).toBe(false);
      external.abort('after-failed-setup');
      expect(globalRunRegistry.has(runId)).toBe(false);
    } finally {
      globalRunRegistry.delete(runId);
      await innerPubsub.close();
    }
  });

  it('releases initial registry and external-listener state when stream subscription rejects', async () => {
    class RejectingSubscribePubSub extends PubSub {
      async publish(): Promise<void> {}
      async subscribe(): Promise<void> {
        throw new Error('subscription setup failed');
      }
      async unsubscribe(): Promise<void> {}
      async flush(): Promise<void> {}
    }

    const runId = 'initial-subscription-rollback-run';
    const customPubsub = new CachingPubSub(new RejectingSubscribePubSub(), new InMemoryServerCache(), {
      indexedReplay: { retentionMs: 60_000, maxEvents: 100 },
    });
    const durableAgent = createInngestAgent({
      agent: makeAgent('parity-initial-subscription-rollback'),
      inngest,
      pubsub: customPubsub,
    });
    const external = new AbortController();
    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }], {
      runId,
      abortSignal: external.signal,
    });
    const entry = globalRunRegistry.get(runId);

    try {
      await entry?.workflowExecution;
      expect(globalRunRegistry.has(runId)).toBe(false);
      external.abort('after-rejected-subscription');
      expect(entry?.abortSignal?.aborted).toBe(false);
    } finally {
      result.cleanup();
      globalRunRegistry.delete(runId);
    }
  });

  it('does not dispatch a second sequential start for the same admitted run', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-single-start-admission');
    const sendSpy = stubInngestSend();
    const runId = 'single-start-admission-run';
    const first = await durableAgent.stream([{ role: 'user', content: 'first' }], { runId });

    try {
      const firstExecution = globalRunRegistry.get(runId)?.workflowExecution;
      await expect(firstExecution).resolves.toBeUndefined();
      expect(sendSpy).toHaveBeenCalledTimes(1);
      first.cleanup();

      let resolveError!: () => void;
      const errorSeen = new Promise<void>(resolve => {
        resolveError = resolve;
      });
      const second = await durableAgent.stream([{ role: 'user', content: 'second' }], {
        runId,
        onError: () => resolveError(),
      });
      try {
        await errorSeen;
        expect(sendSpy).toHaveBeenCalledTimes(1);
      } finally {
        second.cleanup();
      }
    } finally {
      first.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('forwards requestContext entries into the workflow trigger event', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-request-context-trigger', {
      durableRequestContextKeys: ['userId', 'organizationId'],
    });
    const sendSpy = stubInngestSend();
    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-1');
    requestContext.set('organizationId', 'org-1');

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }], {
      requestContext,
    });
    try {
      const deadline = Date.now() + 1_000;
      let entry = globalRunRegistry.get(result.runId);
      while (!entry?.workflowExecution && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        entry = globalRunRegistry.get(result.runId);
      }
      await expect(entry?.workflowExecution).resolves.toBeUndefined();

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestContext: {
              userId: 'user-1',
              organizationId: 'org-1',
            },
          }),
        }),
      );
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('rejects overlapping resume admission without replacing the active segment controller', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-overlapping-resume');
    const workflowIds = workflowIdsFor('parity-overlapping-resume');
    const runId = 'overlapping-resume-run';
    const runtimeBindingId = 'overlapping-resume-binding';
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflowIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        executionGeneration: 'overlapping-resume-generation',
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
        status: 'suspended',
        value: {},
        context: { input: { __workflowKind: 'durable-agent', runId, runtimeBindingId } },
        suspendedPaths: { 'agentic-loop': [0] },
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        resumeLabels: {},
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
      },
    });
    let resolveSend!: (result: { ids: string[] }) => void;
    const sendPending = new Promise<{ ids: string[] }>(resolve => {
      resolveSend = resolve;
    });
    const sendSpy = vi.spyOn(inngest as any, 'send').mockImplementation(() => sendPending);
    const firstPending = durableAgent.resume(runId, { answer: 'first' });

    try {
      await vi.waitFor(() => expect(sendSpy).toHaveBeenCalledTimes(1));
      const firstEntry = globalRunRegistry.get(runId);
      const firstController = firstEntry?.abortController;
      await expect(durableAgent.resume(runId, { answer: 'second' })).rejects.toThrow(/resume is already pending/);
      expect(globalRunRegistry.get(runId)).toBe(firstEntry);
      expect(globalRunRegistry.get(runId)?.abortController).toBe(firstController);
    } finally {
      resolveSend({ ids: ['resume-event'] });
      const first = await firstPending;
      first.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('rolls back resume setup state when pubsub initialization fails', async () => {
    const id = 'parity-resume-setup-rollback';
    const innerPubsub = new EventEmitterPubSub();
    const invalidPubsub = new CachingPubSub(innerPubsub, new InMemoryServerCache());
    const durableAgent = createInngestAgent({ agent: makeAgent(id), inngest, pubsub: invalidPubsub });
    const mastra = new Mastra({
      logger: false,
      storage: new DefaultStorage({ id: `${id}-storage`, url: ':memory:' }),
      agents: { [id]: durableAgent },
    });
    const workflowIds = workflowIdsFor(id);
    const runId = 'resume-setup-rollback-run';
    const runtimeBindingId = 'resume-setup-rollback-binding';
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflowIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        executionGeneration: 'resume-setup-rollback-generation',
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
        status: 'suspended',
        value: {},
        context: { input: { __workflowKind: 'durable-agent', runId, runtimeBindingId } },
        suspendedPaths: { 'agentic-loop': [0] },
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        resumeLabels: {},
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
      },
    });
    const previousController = new AbortController();
    const previousEntry = {
      runtimeBindingId,
      tools: {},
      model: {} as any,
      abortController: previousController,
      abortSignal: previousController.signal,
    };
    globalRunRegistry.set(runId, previousEntry);
    const external = new AbortController();

    try {
      await expect(durableAgent.resume(runId, undefined, { abortSignal: external.signal })).rejects.toThrow(
        /indexedReplay/,
      );
      expect(globalRunRegistry.get(runId)).toBe(previousEntry);
      expect(globalRunRegistry.get(runId)?.abortController).toBe(previousController);
      external.abort('after-failed-setup');
      expect(previousController.signal.aborted).toBe(false);
    } finally {
      globalRunRegistry.delete(runId);
      await innerPubsub.close();
      await mastra.shutdown();
    }
  });

  it('restores reused registry state when resume subscription rejects before dispatch', async () => {
    let releaseErrorPublish!: () => void;
    const errorPublishPending = new Promise<void>(resolve => {
      releaseErrorPublish = resolve;
    });
    let rejectSubscription!: (error: Error) => void;
    const subscriptionPending = new Promise<void>((_resolve, reject) => {
      rejectSubscription = reject;
    });
    class RejectingSubscribePubSub extends PubSub {
      async publish(): Promise<void> {
        await errorPublishPending;
      }
      async subscribe(): Promise<void> {
        await subscriptionPending;
      }
      async unsubscribe(): Promise<void> {}
      async flush(): Promise<void> {}
    }

    const id = 'parity-resume-subscription-rollback';
    const customPubsub = new CachingPubSub(new RejectingSubscribePubSub(), new InMemoryServerCache(), {
      indexedReplay: { retentionMs: 60_000, maxEvents: 100 },
    });
    const durableAgent = createInngestAgent({ agent: makeAgent(id), inngest, pubsub: customPubsub });
    const mastra = new Mastra({
      logger: false,
      storage: new DefaultStorage({ id: `${id}-storage`, url: ':memory:' }),
      agents: { [id]: durableAgent },
    });
    const workflowIds = workflowIdsFor(id);
    const runId = 'resume-subscription-rollback-run';
    const runtimeBindingId = 'resume-subscription-rollback-binding';
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflowIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        executionGeneration: 'resume-subscription-rollback-generation',
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
        status: 'suspended',
        value: {},
        context: { input: { __workflowKind: 'durable-agent', runId, runtimeBindingId } },
        suspendedPaths: { 'agentic-loop': [0] },
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        resumeLabels: {},
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
      },
    });
    const previousController = new AbortController();
    const previousWorkflowExecution = Promise.resolve();
    const previousEntry = {
      runtimeBindingId,
      tools: {},
      model: {} as any,
      abortController: previousController,
      abortSignal: previousController.signal,
      workflowExecution: previousWorkflowExecution,
    };
    globalRunRegistry.set(runId, previousEntry);
    const external = new AbortController();
    const result = durableAgent.resume(runId, undefined, { abortSignal: external.signal });
    const rejected = expect(result).rejects.toThrow('resume subscription setup failed');

    try {
      await vi.waitFor(() => expect(previousEntry.abortController).not.toBe(previousController));
      rejectSubscription(new Error('resume subscription setup failed'));
      await rejected;
      expect(globalRunRegistry.get(runId)).toBe(previousEntry);
      expect(previousEntry.abortController).toBe(previousController);
      expect(previousEntry.abortSignal).toBe(previousController.signal);
      expect(previousEntry.workflowExecution).toBe(previousWorkflowExecution);
      external.abort('after-rejected-resume-subscription');
      expect(previousController.signal.aborted).toBe(false);

      // Error publication is still pending, but the reservation was released
      // before awaiting it, so a retry can acquire admission immediately.
      await expect(durableAgent.resume(runId, undefined)).rejects.toThrow('resume subscription setup failed');
      releaseErrorPublish();
    } finally {
      releaseErrorPublish();
      rejectSubscription(new Error('resume subscription setup failed'));
      await rejected;
      globalRunRegistry.delete(runId);
      await mastra.shutdown();
    }
  });

  it('strips unallowlisted legacy snapshot context from the workflow resume event', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-request-context-resume');
    const workflowIds = workflowIdsFor('parity-request-context-resume');
    const sendSpy = stubInngestSend();
    const runId = 'request-context-resume-run';
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflowIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        executionGeneration: 'request-context-resume-generation',
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
        status: 'suspended',
        value: { retainedState: true },
        context: {
          input: {
            __workflowKind: 'durable-agent',
            runId,
            runtimeBindingId: 'request-context-resume-binding',
          },
        },
        suspendedPaths: { 'agentic-loop': [0] },
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        resumeLabels: {},
        serializedStepGraph: workflow.serializedStepGraph,
        requestContext: {
          userId: 'user-1',
          organizationId: 'org-1',
        },
        // Upstream #21566: the suspend snapshot carries the durable tracing anchor
        // so the resumed run continues the trace instead of minting a new one.
        tracingContext: {
          traceId: 'trace-1',
          spanId: 'span-1',
        },
        timestamp: Date.now(),
      },
    });

    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'org-2');
    requestContext.set('requestId', 'request-1');

    const result = await durableAgent.resume(runId, { answer: 'approved' }, { requestContext });
    try {
      const deadline = Date.now() + 1_000;
      let entry = globalRunRegistry.get(runId);
      while (!entry?.workflowExecution && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        entry = globalRunRegistry.get(runId);
      }
      await expect(entry?.workflowExecution).resolves.toBeUndefined();

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy.mock.calls[0]?.[0]).toMatchObject({
        id: expect.stringMatching(/^miwd:v1:/),
        name: `workflow.${workflowIds.AGENTIC_LOOP}`,
        data: {
          runId,
          executionGeneration: 'request-context-resume-generation',
          lifecycleResumeAttempt: 1,
          lifecycleStepStates: {},
          requestContext: {},
          // Upstream #21566: rebuilt from the snapshot's tracing anchor. This is a
          // hashed input of the resume operation identity on both the dispatch and
          // the worker side, so it must travel on the event itself.
          tracingOptions: {
            traceId: 'trace-1',
            parentSpanId: 'span-1',
          },
          resume: expect.objectContaining({
            steps: ['agentic-loop'],
            resumePayload: { answer: 'approved' },
          }),
        },
      });
      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: workflowIds.AGENTIC_LOOP, runId }),
      ).resolves.toMatchObject({
        status: 'running',
        executionGeneration: 'request-context-resume-generation',
        lifecycleResumeAttempt: 1,
        lifecycleStepStates: {},
      });

      // Upstream #21549: a slim resume event never copies persisted state.
      const sentEvent = sendSpy.mock.calls[0]?.[0];
      // `toMatchObject` treats `requestContext: {}` as a vacuous subset match, so
      // assert the PF-2056 allowlist actually stripped BOTH the persisted keys
      // (userId/organizationId) and the fresh ones (organizationId/requestId).
      expect(sentEvent?.data.requestContext).toEqual({});
      expect(sentEvent?.data).not.toHaveProperty('initialState');
      expect(sentEvent?.data).not.toHaveProperty('stepResults');
      expect(sentEvent?.data.resume).not.toHaveProperty('stepResults');
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('merges fresh bounded resume context, persists a sticky policy marker, and never serializes the closure', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-request-context-resume-policy', {
      durableRequestContextKeys: ['organizationId'],
    });
    const workflowIds = workflowIdsFor('parity-request-context-resume-policy');
    const sendSpy = stubInngestSend();
    const runId = 'request-context-resume-policy-run';
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflowIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        executionGeneration: 'request-context-resume-policy-generation',
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
        status: 'suspended',
        value: { retainedState: true },
        context: {
          input: {
            __workflowKind: 'durable-agent',
            runId,
            runtimeBindingId: 'request-context-resume-policy-binding',
          },
        },
        suspendedPaths: { 'agentic-loop': [0] },
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        resumeLabels: {},
        serializedStepGraph: workflow.serializedStepGraph,
        requestContext: { userId: 'persisted-user' },
        timestamp: Date.now(),
      },
    });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'fresh-org');
    requestContext.set(TOOL_PERMISSION_POLICY_KEY, () => 'deny');

    const result = await durableAgent.resume(
      runId,
      { answer: 'approved' },
      { requestContext, requireToolPermissionPolicy: true },
    );
    try {
      const deadline = Date.now() + 1_000;
      let entry = globalRunRegistry.get(runId);
      while (!entry?.workflowExecution && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        entry = globalRunRegistry.get(runId);
      }
      await expect(entry?.workflowExecution).resolves.toBeUndefined();

      const transported = sendSpy.mock.calls[0]?.[0]?.data?.requestContext;
      expect(transported).toEqual({
        organizationId: 'fresh-org',
        [TOOL_PERMISSION_POLICY_REQUIRED_KEY]: true,
      });
      expect(transported).not.toHaveProperty(TOOL_PERMISSION_POLICY_KEY);
      expect(() => structuredClone(transported)).not.toThrow();

      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: workflowIds.AGENTIC_LOOP, runId }),
      ).resolves.toMatchObject({
        requestContext: {
          organizationId: 'fresh-org',
          [TOOL_PERMISSION_POLICY_REQUIRED_KEY]: true,
        },
      });
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('transports the revalidation-hook requirement marker on resume while stripping the closure', async () => {
    // The hook closure never crosses the event boundary; its REQUIRED marker
    // must, or a worker that cannot reconstruct the hook would execute
    // unrevalidated instead of failing closed.
    const { durableAgent, mastra } = makeIsolatedAgent('parity-request-context-resume-hook', {
      durableRequestContextKeys: ['organizationId'],
    });
    const workflowIds = workflowIdsFor('parity-request-context-resume-hook');
    const sendSpy = stubInngestSend();
    const runId = 'request-context-resume-hook-run';
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflowIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        executionGeneration: 'request-context-resume-hook-generation',
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
        status: 'suspended',
        value: { retainedState: true },
        context: {
          input: {
            __workflowKind: 'durable-agent',
            runId,
            runtimeBindingId: 'request-context-resume-hook-binding',
          },
        },
        suspendedPaths: { 'agentic-loop': [0] },
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        resumeLabels: {},
        serializedStepGraph: workflow.serializedStepGraph,
        requestContext: { [ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY]: true },
        timestamp: Date.now(),
      },
    });
    const requestContext = new RequestContext();
    requestContext.set('organizationId', 'fresh-org');
    requestContext.set(ON_BEFORE_TOOL_EXECUTION_KEY, async () => 'allow' as const);

    const result = await durableAgent.resume(runId, { answer: 'approved' }, { requestContext });
    try {
      const deadline = Date.now() + 1_000;
      let entry = globalRunRegistry.get(runId);
      while (!entry?.workflowExecution && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        entry = globalRunRegistry.get(runId);
      }
      await expect(entry?.workflowExecution).resolves.toBeUndefined();

      const transported = sendSpy.mock.calls[0]?.[0]?.data?.requestContext;
      expect(transported).toEqual({
        organizationId: 'fresh-org',
        [ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY]: true,
      });
      expect(transported).not.toHaveProperty(ON_BEFORE_TOOL_EXECUTION_KEY);
      expect(() => structuredClone(transported)).not.toThrow();

      await expect(
        workflowsStore.loadWorkflowSnapshot({ workflowName: workflowIds.AGENTIC_LOOP, runId }),
      ).resolves.toMatchObject({
        requestContext: {
          organizationId: 'fresh-org',
          [ON_BEFORE_TOOL_EXECUTION_REQUIRED_KEY]: true,
        },
      });
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('rehydrates only allowlisted snapshot references and strips legacy credentials on resume', async () => {
    const { durableAgent, mastra } = makeIsolatedAgent('parity-request-context-resume-filtered', {
      durableRequestContextKeys: ['sessionId'],
    });
    const workflowIds = workflowIdsFor('parity-request-context-resume-filtered');
    const sendSpy = stubInngestSend();
    const runId = 'request-context-resume-filtered-run';
    const workflowsStore = await mastra.getStorage()!.getStore('workflows');
    const [workflow] = durableAgent.getDurableWorkflows() as any[];
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: workflowIds.AGENTIC_LOOP,
      runId,
      snapshot: {
        runId,
        executionGeneration: 'request-context-resume-filtered-generation',
        lifecycleResumeAttempt: 0,
        lifecycleStepStates: {},
        status: 'suspended',
        value: {},
        context: {
          input: {
            __workflowKind: 'durable-agent',
            runId,
            runtimeBindingId: 'request-context-resume-filtered-binding',
          },
        },
        suspendedPaths: { 'agentic-loop': [0] },
        activePaths: [],
        activeStepsPath: {},
        waitingPaths: {},
        resumeLabels: {},
        serializedStepGraph: workflow.serializedStepGraph,
        requestContext: {
          sessionId: 'session-safe-reference',
          accessToken: 'legacy-secret',
          credentials: { refreshToken: 'legacy-refresh-secret' },
          [TOOL_PERMISSION_POLICY_REQUIRED_KEY]: true,
        },
        timestamp: Date.now(),
      },
    });

    const result = await durableAgent.resume(runId, undefined);
    try {
      const deadline = Date.now() + 1_000;
      let entry = globalRunRegistry.get(runId);
      while (!entry?.workflowExecution && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        entry = globalRunRegistry.get(runId);
      }
      await expect(entry?.workflowExecution).resolves.toBeUndefined();

      expect(sendSpy.mock.calls[0]?.[0]?.data?.requestContext).toEqual({
        sessionId: 'session-safe-reference',
        [TOOL_PERMISSION_POLICY_REQUIRED_KEY]: true,
      });
      expect(JSON.stringify(sendSpy.mock.calls[0]?.[0])).not.toContain('legacy-secret');
      expect(JSON.stringify(sendSpy.mock.calls[0]?.[0])).not.toContain('legacy-refresh-secret');
      const persistedSnapshot = await workflowsStore.loadWorkflowSnapshot({
        workflowName: workflowIds.AGENTIC_LOOP,
        runId,
      });
      expect(persistedSnapshot).toMatchObject({
        requestContext: {
          sessionId: 'session-safe-reference',
          [TOOL_PERMISSION_POLICY_REQUIRED_KEY]: true,
        },
      });
      expect(JSON.stringify(persistedSnapshot)).not.toContain('legacy-secret');
      expect(JSON.stringify(persistedSnapshot)).not.toContain('legacy-refresh-secret');
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('makes a configured worker permission resolver a serialized fail-closed run requirement', async () => {
    const durableAgent = createInngestAgent({
      agent: makeAgent('parity-worker-policy-marker'),
      inngest,
      resolveToolPermission: () => 'allow',
    });

    const prepared = await durableAgent.prepare([{ role: 'user', content: 'hi' }]);

    expect(prepared.workflowInput.options.permissionPolicyRequired).toBe(true);
  });

  it('forwards the per-call actor signal into the workflow trigger event', async () => {
    // `actor` reaches FGA checks and tool execution by riding on the event
    // payload the execution engine reads. The durable-agent wrapper used to
    // accept the option and drop it, unlike InngestRun's start path.
    const { durableAgent, mastra } = makeIsolatedAgent('parity-actor-trigger');
    const sendSpy = stubInngestSend();
    const actor = { actorKind: 'system', sourceWorkflow: 'nightly-workflow' };

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }], { actor: actor as any });
    try {
      const deadline = Date.now() + 1_000;
      let entry = globalRunRegistry.get(result.runId);
      while (!entry?.workflowExecution && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        entry = globalRunRegistry.get(result.runId);
      }
      await expect(entry?.workflowExecution).resolves.toBeUndefined();

      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ actor }),
        }),
      );
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  it('forwards a re-supplied actor on resume and never reads one from the snapshot', async () => {
    // Matches InngestRun._resumeAndSendEvent: `actor` is a per-call trust
    // signal, so it comes from the caller every time and a value sitting in
    // the persisted snapshot must not leak into the event.
    const sendSpy = stubInngestSend();
    const runId = 'actor-resume-run';
    const { durableAgent, mastra } = await makeAgentWithSnapshot('parity-actor-resume', runId, {
      value: {},
      context: {},
      suspendedPaths: { 'agentic-loop': [0] },
      // A stale actor persisted in storage must be ignored.
      actor: { actorKind: 'system', sourceWorkflow: 'stale-workflow' },
    });

    const actor = { actorKind: 'system', sourceWorkflow: 'fresh-workflow' };
    const result = await durableAgent.resume(runId, { answer: 'approved' }, { actor: actor as any });
    try {
      const deadline = Date.now() + 1_000;
      let entry = globalRunRegistry.get(runId);
      while (!entry?.workflowExecution && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        entry = globalRunRegistry.get(runId);
      }
      await expect(entry?.workflowExecution).resolves.toBeUndefined();

      const sentEvent = sendSpy.mock.calls[0]?.[0] as any;
      expect(sentEvent?.data.actor).toEqual(actor);
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await mastra.shutdown();
    }
  });

  // The agentic loop suspends each tool call under `resumeLabels[toolCallId]`.
  // These cover resume() honouring that label instead of guessing a target from
  // the run's suspended paths, which is ambiguous once two tools are parked.
  describe('resume targeting by toolCallId', () => {
    // A tool call suspends inside the nested tool-execution workflow, so the outer
    // agentic-loop step records the leaf under `__workflow_meta.path`.
    const nestedSuspension = {
      status: 'suspended',
      suspendPayload: { __workflow_meta: { runId: 'nested-run', path: ['ask-human'] } },
    };

    const twoSuspendedSteps = {
      value: {},
      context: {
        'agentic-loop': nestedSuspension,
        'other-step': { status: 'suspended', suspendPayload: {} },
      },
      suspendedPaths: { 'agentic-loop': [0], 'other-step': [1] },
      resumeLabels: {
        'tool-call-a': { stepId: 'agentic-loop' },
        'tool-call-b': { stepId: 'other-step' },
      },
    };

    it('targets the step the named tool call is parked on, down to the nested leaf', async () => {
      const runId = 'resume-by-tool-call-id-run';
      const { durableAgent, mastra } = await makeAgentWithSnapshot('resume-by-tool-call-id', runId, twoSuspendedSteps);
      const sendSpy = stubInngestSend();

      const result = await durableAgent.resume(runId, { answer: 'yes' }, { toolCallId: 'tool-call-a' });
      try {
        expect(sendSpy).toHaveBeenCalledTimes(1);
        const sentEvent = sendSpy.mock.calls[0]?.[0];
        // Without the nested leaf appended the engine only knows the outer step and has
        // to guess which suspension inside it to resume.
        expect(sentEvent?.data.resume.steps).toEqual(['agentic-loop', 'ask-human']);
        expect(sentEvent?.data.resume.resumePath).toEqual([0]);
        expect(sentEvent?.data.resume.resumePayload).toEqual({ answer: 'yes' });
      } finally {
        result.cleanup();
        sendSpy.mockRestore();
        await mastra.shutdown();
      }
    });

    it('rejects an unknown toolCallId instead of resuming the wrong leaf', async () => {
      const { durableAgent, mastra } = await makeAgentWithSnapshot(
        'resume-unknown-tool-call-id',
        'resume-unknown-run',
        twoSuspendedSteps,
      );
      const sendSpy = stubInngestSend();

      await expect(
        durableAgent.resume('resume-unknown-run', { answer: 'yes' }, { toolCallId: 'tool-call-z' }),
      ).rejects.toThrow(/no suspended tool call with id "tool-call-z"/);
      expect(sendSpy).not.toHaveBeenCalled();
      expect(globalRunRegistry.get('resume-unknown-run')).toBeUndefined();

      sendSpy.mockRestore();
      await mastra.shutdown();
    });

    it('rejects an ambiguous resume when multiple tool calls are suspended', async () => {
      const { durableAgent, mastra } = await makeAgentWithSnapshot(
        'resume-ambiguous',
        'resume-ambiguous-run',
        twoSuspendedSteps,
      );
      const sendSpy = stubInngestSend();

      await expect(durableAgent.resume('resume-ambiguous-run', { answer: 'yes' })).rejects.toThrow(
        /more than one suspension is parked/,
      );
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
      await mastra.shutdown();
    });

    it('still infers the single suspended step when no toolCallId is given', async () => {
      const runId = 'resume-single-inferred-run';
      const { durableAgent, mastra } = await makeAgentWithSnapshot('resume-single-inferred', runId, {
        value: {},
        context: {},
        suspendedPaths: { 'agentic-loop': [0] },
        resumeLabels: { 'tool-call-a': { stepId: 'agentic-loop' } },
      });
      const sendSpy = stubInngestSend();

      const result = await durableAgent.resume(runId, { answer: 'yes' });
      try {
        const sentEvent = sendSpy.mock.calls[0]?.[0];
        expect(sentEvent?.data.resume.steps).toEqual(['agentic-loop']);
      } finally {
        result.cleanup();
        sendSpy.mockRestore();
        await mastra.shutdown();
      }
    });

    it('rejects a lost resume acknowledgement while retaining the admitted binding', async () => {
      // Dispatch used to be fire-and-forget: resume() resolved while the run
      // stayed parked, and the failure only ever showed up as a stream error.
      const runId = 'resume-dispatch-failure-run';
      const { durableAgent, mastra } = await makeAgentWithSnapshot('resume-dispatch-failure', runId, {
        value: {},
        context: {},
        suspendedPaths: { 'agentic-loop': [0] },
        resumeLabels: {},
      });
      const sendSpy = vi.spyOn(inngest as any, 'send').mockRejectedValueOnce(new Error('inngest unavailable'));

      try {
        await expect(durableAgent.resume(runId, { answer: 'yes' })).rejects.toThrow('inngest unavailable');
        // A lost acknowledgement may already have queued the worker. Its
        // admitted identity must survive even though the caller sees failure.
        expect(globalRunRegistry.get(runId)).toMatchObject({ runtimeBindingId: `${runId}-binding` });
        expect(sendSpy).toHaveBeenCalledTimes(1);
        const workflowsStore = await mastra.getStorage()!.getStore('workflows');
        await expect(
          workflowsStore.loadWorkflowSnapshot({
            workflowName: workflowIdsFor('resume-dispatch-failure').AGENTIC_LOOP,
            runId,
          }),
        ).resolves.toMatchObject({
          status: 'running',
          resumeCheckpoint: { runId },
        });
      } finally {
        globalRunRegistry.delete(runId);
        sendSpy.mockRestore();
        await mastra.shutdown();
      }
    });
  });

  it('exposes generate() and resumeGenerate() with durable signatures', () => {
    // Slice 5 surface check. The Proxy used to forward both methods to the
    // underlying Agent; after parity work generate() must be the durable
    // implementation defined on the InngestAgent factory, and
    // resumeGenerate() must exist as well (regardless of test environment
    // limitations).
    const durableAgent = createInngestAgent({ agent: makeAgent('parity-generate-surface'), inngest });
    expect(typeof durableAgent.generate).toBe('function');
    expect(typeof durableAgent.resumeGenerate).toBe('function');
    // The Proxy forwarded the underlying Agent's generate signature; the
    // durable replacement is the function defined on the inngestAgent object
    // itself, so it should NOT be the agent's bound generate.
    expect(durableAgent.generate).not.toBe((durableAgent.agent as any).generate);
  });
});

// ---------------------------------------------------------------------------
// Observability tracing (regression for #19841)
//
// The Inngest wrapper used to call prepareForDurableExecution() without a
// `mastra` instance, so the preparation phase could not open its AGENT_RUN root
// and every span it parents (input processors, memory recall) was dropped or
// orphaned into whatever trace the caller happened to supply. The wrapper then
// minted a *second* AGENT_RUN of its own, producing two traces per run.
//
// These tests drive the driver-side preparation path with a recording
// observability instance and assert a single root with correctly parented
// children.
// ---------------------------------------------------------------------------
describe('InngestAgent observability tracing', () => {
  const inngest = new Inngest({
    id: 'observability-tests',
    baseUrl: `http://localhost:${INNGEST_PORT}`,
  });

  function createRecordingObservability() {
    const spans: any[] = [];
    let idCounter = 0;

    function makeSpan(opts: any, parent?: any): any {
      idCounter += 1;
      const span: any = {
        id: `span-${idCounter}`,
        traceId: parent?.traceId ?? `trace-${idCounter}`,
        type: opts?.type,
        name: opts?.name,
        input: opts?.input,
        parent,
        end: vi.fn(),
        error: vi.fn(),
        update: vi.fn(),
        findParent: (spanType: string) => {
          let current = span.parent;
          while (current) {
            if (current.type === spanType) return current;
            current = current.parent;
          }
          return undefined;
        },
        createChildSpan: (childOpts: any) => makeSpan(childOpts, span),
        createEventSpan: (childOpts: any) => makeSpan(childOpts, span),
        executeInContext: async (fn: () => Promise<any>) => fn(),
        executeInContextSync: (fn: () => any) => fn(),
        createTracker: () => ({
          getTracingContext: () => ({ currentSpan: span }),
          reportGenerationError: vi.fn(),
          endGeneration: vi.fn(),
          updateGeneration: vi.fn(),
          wrapStream: <T>(stream: T) => stream,
          startStep: vi.fn(),
          startInference: vi.fn(),
          updateStep: vi.fn(),
          setStepIndex: vi.fn(),
          setDeferStepClose: vi.fn(),
          setInferenceContext: vi.fn(),
          exportCurrentStep: vi.fn(),
          getPendingStepFinishPayload: vi.fn(),
        }),
        exportSpan: () => ({ id: span.id, traceId: span.traceId, type: span.type }),
        getParentSpanId: () => parent?.id,
        getCorrelationContext: vi.fn(),
        observabilityInstance: {},
      };
      spans.push(span);
      return span;
    }

    const mastra = new Mastra({
      logger: false,
      storage: new DefaultStorage({ id: 'tracing-storage', url: ':memory:' }),
    });
    vi.spyOn(mastra, 'observability', 'get').mockReturnValue({
      getSelectedInstance: () => ({
        startSpan: (opts: any) => makeSpan(opts),
      }),
    } as any);

    return {
      mastra,
      spans,
      spansOfType: (type: string) => spans.filter(span => span.type === type),
    };
  }

  function makeTracedAgent(id: string, inputProcessors: any[] = []) {
    const agent = new Agent({
      id,
      name: id,
      instructions: 'Test',
      model: createMockModel() as any,
      ...(inputProcessors.length > 0 ? { inputProcessors } : {}),
    });
    const durableAgent = createInngestAgent({ agent, inngest });
    (durableAgent.pubsub as any).inner = new EventEmitterPubSub();
    return durableAgent;
  }

  it('opens exactly one AGENT_RUN span per durable run', async () => {
    // The wrapper used to mint its own AGENT_RUN on top of preparation's, so a
    // single run reported two roots on two different traces.
    const durableAgent = makeTracedAgent('tracing-single-root');
    const recording = createRecordingObservability();
    recording.mastra.addAgent(durableAgent);
    const sendSpy = vi.spyOn(inngest as any, 'send').mockResolvedValue({ ids: ['tracing-event'] } as any);

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
      await globalRunRegistry.get(result.runId)?.workflowExecution;
      const agentRuns = recording.spansOfType('agent_run');
      expect(agentRuns).toHaveLength(1);
      expect(agentRuns[0].parent).toBeUndefined();

      // Every span produced by the run shares the root's traceId.
      const traceIds = new Set(recording.spans.map(span => span.traceId));
      expect(traceIds).toEqual(new Set([agentRuns[0].traceId]));
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await recording.mastra.shutdown();
    }
  });

  it('parents preparation-phase input processor spans to the AGENT_RUN root', async () => {
    const durableAgent = makeTracedAgent('tracing-input-proc', [
      { id: 'test-input-processor', processInput: async ({ messageList }: any) => messageList },
    ]);
    const recording = createRecordingObservability();
    recording.mastra.addAgent(durableAgent);
    const sendSpy = vi.spyOn(inngest as any, 'send').mockResolvedValue({ ids: ['tracing-event'] } as any);

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
      await globalRunRegistry.get(result.runId)?.workflowExecution;
      const agentRun = recording.spansOfType('agent_run')[0];
      expect(agentRun).toBeDefined();

      const processorSpan = recording
        .spansOfType('processor_run')
        .find(span => span.name === 'input processor: test-input-processor');
      expect(processorSpan).toBeDefined();
      // Used to be a parentless root on its own trace.
      expect(processorSpan.findParent('agent_run')).toBe(agentRun);
      expect(processorSpan.traceId).toBe(agentRun.traceId);
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await recording.mastra.shutdown();
    }
  });

  it('records the caller messages as AGENT_RUN input, not serialized message-list state', async () => {
    const durableAgent = makeTracedAgent('tracing-span-input');
    const recording = createRecordingObservability();
    recording.mastra.addAgent(durableAgent);
    const sendSpy = vi.spyOn(inngest as any, 'send').mockResolvedValue({ ids: ['tracing-event'] } as any);

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
      await globalRunRegistry.get(result.runId)?.workflowExecution;
      const agentRun = recording.spansOfType('agent_run')[0];
      expect(agentRun.input).toEqual([{ role: 'user', content: 'hi' }]);
      // messageListState is the internal serialized shape the wrapper used to record.
      expect(agentRun.input).not.toHaveProperty('messageListState');
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
      await recording.mastra.shutdown();
    }
  });

  it('exports preparation spans onto workflowInput from prepare()', async () => {
    const durableAgent = makeTracedAgent('tracing-prepare');
    const recording = createRecordingObservability();
    recording.mastra.addAgent(durableAgent);

    try {
      const prepared = await durableAgent.prepare([{ role: 'user', content: 'hi' }]);

      const agentRun = recording.spansOfType('agent_run')[0];
      expect(agentRun).toBeDefined();
      expect(prepared.workflowInput.agentSpanData).toMatchObject({
        id: agentRun.id,
        traceId: agentRun.traceId,
      });
    } finally {
      await recording.mastra.shutdown();
    }
  });
});

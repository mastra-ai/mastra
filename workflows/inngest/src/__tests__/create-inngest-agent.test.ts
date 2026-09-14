/**
 * Tests for createInngestAgent factory function
 *
 * These tests verify the new simplified API for creating Inngest-powered durable agents.
 * Full streaming tests are covered by inngest-durable-agent-suite.test.ts which tests
 * the same workflow infrastructure with complete Inngest integration.
 */

import { Agent } from '@mastra/core/agent';
import { AGENT_STREAM_TOPIC, AgentStreamEventTypes, globalRunRegistry } from '@mastra/core/agent/durable';
import { InMemoryServerCache } from '@mastra/core/cache';
import { CachingPubSub, EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { DefaultStorage } from '@mastra/libsql';
import { Inngest } from 'inngest';
import { describe, it, expect, vi } from 'vitest';

import { InngestDurableStepIds } from '../durable-agent/create-inngest-agentic-workflow';
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
    expect(workflows[0].id).toBe(InngestDurableStepIds.AGENTIC_LOOP);
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
    const workflow = workflows.find((w: any) => w.id === InngestDurableStepIds.AGENTIC_LOOP) as any;
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
    const workflow = mastra.getWorkflow(InngestDurableStepIds.AGENTIC_LOOP);
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
    const workflow = mastra.getWorkflow(InngestDurableStepIds.AGENTIC_LOOP);
    expect(workflow).toBeDefined();
  });

  it('should work with multiple durable agents sharing the same workflow', () => {
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

    // Verify workflow is registered (only once)
    const workflow = mastra.getWorkflow(InngestDurableStepIds.AGENTIC_LOOP);
    expect(workflow).toBeDefined();
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

  // Replace inngest.send with a no-op so stream()/resume() don't attempt
  // a real network roundtrip; the only thing under test here is the
  // non-durable preparation/registry path on the agent itself.
  function stubInngestSend(target: Inngest = inngest) {
    return vi.spyOn(target as any, 'send').mockResolvedValue(undefined as any);
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
  function makeIsolatedAgent(id: string) {
    const durableAgent = createInngestAgent({ agent: makeAgent(id), inngest });
    (durableAgent.pubsub as any).inner = new EventEmitterPubSub();
    return durableAgent;
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

  it('exposes result.abort and flips the registry abortSignal', async () => {
    // Slice 2: stream() must own an AbortController, expose it via
    // result.abort, and surface its signal on the run-registry entry so the
    // durable LLM step (when co-located) can short-circuit.
    const durableAgent = makeIsolatedAgent('parity-abort');
    const sendSpy = stubInngestSend();

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
      expect(typeof result.abort).toBe('function');
      const entry = globalRunRegistry.get(result.runId);
      expect(entry?.abortSignal).toBeInstanceOf(AbortSignal);
      expect(entry?.abortSignal?.aborted).toBe(false);

      result.abort('user-cancelled');

      expect(entry?.abortSignal?.aborted).toBe(true);
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
    }
  });

  it('forwards an external abortSignal onto the internal controller', async () => {
    // External signal must be wired through so either source (caller's
    // signal or result.abort) flips the registry-tracked AbortSignal that
    // workflow steps observe.
    const durableAgent = makeIsolatedAgent('parity-abort-external');
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
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
    }
  });

  it('tracks the workflow trigger promise on globalRunRegistry.workflowExecution', async () => {
    // generate()/resumeGenerate() rely on awaiting workflowExecution after a
    // suspend to make sure the snapshot has landed before they return. This
    // covers the registration side of that contract.
    const durableAgent = makeIsolatedAgent('parity-workflow-exec');
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
      // The promise should settle once inngest.send resolves (stubbed to
      // undefined). Awaiting it shouldn't throw.
      await expect(entry?.workflowExecution).resolves.toBeUndefined();
      expect(sendSpy).toHaveBeenCalled();
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
    }
  });

  it('forwards requestContext entries into the workflow trigger event', async () => {
    const durableAgent = makeIsolatedAgent('parity-request-context-trigger');
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
    }
  });

  it('forwards persisted requestContext entries into the workflow resume event', async () => {
    const durableAgent = makeIsolatedAgent('parity-request-context-resume');
    const sendSpy = stubInngestSend();
    const runId = 'request-context-resume-run';
    const loadWorkflowSnapshot = vi.fn().mockResolvedValue({
      value: { retainedState: true },
      context: {},
      suspendedPaths: { 'agentic-loop': ['agentic-loop'] },
      requestContext: {
        userId: 'user-1',
        organizationId: 'org-1',
      },
      tracingContext: {
        traceId: 'trace-1',
        spanId: 'span-1',
      },
    });
    const mastra = {
      getStorage: () => ({
        getStore: async () => ({ loadWorkflowSnapshot }),
      }),
    };
    (durableAgent as any).__setMastra(mastra);

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

      expect(loadWorkflowSnapshot).toHaveBeenCalledWith({
        workflowName: InngestDurableStepIds.AGENTIC_LOOP,
        runId,
      });
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            requestContext: {
              userId: 'user-1',
              organizationId: 'org-2',
              requestId: 'request-1',
            },
            tracingOptions: {
              traceId: 'trace-1',
              parentSpanId: 'span-1',
            },
          }),
        }),
      );
      const sentEvent = sendSpy.mock.calls[0]?.[0];
      expect(sentEvent?.data).not.toHaveProperty('initialState');
      expect(sentEvent?.data).not.toHaveProperty('stepResults');
      expect(sentEvent?.data.resume).not.toHaveProperty('stepResults');
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
    }
  });

  it('forwards the per-call actor signal into the workflow trigger event', async () => {
    // `actor` reaches FGA checks and tool execution by riding on the event
    // payload the execution engine reads. The durable-agent wrapper used to
    // accept the option and drop it, unlike InngestRun's start path.
    const durableAgent = makeIsolatedAgent('parity-actor-trigger');
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
    }
  });

  it('forwards a re-supplied actor on resume and never reads one from the snapshot', async () => {
    // Matches InngestRun._resumeAndSendEvent: `actor` is a per-call trust
    // signal, so it comes from the caller every time and a value sitting in
    // the persisted snapshot must not leak into the event.
    const durableAgent = makeIsolatedAgent('parity-actor-resume');
    const sendSpy = stubInngestSend();
    const runId = 'actor-resume-run';
    const loadWorkflowSnapshot = vi.fn().mockResolvedValue({
      value: {},
      context: {},
      suspendedPaths: { 'agentic-loop': ['agentic-loop'] },
      // A stale actor persisted in storage must be ignored.
      actor: { actorKind: 'system', sourceWorkflow: 'stale-workflow' },
    });
    (durableAgent as any).__setMastra({
      getStorage: () => ({ getStore: async () => ({ loadWorkflowSnapshot }) }),
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
    }
  });

  // The agentic loop suspends each tool call under `resumeLabels[toolCallId]`.
  // These cover resume() honouring that label instead of guessing a target from
  // the run's suspended paths, which is ambiguous once two tools are parked.
  describe('resume targeting by toolCallId', () => {
    function makeAgentWithSnapshot(id: string, snapshot: any) {
      const durableAgent = makeIsolatedAgent(id);
      const loadWorkflowSnapshot = vi.fn().mockResolvedValue(snapshot);
      (durableAgent as any).__setMastra({
        getStorage: () => ({ getStore: async () => ({ loadWorkflowSnapshot }) }),
      });
      return durableAgent;
    }

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
      const durableAgent = makeAgentWithSnapshot('resume-by-tool-call-id', twoSuspendedSteps);
      const sendSpy = stubInngestSend();
      const runId = 'resume-by-tool-call-id-run';

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
      }
    });

    it('rejects an unknown toolCallId instead of resuming the wrong leaf', async () => {
      const durableAgent = makeAgentWithSnapshot('resume-unknown-tool-call-id', twoSuspendedSteps);
      const sendSpy = stubInngestSend();

      await expect(
        durableAgent.resume('resume-unknown-run', { answer: 'yes' }, { toolCallId: 'tool-call-z' }),
      ).rejects.toThrow(/no suspended tool call with id "tool-call-z"/);
      expect(sendSpy).not.toHaveBeenCalled();
      expect(globalRunRegistry.get('resume-unknown-run')).toBeUndefined();

      sendSpy.mockRestore();
    });

    it('rejects an ambiguous resume when multiple tool calls are suspended', async () => {
      const durableAgent = makeAgentWithSnapshot('resume-ambiguous', twoSuspendedSteps);
      const sendSpy = stubInngestSend();

      await expect(durableAgent.resume('resume-ambiguous-run', { answer: 'yes' })).rejects.toThrow(
        /more than one suspension is parked/,
      );
      expect(sendSpy).not.toHaveBeenCalled();

      sendSpy.mockRestore();
    });

    it('still infers the single suspended step when no toolCallId is given', async () => {
      const durableAgent = makeAgentWithSnapshot('resume-single-inferred', {
        value: {},
        context: {},
        suspendedPaths: { 'agentic-loop': [0] },
        resumeLabels: { 'tool-call-a': { stepId: 'agentic-loop' } },
      });
      const sendSpy = stubInngestSend();
      const runId = 'resume-single-inferred-run';

      const result = await durableAgent.resume(runId, { answer: 'yes' });
      try {
        const sentEvent = sendSpy.mock.calls[0]?.[0];
        expect(sentEvent?.data.resume.steps).toEqual(['agentic-loop']);
      } finally {
        result.cleanup();
        sendSpy.mockRestore();
      }
    });

    it('rejects resume() when dispatching the resume event fails', async () => {
      // Dispatch used to be fire-and-forget: resume() resolved while the run
      // stayed parked, and the failure only ever showed up as a stream error.
      const durableAgent = makeAgentWithSnapshot('resume-dispatch-failure', {
        value: {},
        context: {},
        suspendedPaths: { 'agentic-loop': [0] },
        resumeLabels: {},
      });
      const runId = 'resume-dispatch-failure-run';
      const sendSpy = vi.spyOn(inngest as any, 'send').mockRejectedValue(new Error('inngest unavailable'));

      await expect(durableAgent.resume(runId, { answer: 'yes' })).rejects.toThrow('inngest unavailable');
      // A run that was never resumed must not hold on to its registry entry,
      // otherwise a retry of the same runId is blocked.
      expect(globalRunRegistry.get(runId)).toBeUndefined();

      sendSpy.mockRestore();
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

    const mastra = {
      observability: {
        getSelectedInstance: () => ({
          startSpan: (opts: any) => makeSpan(opts),
        }),
      },
    };

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
    (durableAgent as any).__setMastra(recording.mastra);
    const sendSpy = vi.spyOn(inngest as any, 'send').mockResolvedValue(undefined as any);

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
      const agentRuns = recording.spansOfType('agent_run');
      expect(agentRuns).toHaveLength(1);
      expect(agentRuns[0].parent).toBeUndefined();

      // Every span produced by the run shares the root's traceId.
      const traceIds = new Set(recording.spans.map(span => span.traceId));
      expect(traceIds).toEqual(new Set([agentRuns[0].traceId]));
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
    }
  });

  it('parents preparation-phase input processor spans to the AGENT_RUN root', async () => {
    const durableAgent = makeTracedAgent('tracing-input-proc', [
      { id: 'test-input-processor', processInput: async ({ messageList }: any) => messageList },
    ]);
    const recording = createRecordingObservability();
    (durableAgent as any).__setMastra(recording.mastra);
    const sendSpy = vi.spyOn(inngest as any, 'send').mockResolvedValue(undefined as any);

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
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
    }
  });

  it('records the caller messages as AGENT_RUN input, not serialized message-list state', async () => {
    const durableAgent = makeTracedAgent('tracing-span-input');
    const recording = createRecordingObservability();
    (durableAgent as any).__setMastra(recording.mastra);
    const sendSpy = vi.spyOn(inngest as any, 'send').mockResolvedValue(undefined as any);

    const result = await durableAgent.stream([{ role: 'user', content: 'hi' }]);
    try {
      const agentRun = recording.spansOfType('agent_run')[0];
      expect(agentRun.input).toEqual([{ role: 'user', content: 'hi' }]);
      // messageListState is the internal serialized shape the wrapper used to record.
      expect(agentRun.input).not.toHaveProperty('messageListState');
    } finally {
      result.cleanup();
      sendSpy.mockRestore();
    }
  });

  it('exports preparation spans onto workflowInput from prepare()', async () => {
    const durableAgent = makeTracedAgent('tracing-prepare');
    const recording = createRecordingObservability();
    (durableAgent as any).__setMastra(recording.mastra);

    const prepared = await durableAgent.prepare([{ role: 'user', content: 'hi' }]);

    const agentRun = recording.spansOfType('agent_run')[0];
    expect(agentRun).toBeDefined();
    expect(prepared.workflowInput.agentSpanData).toMatchObject({
      id: agentRun.id,
      traceId: agentRun.traceId,
    });
  });
});

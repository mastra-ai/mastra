import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { AGENT_STREAM_TOPIC } from '../../agent/durable/constants';
import type { ActorSignal } from '../../auth/ee';
import { InMemoryServerCache } from '../../cache/inmemory';
import { MastraError } from '../../error';
import { CachingPubSub } from '../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import { Mastra } from '../../mastra';
import { RequestContext } from '../../request-context';
import { PUBSUB_SYMBOL } from '../constants';
import type { StepFlowEntry, StepResult } from '../types';
import { createStep } from '../workflow';
import { StepExecutor } from './step-executor';

interface SleepFnContext {
  workflowId: string;
  runId: string;
  mastra: Mastra;
  requestContext: RequestContext;
  actor?: ActorSignal;
  inputData: any;
  retryCount: number;
  resumeData: any;
  getInitData: () => any;
  getStepResult: (step: { id?: string }) => any;
  suspend: (suspendPayload: any) => Promise<any>;
  bail: (result: any) => void;
  abort: () => void;
  writer: any;
  engine: Record<string, unknown>;
  abortSignal: AbortSignal;
  tracingContext: Record<string, unknown>;
  [key: string]: any; // For EMITTER_SYMBOL
}

describe('StepExecutor', () => {
  let stepExecutor: StepExecutor;
  let mastra: Mastra;
  let capturedContexts: SleepFnContext[];
  let requestContext: RequestContext;

  beforeEach(() => {
    mastra = new Mastra();
    stepExecutor = new StepExecutor({ mastra });
    capturedContexts = [];
    requestContext = new RequestContext();
  });

  it('should return step.duration directly when provided', async () => {
    // Arrange: Create sleep step with explicit duration and spy on fn
    const duration = 1000;
    const fnSpy = vi.fn().mockReturnValue(5000);
    const step: Extract<StepFlowEntry, { type: 'sleep' }> = {
      type: 'sleep',
      id: 'sleep-duration',
      duration,
      fn: fnSpy,
    };

    // Act: Call resolveSleep with step containing duration
    const result = await stepExecutor.resolveSleep({
      workflowId: 'test-workflow',
      step,
      runId: 'test-run',
      requestContext,
      stepResults: {},
    });

    // Assert: Verify return value and fn was not called
    expect(result).toBe(duration);
    expect(fnSpy).not.toHaveBeenCalled();
  });

  it('should return 0 when step.fn is not provided or null', async () => {
    // Arrange: Create base sleep step parameters
    const baseParams = {
      workflowId: 'test-workflow',
      runId: 'test-run',
      requestContext,
      stepResults: {},
    };

    // Test undefined fn case
    const undefinedStep: Extract<StepFlowEntry, { type: 'sleep' }> = {
      type: 'sleep',
      id: 'sleep-undefined-fn',
    };

    // Test null fn case
    const nullStep: Extract<StepFlowEntry, { type: 'sleep' }> = {
      type: 'sleep',
      id: 'sleep-null-fn',
      fn: null as any,
    };

    // Act & Assert: Verify both undefined and null fn return 0
    const undefinedResult = await stepExecutor.resolveSleep({
      ...baseParams,
      step: undefinedStep,
    });
    expect(undefinedResult).toBe(0);

    const nullResult = await stepExecutor.resolveSleep({
      ...baseParams,
      step: nullStep,
    });
    expect(nullResult).toBe(0);
  });

  it('should pass correct parameters to step.fn and return its value', async () => {
    // Arrange: Set up test data and capture fn
    const EXPECTED_DURATION = 5000;
    const workflowId = 'test-workflow';
    const runId = 'test-run';
    const inputData = { key: 'value' };
    const resumeData = { state: 'resumed' };
    const retryCount = 2;
    const requestContext = new RequestContext();
    const actor: ActorSignal = { actorKind: 'system', sourceWorkflow: 'test-workflow' };

    const step: Extract<StepFlowEntry, { type: 'sleep' }> = {
      id: 'sleep-1',
      type: 'sleep',
      fn: async context => {
        capturedContexts.push(context as unknown as SleepFnContext);
        return EXPECTED_DURATION;
      },
    };

    const stepResults: Record<string, StepResult<any, any, any, any>> = {
      input: {
        status: 'success',
        output: { initData: 'test' },
        payload: {},
        startedAt: 0,
        endedAt: 0,
      },
      'previous-step': {
        status: 'success',
        output: { prevStepData: 'test' },
        payload: {},
        startedAt: 0,
        endedAt: 0,
      },
    };

    // Act: Call resolveSleep with test parameters
    const result = await stepExecutor.resolveSleep({
      workflowId,
      step,
      runId,
      input: inputData,
      resumeData,
      stepResults,
      requestContext,
      actor,
      retryCount,
    });

    // Assert: Verify context passed to fn and return value
    expect(capturedContexts.length).toBe(1);
    const capturedContext = capturedContexts[0]!;

    expect(capturedContext.workflowId).toBe(workflowId);
    expect(capturedContext.runId).toBe(runId);
    expect(capturedContext.mastra).toBe(mastra);
    expect(capturedContext.requestContext).toBe(requestContext);
    expect(capturedContext.actor).toBe(actor);
    expect(capturedContext.inputData).toBe(inputData);
    expect(capturedContext.retryCount).toBe(retryCount);
    expect(capturedContext.resumeData).toBe(resumeData);

    // Verify helper functions work correctly
    expect(capturedContext.getInitData()).toEqual(stepResults.input);
    expect(capturedContext.getStepResult({ id: 'previous-step' })).toEqual({ prevStepData: 'test' });
    expect(capturedContext.getStepResult({})).toBeNull();

    // Verify return value
    expect(result).toBe(EXPECTED_DURATION);
  });

  it('should return 0 when step.fn throws an error', async () => {
    // Arrange: Create a step object with fn that throws an error
    const throwingStep: Extract<StepFlowEntry, { type: 'sleep' }> = {
      type: 'sleep',
      id: 'sleep-throwing-fn',
      fn: () => {
        throw new Error('Test error');
      },
    };

    const params = {
      workflowId: 'test-workflow',
      step: throwingStep,
      runId: 'test-run',
      stepResults: {},
      requestContext,
    };

    // Act & Assert: Call resolveSleep and verify it returns 0
    const result = await stepExecutor.resolveSleep(params);
    expect(result).toBe(0);
  });

  it('should save only error message without stack trace when step fails', async () => {
    const errorMessage = 'Test error: step execution failed.';
    const thrownError = new Error(errorMessage);
    const failingStep = createStep({
      id: 'failing-step',
      execute: vi.fn().mockImplementation(() => {
        throw thrownError;
      }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const result = await stepExecutor.execute({
      workflowId: 'test-workflow',
      entry: { type: 'step', step: failingStep },
      runId: 'test-run',
      input: {},
      stepResults: {},
      state: {},
      requestContext,
    });

    expect(result.status).toBe('failed');
    const failedResult = result as Extract<typeof result, { status: 'failed' }>;
    // Error is now preserved as Error instance instead of string
    expect(failedResult.error).toBeInstanceOf(Error);
    // Verify exact same error instance is preserved
    expect(failedResult.error).toBe(thrownError);
    expect((failedResult.error as Error).message).toBe(errorMessage);
    // Stack is preserved on instance for debugging, but excluded from JSON serialization
    // (per getErrorFromUnknown with serializeStack: false)
    expect((failedResult.error as Error).stack).toBeDefined();
    // Verify stack is not in JSON output
    const serialized = JSON.stringify(failedResult.error);
    expect(serialized).not.toContain('stack');
  });

  it('should save MastraError message without stack trace when step fails', async () => {
    const errorMessage = 'Test MastraError: step execution failed.';
    const thrownError = new MastraError({
      id: 'VALIDATION_ERROR',
      domain: 'MASTRA_WORKFLOW',
      category: 'USER',
      text: errorMessage,
      details: { field: 'test' },
    });
    const failingStep = createStep({
      id: 'failing-step',
      execute: vi.fn().mockImplementation(() => {
        throw thrownError;
      }),
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    });

    const result = await stepExecutor.execute({
      workflowId: 'test-workflow',
      entry: { type: 'step', step: failingStep },
      runId: 'test-run',
      input: {},
      stepResults: {},
      state: {},
      requestContext,
    });

    expect(result.status).toBe('failed');
    const failedResult = result as Extract<typeof result, { status: 'failed' }>;
    // Error is now preserved as Error instance instead of string, including MastraError properties
    expect(failedResult.error).toBeInstanceOf(Error);
    // Verify exact same error instance is preserved
    expect(failedResult.error).toBe(thrownError);
    expect((failedResult.error as Error).message).toBe(errorMessage);
    // MastraError properties should be preserved
    expect((failedResult.error as any).id).toBe('VALIDATION_ERROR');
    expect((failedResult.error as any).domain).toBe('MASTRA_WORKFLOW');
    expect((failedResult.error as any).category).toBe('USER');
    expect((failedResult.error as any).details).toEqual({ field: 'test' });
    // Stack is preserved on instance for debugging, but excluded from JSON serialization
    // (per getErrorFromUnknown with serializeStack: false)
    expect((failedResult.error as Error).stack).toBeDefined();
    // Verify stack is not in JSON output
    const serialized = JSON.stringify(failedResult.error);
    expect(serialized).not.toContain('stack');
  });

  describe('abort signal propagation', () => {
    it('should propagate parent abortController to resolveSleep fn context', async () => {
      // Arrange: Create a parent abort controller and track what abortSignal the fn receives
      const parentAbortController = new AbortController();
      let receivedAbortSignal: AbortSignal | undefined;

      const step: Extract<StepFlowEntry, { type: 'sleep' }> = {
        type: 'sleep',
        id: 'sleep-abort-propagation',
        fn: async context => {
          receivedAbortSignal = context.abortSignal;
          return 1000;
        },
      };

      // Act: Call resolveSleep with parent abort controller
      await stepExecutor.resolveSleep({
        workflowId: 'test-workflow',
        step,
        runId: 'test-run',
        requestContext,
        stepResults: {},
        abortController: parentAbortController,
      });

      // Assert: The fn should receive the parent's abort signal
      expect(receivedAbortSignal).toBe(parentAbortController.signal);
    });

    it('should reflect parent abort in resolveSleep fn context when parent is aborted', async () => {
      // Arrange: Create a parent abort controller
      const parentAbortController = new AbortController();
      let wasAbortedDuringExecution = false;

      const step: Extract<StepFlowEntry, { type: 'sleep' }> = {
        type: 'sleep',
        id: 'sleep-abort-reflected',
        fn: async context => {
          // Abort the parent controller during fn execution
          parentAbortController.abort();
          wasAbortedDuringExecution = context.abortSignal.aborted;
          return 1000;
        },
      };

      // Act: Call resolveSleep with parent abort controller
      await stepExecutor.resolveSleep({
        workflowId: 'test-workflow',
        step,
        runId: 'test-run',
        requestContext,
        stepResults: {},
        abortController: parentAbortController,
      });

      // Assert: The abort should be reflected in the fn's context
      expect(wasAbortedDuringExecution).toBe(true);
    });

    it('should propagate parent abortController to resolveSleepUntil fn context', async () => {
      // Arrange: Create a parent abort controller and track what abortSignal the fn receives
      const parentAbortController = new AbortController();
      const actor: ActorSignal = { actorKind: 'system', sourceWorkflow: 'test-workflow' };
      let receivedAbortSignal: AbortSignal | undefined;
      let receivedActor: ActorSignal | undefined;

      const step: Extract<StepFlowEntry, { type: 'sleepUntil' }> = {
        type: 'sleepUntil',
        id: 'sleep-until-abort-propagation',
        fn: async context => {
          receivedAbortSignal = context.abortSignal;
          receivedActor = context.actor;
          return new Date(Date.now() + 1000);
        },
      };

      // Act: Call resolveSleepUntil with parent abort controller
      await stepExecutor.resolveSleepUntil({
        workflowId: 'test-workflow',
        step,
        runId: 'test-run',
        requestContext,
        stepResults: {},
        actor,
        abortController: parentAbortController,
      });

      // Assert: The fn should receive the parent's abort signal and actor
      expect(receivedAbortSignal).toBe(parentAbortController.signal);
      expect(receivedActor).toBe(actor);
    });

    it('should propagate parent abortController to evaluateConditions condition fn context', async () => {
      // Arrange: Create a parent abort controller and track what abortSignal the condition receives
      const parentAbortController = new AbortController();
      let receivedAbortSignal: AbortSignal | undefined;

      const step: Extract<StepFlowEntry, { type: 'conditional' }> = {
        type: 'conditional',
        conditions: [
          async context => {
            receivedAbortSignal = context.abortSignal;
            return true;
          },
        ],
        serializedConditions: [{ id: 'dummy-condition', fn: 'async () => true' }],
        steps: [{ type: 'step', step: { id: 'dummy' } as any }],
      };

      // Act: Call evaluateConditions with parent abort controller
      await stepExecutor.evaluateConditions({
        workflowId: 'test-workflow',
        step,
        runId: 'test-run',
        requestContext,
        stepResults: {},
        state: {},
        abortController: parentAbortController,
      });

      // Assert: The condition fn should receive the parent's abort signal
      expect(receivedAbortSignal).toBe(parentAbortController.signal);
    });

    it('should create a new AbortController when none is provided (backwards compatibility)', async () => {
      // Arrange: Track that an abortSignal is still provided even without parent controller
      let receivedAbortSignal: AbortSignal | undefined;

      const step: Extract<StepFlowEntry, { type: 'sleep' }> = {
        type: 'sleep',
        id: 'sleep-no-abort-controller',
        fn: async context => {
          receivedAbortSignal = context.abortSignal;
          return 1000;
        },
      };

      // Act: Call resolveSleep WITHOUT parent abort controller
      await stepExecutor.resolveSleep({
        workflowId: 'test-workflow',
        step,
        runId: 'test-run',
        requestContext,
        stepResults: {},
        // No abortController provided
      });

      // Assert: An abortSignal should still be provided (from internally created controller)
      expect(receivedAbortSignal).toBeDefined();
      expect(receivedAbortSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('evaluateConditions error handling', () => {
    const run = (conditions: any[]) =>
      stepExecutor.evaluateConditions({
        workflowId: 'test-workflow',
        step: {
          type: 'conditional',
          conditions,
          serializedConditions: conditions.map((_, i) => ({ id: `c${i}`, fn: '' })),
          steps: conditions.map((_, i) => ({ type: 'step', step: { id: `s${i}` } as any })),
        },
        runId: 'test-run',
        requestContext,
        stepResults: {},
        state: {},
      });

    it('treats an async-throwing condition as falsy and evaluates the rest', async () => {
      const result = await run([
        async () => {
          throw new Error('boom');
        },
        async () => true,
      ]);
      expect(result).toEqual([1]);
    });

    it('treats a sync-throwing condition as falsy and evaluates the rest', async () => {
      const result = await run([
        () => {
          throw new Error('boom');
        },
        async () => true,
      ]);
      expect(result).toEqual([1]);
    });

    it('returns no indexes when every condition throws', async () => {
      const result = await run([
        async () => {
          throw new Error('boom');
        },
      ]);
      expect(result).toEqual([]);
    });
  });

  describe('step pubsub numbering', () => {
    async function captureStepPubsub(target: Mastra): Promise<Record<PropertyKey, any>> {
      let captured: Record<PropertyKey, any> | undefined;
      const step = createStep({
        id: 'capture-pubsub',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        execute: async params => {
          captured = params as unknown as Record<PropertyKey, any>;
          return {};
        },
      });

      const result = await new StepExecutor({ mastra: target }).execute({
        workflowId: 'test-workflow',
        entry: { type: 'step', step } as Extract<StepFlowEntry, { type: 'step' }>,
        runId: 'test-run',
        input: {},
        stepResults: {},
        state: {},
        requestContext: new RequestContext(),
      });

      expect(result.status).toBe('success');
      if (!captured) throw new Error('step did not receive an execution context');
      return captured;
    }

    it('numbers agent-stream events published from a step', async () => {
      const cache = new InMemoryServerCache();
      const context = await captureStepPubsub(new Mastra({ cache }));
      const stepPubsub = context[PUBSUB_SYMBOL] as PubSub;

      // COR-1474: step-published frames used to bypass the agent's
      // CachingPubSub, so a retaining transport replayed them unnumbered and
      // `observe({ offset })` could neither skip nor dedupe them.
      expect(stepPubsub).toBeInstanceOf(CachingPubSub);

      const topic = AGENT_STREAM_TOPIC('run-numbered');
      for (const n of [0, 1]) {
        await stepPubsub.publish(topic, {
          type: 'chunk',
          runId: 'run-numbered',
          data: { n },
        } as any);
      }

      const cached = await cache.listFromTo(`pubsub:${topic}`, 0);
      expect(cached.map(event => event.index)).toEqual([0, 1]);
    });

    it('reuses a configured caching pubsub so one step frame is cached once', async () => {
      const cache = new InMemoryServerCache();
      const pubsub = new CachingPubSub(new EventEmitterPubSub(), cache);
      const target = new Mastra({ pubsub, cache });
      const context = await captureStepPubsub(target);
      const stepPubsub = context[PUBSUB_SYMBOL] as PubSub;
      const topic = AGENT_STREAM_TOPIC('run-prewrapped');
      const live: Event[] = [];
      await target.pubsub.subscribe(topic, event => {
        live.push(event);
      });

      await stepPubsub.publish(topic, {
        type: 'chunk',
        runId: 'run-prewrapped',
        data: { n: 0 },
      } as any);

      expect(live).toHaveLength(1);
      const cached = await cache.listFromTo(`pubsub:${topic}`, 0);
      expect(cached.map(event => event.index)).toEqual([0]);
      expect(live[0]?.index).toBe(0);
      expect(stepPubsub).toBe(target.pubsub);
    });

    it('publishes step frames unnumbered when a process-local cache sits behind a cross-process transport', async () => {
      // Stands in for a transport that reaches other processes (Redis, Unix socket).
      class RemoteTransport extends PubSub {
        readonly bus = new EventEmitterPubSub();
        publish(...args: Parameters<PubSub['publish']>) {
          return this.bus.publish(...args);
        }
        subscribe(...args: Parameters<PubSub['subscribe']>) {
          return this.bus.subscribe(...args);
        }
        unsubscribe(...args: Parameters<PubSub['unsubscribe']>) {
          return this.bus.unsubscribe(...args);
        }
        flush() {
          return this.bus.flush();
        }
      }
      const cache = new InMemoryServerCache();
      const context = await captureStepPubsub(new Mastra({ pubsub: new RemoteTransport(), cache }));
      const stepPubsub = context[PUBSUB_SYMBOL] as PubSub;
      const topic = AGENT_STREAM_TOPIC('run-remote');

      // Each process would number from its own in-memory counter, and the
      // observer would drop the worker's frames as late duplicates.
      await stepPubsub.publish(topic, { type: 'chunk', runId: 'run-remote', data: { n: 0 } } as any);

      expect(stepPubsub).not.toBeInstanceOf(CachingPubSub);
      expect(await cache.listLength(`pubsub:${topic}`)).toBe(0);
    });

    it('does not cache run-local step events even when the cache is atomic', async () => {
      const cache = new InMemoryServerCache();
      const context = await captureStepPubsub(new Mastra({ cache }));
      const stepPubsub = context[PUBSUB_SYMBOL] as PubSub;

      await stepPubsub.publish('workflow.events.v2.run-numbered', {
        type: 'watch',
        runId: 'run-numbered',
        data: {},
      } as any);

      expect(await cache.listLength('pubsub:workflow.events.v2.run-numbered')).toBe(0);
    });
  });
});

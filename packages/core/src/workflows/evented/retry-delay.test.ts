/**
 * Retry delay for failed workflow steps (#29389).
 *
 * A workflow's `retryConfig.delay` is the backoff a caller sets to give a
 * recovering or rate-limited service time between attempts. The default
 * engine waits that long before each retry. The evented engine used to
 * republish `workflow.step.run` straight away, so every retry ran
 * immediately. These cases run on both engines so the two stay in step.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import type { Event } from '../../events';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage/mock';
import { createWorkflow as createDefaultWorkflow } from '../create';
import { createStep as createDefaultStep } from '../workflow';
import { WorkflowEventProcessor } from './workflow-event-processor';
import { createStep as createEventedStep, createWorkflow as createEventedWorkflow } from '.';

const DELAY_MS = 250;
// Node never fires a timer early, but performance.now() and the timer clock
// round differently, so allow a few milliseconds below the configured delay.
const TIMER_SLACK_MS = 5;

type Engine = 'default' | 'evented';

interface Attempt {
  at: number;
  retryCount: number;
}

interface RetryScenario {
  id: string;
  /** Number of attempts that throw before the step succeeds. */
  failures: number;
  retryConfig?: { attempts?: number; delay?: number };
  stepRetries?: number;
}

const outputSchema = z.object({ ok: z.boolean() });

function buildWorkflow(engine: Engine, scenario: RetryScenario, attempts: Attempt[]) {
  const execute = async ({ retryCount }: { retryCount: number }) => {
    attempts.push({ at: performance.now(), retryCount });
    if (attempts.length <= scenario.failures) {
      throw new Error(`scripted transient failure ${attempts.length}`);
    }
    return { ok: true };
  };
  const workflowId = `${scenario.id}-${engine}`;
  const workflowConfig = {
    id: workflowId,
    inputSchema: z.object({}),
    outputSchema,
    ...(scenario.retryConfig ? { retryConfig: scenario.retryConfig } : {}),
  };
  const stepConfig = {
    id: 'transient',
    inputSchema: z.object({}),
    outputSchema,
    ...(scenario.stepRetries !== undefined ? { retries: scenario.stepRetries } : {}),
    execute,
  };

  if (engine === 'evented') {
    return createEventedWorkflow(workflowConfig).then(createEventedStep(stepConfig)).commit();
  }
  return createDefaultWorkflow(workflowConfig).then(createDefaultStep(stepConfig)).commit();
}

function gapsBetween(attempts: Attempt[]): number[] {
  return attempts.slice(1).map((attempt, i) => attempt.at - attempts[i]!.at);
}

const mastras: Mastra[] = [];

afterEach(async () => {
  await Promise.all(mastras.splice(0).map(mastra => mastra.stopWorkers()));
});

async function startMastra(workflow: ReturnType<typeof buildWorkflow>) {
  const mastra = new Mastra({
    logger: false,
    storage: new InMemoryStore(),
    workflows: { [workflow.id]: workflow },
  });
  mastras.push(mastra);
  await mastra.startWorkers();
  return mastra;
}

async function runScenario(engine: Engine, scenario: RetryScenario) {
  const attempts: Attempt[] = [];
  const workflow = buildWorkflow(engine, scenario, attempts);
  await startMastra(workflow);
  const run = await workflow.createRun();
  const result = await run.start({ inputData: {} });
  return { result, attempts };
}

describe.each<Engine>(['default', 'evented'])('retryConfig.delay on the %s engine (#29389)', engine => {
  it('waits the configured delay before each retry of a failing step', async () => {
    const { result, attempts } = await runScenario(engine, {
      id: 'retry-delay-workflow-attempts',
      failures: 2,
      retryConfig: { attempts: 2, delay: DELAY_MS },
    });

    expect(result.status).toBe('success');
    expect(attempts.map(a => a.retryCount)).toEqual([0, 1, 2]);
    for (const gap of gapsBetween(attempts)) {
      expect(gap).toBeGreaterThanOrEqual(DELAY_MS - TIMER_SLACK_MS);
    }
  });

  it('applies the workflow delay when the step sets its own retry count', async () => {
    const { result, attempts } = await runScenario(engine, {
      id: 'retry-delay-step-retries',
      failures: 1,
      retryConfig: { delay: DELAY_MS },
      stepRetries: 1,
    });

    expect(result.status).toBe('success');
    expect(attempts.map(a => a.retryCount)).toEqual([0, 1]);
    expect(gapsBetween(attempts)[0]).toBeGreaterThanOrEqual(DELAY_MS - TIMER_SLACK_MS);
  });

  it('keeps the attempt budget: fails after the last delayed retry', async () => {
    const { result, attempts } = await runScenario(engine, {
      id: 'retry-delay-exhausted',
      failures: Number.POSITIVE_INFINITY,
      retryConfig: { attempts: 1, delay: DELAY_MS },
    });

    expect(result.status).toBe('failed');
    expect(attempts.map(a => a.retryCount)).toEqual([0, 1]);
    expect(gapsBetween(attempts)[0]).toBeGreaterThanOrEqual(DELAY_MS - TIMER_SLACK_MS);
  });

  it('lets a parallel branch finish while a sibling waits out its retry delay', async () => {
    const attempts: Attempt[] = [];
    let siblingDoneAt: number | undefined;
    const flaky = {
      id: 'flaky',
      inputSchema: z.object({}),
      outputSchema,
      execute: async ({ retryCount }: { retryCount: number }) => {
        attempts.push({ at: performance.now(), retryCount });
        if (attempts.length === 1) throw new Error('scripted transient failure');
        return { ok: true };
      },
    };
    const sibling = {
      id: 'sibling',
      inputSchema: z.object({}),
      outputSchema,
      execute: async () => {
        siblingDoneAt = performance.now();
        return { ok: true };
      },
    };
    const workflowConfig = {
      id: `retry-delay-parallel-${engine}`,
      inputSchema: z.object({}),
      outputSchema: z.any(),
      retryConfig: { attempts: 1, delay: DELAY_MS },
    };
    const workflow =
      engine === 'evented'
        ? createEventedWorkflow(workflowConfig)
            .parallel([createEventedStep(flaky), createEventedStep(sibling)])
            .commit()
        : createDefaultWorkflow(workflowConfig)
            .parallel([createDefaultStep(flaky), createDefaultStep(sibling)])
            .commit();
    await startMastra(workflow);
    const result = await (await workflow.createRun()).start({ inputData: {} });

    expect(result.status).toBe('success');
    expect(attempts.map(a => a.retryCount)).toEqual([0, 1]);
    expect(gapsBetween(attempts)[0]).toBeGreaterThanOrEqual(DELAY_MS - TIMER_SLACK_MS);
    expect(siblingDoneAt).toBeDefined();
    expect(siblingDoneAt!).toBeLessThan(attempts[1]!.at);
  });

  it('still retries when no delay is configured', async () => {
    const { result, attempts } = await runScenario(engine, {
      id: 'retry-delay-unset',
      failures: 2,
      retryConfig: { attempts: 2 },
    });

    expect(result.status).toBe('success');
    expect(attempts.map(a => a.retryCount)).toEqual([0, 1, 2]);
  });
});

/**
 * Stands in for an at-least-once broker. It records every `workflow.step.run`
 * delivery with its id so one can be redelivered, and it can swallow the first
 * delayed retry, the way a worker that dies mid-delay never publishes it.
 */
class CrashingRetryPubSub extends EventEmitterPubSub {
  deliveries: Event[] = [];
  droppedRetry = false;

  async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: { localOnly?: boolean }) {
    if (topic === 'workflows' && event.type === 'workflow.step.run' && event.data?.retryCount === 1) {
      if (!this.droppedRetry) {
        this.droppedRetry = true;
        return;
      }
    }
    await super.publish(topic, event, options);
  }
}

describe('retryConfig.delay on the evented engine: redelivery (#29389)', () => {
  const defaultFenceTtl = WorkflowEventProcessor.STEP_FENCE_TTL_MS;
  afterEach(() => {
    WorkflowEventProcessor.STEP_FENCE_TTL_MS = defaultFenceTtl;
  });

  // A worker that dies during the delay never acks its delivery, so the broker
  // redelivers it and the run finishes instead of hanging. InMemoryStore has no
  // step-occurrence guards, so the interrupted attempt runs again (normal
  // at-least-once behavior) and its retry still waits the configured delay.
  it('finishes the run after a worker dies mid-delay and the delivery is redelivered', async () => {
    // Short fence so the redelivery is not dropped as a duplicate of the
    // delivery that "crashed"; a real broker redelivers after the lease lapses.
    WorkflowEventProcessor.STEP_FENCE_TTL_MS = 50;
    const pubsub = new CrashingRetryPubSub();
    await pubsub.subscribe('workflows', async event => {
      if (event.type === 'workflow.step.run') pubsub.deliveries.push(structuredClone(event));
    });
    const attempts: Attempt[] = [];
    const workflow = buildWorkflow(
      'evented',
      { id: 'retry-delay-redelivery', failures: 2, retryConfig: { attempts: 1, delay: DELAY_MS } },
      attempts,
    );
    const mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
      workflows: { [workflow.id]: workflow },
    });
    mastras.push(mastra);
    await mastra.startWorkers();
    const run = await workflow.createRun();
    const resultPromise = run.start({ inputData: {} });

    await vi.waitFor(() => expect(pubsub.droppedRetry).toBe(true), { timeout: 5_000, interval: 5 });
    const interrupted = pubsub.deliveries.find(event => event.runId === run.runId && !event.data?.retryCount);
    expect(interrupted?.id).toBeDefined();
    // Let the lapsed delivery's fence expire, then redeliver it unchanged.
    await new Promise(resolve => setTimeout(resolve, 100));
    await new WorkflowEventProcessor({ mastra }).handle(interrupted!);
    const result = await resultPromise;

    expect(result.status).toBe('success');
    expect(attempts.map(a => a.retryCount)).toEqual([0, 0, 1]);
    expect(gapsBetween(attempts)[1]).toBeGreaterThanOrEqual(DELAY_MS - TIMER_SLACK_MS);
  });
});

describe('retryConfig.delay on the evented engine: cancellation (#29389)', () => {
  it('does not run the retry when the run is canceled during the delay', async () => {
    const attempts: Attempt[] = [];
    const workflow = buildWorkflow(
      'evented',
      { id: 'retry-delay-canceled', failures: Number.POSITIVE_INFINITY, retryConfig: { attempts: 2, delay: DELAY_MS } },
      attempts,
    );
    await startMastra(workflow);
    const run = await workflow.createRun();
    const resultPromise = run.start({ inputData: {} });

    await vi.waitFor(() => expect(attempts).toHaveLength(1), { timeout: 5_000, interval: 5 });
    await run.cancel();
    const result = await resultPromise;
    // Give a retry that ignored the cancel time to start.
    await new Promise(resolve => setTimeout(resolve, DELAY_MS * 2));

    expect(result.status).toBe('canceled');
    expect(attempts).toHaveLength(1);
  });
});

/**
 * Phase 2 Item 8 — the evented engine must honor the options callers hand it
 * (or fail loud when it can't run at all) instead of silently ignoring them:
 *
 * 1. `emitStepEvents: false` suppresses step-lifecycle watch events. The
 *    durable agent loop sets it for a measured perf reason (#21529 — engine
 *    step events repeatedly serialized cumulative conversation state); before
 *    this fix the evented runtime had zero references to the option, so the
 *    tuning was silently discarded when the engine flipped to evented.
 * 2. Run-level events (workflow-start / workflow-finish) and execution
 *    routing are never gated — only `workflow-step-*` watch events are.
 * 3. `createRun()` without a registered Mastra host throws a clear error at
 *    the call site instead of starting a run that hangs or fails deep inside
 *    the event processor.
 * 4. The evented-built durable agent loop carries `validateInputs: false` and
 *    `emitStepEvents: false` on both the outer loop and the nested iteration
 *    workflow (guards the builder → engine option plumbing).
 */

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { DurableStepIds } from '../../agent/durable/constants';
import { createDurableAgenticWorkflow } from '../../agent/durable/workflows/create-durable-agentic-workflow';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const looseObject = z.looseObject({});

function makeWorkflow(id: string, options?: { emitStepEvents?: boolean }) {
  const step1 = createStep({
    id: 'step1',
    execute: async () => ({ a: 1 }),
    inputSchema: looseObject,
    outputSchema: looseObject,
  });
  const step2 = createStep({
    id: 'step2',
    execute: async ({ inputData }) => ({ b: inputData.a }),
    inputSchema: looseObject,
    outputSchema: looseObject,
  });
  return createWorkflow({
    id,
    inputSchema: looseObject,
    outputSchema: looseObject,
    steps: [step1, step2],
    options,
  })
    .then(step1)
    .then(step2)
    .commit();
}

async function makeHost(workflow: ReturnType<typeof makeWorkflow>) {
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: { [workflow.id]: workflow as any },
    pubsub: new EventEmitterPubSub(),
  });
  await mastra.startWorkers();
  return mastra;
}

async function runAndCollectWatchEvents(workflow: ReturnType<typeof makeWorkflow>) {
  const mastra = await makeHost(workflow);
  try {
    const run = await workflow.createRun();
    const events: string[] = [];
    const unwatch = await run.watchAsync(event => {
      events.push(event.type);
    });

    const result = await run.start({ inputData: { value: 'go' } });
    expect(result.status).toBe('success');

    // workflow-finish is published around start() settling — wait for it so
    // the assertion below sees the complete event stream.
    await vi.waitFor(() => expect(events).toContain('workflow-finish'));
    await unwatch();
    return events;
  } finally {
    await mastra.stopWorkers();
  }
}

describe('evented engine option honoring (Phase 2 Item 8)', () => {
  it('emits step-lifecycle watch events by default', async () => {
    const events = await runAndCollectWatchEvents(makeWorkflow('step-events-default-wf'));

    expect(events).toContain('workflow-step-start');
    expect(events).toContain('workflow-step-result');
    expect(events).toContain('workflow-step-finish');
  });

  it('suppresses step-lifecycle watch events when emitStepEvents is false, without gating run-level events', async () => {
    const events = await runAndCollectWatchEvents(makeWorkflow('step-events-off-wf', { emitStepEvents: false }));

    expect(events.filter(type => type.startsWith('workflow-step-'))).toEqual([]);
    // Run-level events still flow — only step-lifecycle events are gated.
    expect(events).toContain('workflow-finish');
  });

  it('createRun() fails loud when no Mastra host is registered', async () => {
    const workflow = makeWorkflow('unhosted-wf');

    await expect(workflow.createRun()).rejects.toThrow(/evented execution engine, which requires a Mastra host/);
  });

  it('the evented-built durable agent loop carries validateInputs: false and emitStepEvents: false on both workflows', () => {
    const loop = createDurableAgenticWorkflow({ engine: 'evented' });

    expect(loop.options.validateInputs).toBe(false);
    expect(loop.options.emitStepEvents).toBe(false);

    // The dowhile produces { type: 'loop', step: { type: 'step', step: <iteration Workflow> } }.
    const iteration = ((loop as any).executionGraph.steps as any[])
      .map(entry => entry.step?.step)
      .find(step => step?.id === DurableStepIds.AGENTIC_EXECUTION);
    expect(iteration).toBeTruthy();
    expect(iteration.options.validateInputs).toBe(false);
    expect(iteration.options.emitStepEvents).toBe(false);
  });
});

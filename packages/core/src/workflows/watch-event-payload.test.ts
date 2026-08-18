import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Regression tests for watch-event payload amplification.
 *
 * Step lifecycle events on `workflow.events.v2.<runId>` used to spread the
 * step's *previous* result (`...stepResults[step.id]`) into the emitted
 * payload. On a loop (e.g. a durable agent's dountil), the previous
 * iteration's `output` is the next iteration's input, so every
 * `workflow-step-start` shipped the cumulative state twice — `output` and
 * `payload` were byte-identical, megabytes per event in production.
 *
 * Watch events must only carry fields describing the current transition:
 * a start event has the input (`payload` / `resumePayload`), a result event
 * has the fresh result. Prior-completion state stays in the run snapshot.
 */
describe('watch events: no prior-result amplification', () => {
  const collect = async (streamResult: { fullStream: AsyncIterable<any>; result: Promise<any> }) => {
    const events: any[] = [];
    for await (const event of streamResult.fullStream) {
      events.push(JSON.parse(JSON.stringify(event)));
    }
    const result = await streamResult.result;
    return { events, result };
  };

  const startEventsFor = (events: any[], id: string) =>
    events.filter(e => e.type === 'workflow-step-start' && e.payload?.id === id);
  const resultEventsFor = (events: any[], id: string) =>
    events.filter(e => e.type === 'workflow-step-result' && e.payload?.id === id);

  it('emits step lifecycle events by default', async () => {
    const echo = createStep({
      id: 'default-events-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });

    const workflow = createWorkflow({
      id: 'default-events-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(echo)
      .commit();

    const run = await workflow.createRun();
    const { events, result } = await collect(run.stream({ inputData: { value: 'hello' } }));

    expect(result.status).toBe('success');
    expect(events.map(event => event.type)).toEqual(
      expect.arrayContaining(['workflow-start', 'workflow-step-start', 'workflow-step-result', 'workflow-finish']),
    );
  });

  it('suppresses step lifecycle events when emitStepEvents is false', async () => {
    const echo = createStep({
      id: 'suppressed-events-step',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => inputData,
    });

    const workflow = createWorkflow({
      id: 'suppressed-events-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      options: { emitStepEvents: false },
    })
      .then(echo)
      .commit();

    const run = await workflow.createRun();
    const { events, result } = await collect(run.stream({ inputData: { value: 'hello' } }));

    expect(result.status).toBe('success');
    expect(events.map(event => event.type)).toEqual(['workflow-start', 'workflow-finish']);
  });

  it('emits a start event with input but no completion fields for a normal step', async () => {
    const echo = createStep({
      id: 'echo',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: async ({ inputData }) => ({ value: inputData.value }),
    });

    const workflow = createWorkflow({
      id: 'normal-step-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .then(echo)
      .commit();

    const run = await workflow.createRun();
    const { events, result } = await collect(run.stream({ inputData: { value: 'hello' } }));
    expect(result.status).toBe('success');

    const [start] = startEventsFor(events, 'echo');
    expect(start.payload.payload).toEqual({ value: 'hello' });
    expect(start.payload.status).toBe('running');
    expect(start.payload.startedAt).toBeDefined();
    expect(start.payload).not.toHaveProperty('output');
    expect(start.payload).not.toHaveProperty('error');
    expect(start.payload).not.toHaveProperty('endedAt');
    expect(start.payload).not.toHaveProperty('suspendPayload');
    expect(start.payload).not.toHaveProperty('suspendOutput');

    const [stepResult] = resultEventsFor(events, 'echo');
    expect(stepResult.payload.status).toBe('success');
    expect(stepResult.payload.output).toEqual({ value: 'hello' });
  });

  it('does not re-publish the previous iteration output on loop start events', async () => {
    const counter = createStep({
      id: 'counter',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
      execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
    });

    const workflow = createWorkflow({
      id: 'loop-workflow',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
    })
      .dountil(counter, async ({ inputData }) => inputData.n >= 3)
      .commit();

    const run = await workflow.createRun();
    const { events, result } = await collect(run.stream({ inputData: { n: 0 } }));
    expect(result.status).toBe('success');

    const starts = startEventsFor(events, 'counter');
    expect(starts.length).toBe(3);

    // Iterations 2+ previously spread the prior iteration's success result into
    // the start event, so `output` (previous state) duplicated `payload` (next
    // input). The start event must only carry the input once.
    for (const [i, start] of starts.entries()) {
      expect(start.payload.payload).toEqual({ n: i });
      expect(start.payload).not.toHaveProperty('output');
      expect(start.payload).not.toHaveProperty('endedAt');
    }

    const results = resultEventsFor(events, 'counter');
    expect(results.length).toBe(3);
    for (const [i, stepResult] of results.entries()) {
      expect(stepResult.payload.output).toEqual({ n: i + 1 });
    }
  });

  it('does not re-publish the previous iteration output for a nested workflow step in a loop', async () => {
    const inner = createStep({
      id: 'inner-step',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
      execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
    });

    const nested = createWorkflow({
      id: 'nested-workflow',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
    })
      .then(inner)
      .commit();

    const workflow = createWorkflow({
      id: 'nested-loop-workflow',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
    })
      .dountil(nested, async ({ inputData }) => inputData.n >= 2)
      .commit();

    const run = await workflow.createRun();
    const { events, result } = await collect(run.stream({ inputData: { n: 0 } }));
    expect(result.status).toBe('success');

    const starts = startEventsFor(events, 'nested-workflow');
    expect(starts.length).toBe(2);
    for (const start of starts) {
      expect(start.payload).not.toHaveProperty('output');
      expect(start.payload).not.toHaveProperty('endedAt');
    }
  });

  it('keeps suspendPayload on the suspended event but off resumed start and final result events', async () => {
    const gate = createStep({
      id: 'gate',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ question: 'proceed?' });
          return { approved: false };
        }
        return { approved: resumeData.approved };
      },
    });

    const workflow = createWorkflow({
      id: 'suspend-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ approved: z.boolean() }),
    })
      .then(gate)
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { 'suspend-workflow': workflow } });

    const run = await workflow.createRun();
    const { events: startEvents, result: startResult } = await collect(run.stream({ inputData: { value: 'go' } }));
    expect(startResult.status).toBe('suspended');

    const suspendedEvent = startEvents.find(e => e.type === 'workflow-step-suspended' && e.payload?.id === 'gate');
    expect(suspendedEvent.payload.suspendPayload).toMatchObject({ question: 'proceed?' });
    // The suspension is fresh, but there is no completed output to re-publish.
    expect(suspendedEvent.payload).not.toHaveProperty('output');

    const resumeRun = await workflow.createRun({ runId: run.runId });
    const { events: resumeEvents, result: resumeResult } = await collect(
      resumeRun.resumeStream({ step: 'gate', resumeData: { approved: true } }),
    );
    expect(resumeResult.status).toBe('success');

    const [resumedStart] = startEventsFor(resumeEvents, 'gate');
    expect(resumedStart.payload.resumePayload).toEqual({ approved: true });
    expect(resumedStart.payload.resumedAt).toBeDefined();
    // Original input survives the resume (it comes from the persisted result).
    expect(resumedStart.payload.payload).toEqual({ value: 'go' });
    // The prior suspension's state must not be re-published on the new start.
    expect(resumedStart.payload).not.toHaveProperty('suspendPayload');
    expect(resumedStart.payload).not.toHaveProperty('suspendOutput');
    expect(resumedStart.payload).not.toHaveProperty('output');

    const [finalResult] = resultEventsFor(resumeEvents, 'gate');
    expect(finalResult.payload.status).toBe('success');
    expect(finalResult.payload.output).toEqual({ approved: true });
    expect(finalResult.payload).not.toHaveProperty('suspendPayload');
  });

  it('does not attach a stale prior output to a failed result event', async () => {
    const flaky = createStep({
      id: 'flaky',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
      execute: async ({ inputData }) => {
        if (inputData.n >= 1) {
          throw new Error('boom');
        }
        return { n: inputData.n + 1 };
      },
    });

    const workflow = createWorkflow({
      id: 'failing-loop-workflow',
      inputSchema: z.object({ n: z.number() }),
      outputSchema: z.object({ n: z.number() }),
    })
      .dountil(flaky, async ({ inputData }) => inputData.n >= 3)
      .commit();

    const run = await workflow.createRun();
    const { events, result } = await collect(run.stream({ inputData: { n: 0 } }));
    expect(result.status).toBe('failed');

    const results = resultEventsFor(events, 'flaky');
    const failed = results.find(e => e.payload.status === 'failed');
    expect(failed.payload.error).toBeDefined();
    // Iteration 1 succeeded with output {n:1}; the iteration-2 failure event
    // must not re-publish it.
    expect(failed.payload).not.toHaveProperty('output');

    // The iteration-2 start event must not carry iteration 1's output either.
    const starts = startEventsFor(events, 'flaky');
    expect(starts.length).toBe(2);
    expect(starts[1].payload.payload).toEqual({ n: 1 });
    expect(starts[1].payload).not.toHaveProperty('output');
  });

  it('emits a clean foreach start event on resume (no accumulated iteration state)', async () => {
    const approval = createStep({
      id: 'approval',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ name: z.string(), approved: z.boolean() }),
      suspendSchema: z.object({ waitingFor: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (inputData.name === 'beta' && !resumeData) {
          await suspend({ waitingFor: inputData.name });
          return { name: inputData.name, approved: false };
        }
        return { name: inputData.name, approved: resumeData?.approved ?? true };
      },
    });

    const workflow = createWorkflow({
      id: 'foreach-workflow',
      inputSchema: z.array(z.object({ name: z.string() })),
      outputSchema: z.array(z.object({ name: z.string(), approved: z.boolean() })),
    })
      .foreach(approval)
      .commit();

    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { 'foreach-workflow': workflow } });

    const run = await workflow.createRun();
    const { result: startResult } = await collect(run.stream({ inputData: [{ name: 'alpha' }, { name: 'beta' }] }));
    expect(startResult.status).toBe('suspended');

    const resumeRun = await workflow.createRun({ runId: run.runId });
    const { events: resumeEvents, result: resumeResult } = await collect(
      resumeRun.resumeStream({ step: 'approval', resumeData: { approved: true } }),
    );
    expect(resumeResult.status).toBe('success');

    // The foreach re-emits a start event on resume. It used to spread the
    // suspended step result, dragging in the prior suspendPayload (which holds
    // every completed iteration's output under __workflow_meta.foreachOutput).
    const [start] = startEventsFor(resumeEvents, 'approval');
    expect(start.payload).not.toHaveProperty('output');
    expect(start.payload).not.toHaveProperty('suspendPayload');
    expect(start.payload).not.toHaveProperty('suspendOutput');
  });
});

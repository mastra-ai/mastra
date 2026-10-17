import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import type { Workflow } from '../..';
import type { PubSub } from '../../../events';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { WorkflowEventProcessor } from './index';

/**
 * Models any real broker (Redis Streams, Valkey, GCP Pub/Sub): events are JSON
 * round-tripped on publish, so functions (e.g. a loop `condition`) are dropped
 * from the payload. `EventEmitterPubSub` passes objects by reference and hides
 * this class of bug. See https://github.com/mastra-ai/mastra/issues/23111.
 */
class SerializingPubSub extends EventEmitterPubSub {
  async publish(topic: string, event: any) {
    return super.publish(topic, JSON.parse(JSON.stringify(event)));
  }
}

async function runWorkflow(
  entry: Workflow,
  workflows: Record<string, Workflow>,
  pubsub: PubSub = new SerializingPubSub(),
) {
  const mastra = new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows,
    pubsub,
  });
  await mastra.startWorkers();
  try {
    const run = await entry.createRun();
    const stream = run.stream({ inputData: {} });
    for await (const _chunk of stream.fullStream) {
      // drain
    }
    return await stream.result;
  } finally {
    await mastra.stopWorkers();
  }
}

function createInnerWorkflow(execute: () => Promise<any>) {
  return createWorkflow({ id: 'inner_stage', inputSchema: z.any(), outputSchema: z.any() })
    .then(createStep({ id: 'inner_step', inputSchema: z.any(), outputSchema: z.any(), execute }))
    .commit();
}

describe('evented workflows over a serializing pubsub', () => {
  it.each([false, true])('preserves state written by a bailing step (nested: %s)', async nested => {
    const workflow = createWorkflow({
      id: 'bail_state',
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      stateSchema: z.object({ text: z.string().default('') }),
    })
      .then(
        createStep({
          id: 'write_and_bail',
          inputSchema: z.object({}),
          outputSchema: z.object({ done: z.boolean() }),
          stateSchema: z.object({ text: z.string().default('') }),
          execute: async ({ setState, bail }) => {
            await setState({ text: 'partial response' });
            return bail({ done: true });
          },
        }),
      )
      .commit();

    const pubsub = new SerializingPubSub();
    const publish = vi.spyOn(pubsub, 'publish');
    const parent = createWorkflow({
      id: 'bail_parent',
      inputSchema: z.object({}),
      outputSchema: z.object({ text: z.string() }),
      stateSchema: z.object({ text: z.string().default('') }),
    })
      .dowhile(workflow, async ({ inputData }) => !inputData.done)
      .then(
        createStep({
          id: 'read_bailed_state',
          inputSchema: z.object({ done: z.boolean() }),
          outputSchema: z.object({ text: z.string() }),
          stateSchema: z.object({ text: z.string().default('') }),
          execute: async ({ state }) => ({ text: state.text }),
        }),
      )
      .commit();
    const result = await runWorkflow(nested ? parent : workflow, { bail_state: workflow, bail_parent: parent }, pubsub);
    expect(result.status).toBe('success');
    if (nested) {
      expect(result.status === 'success' && result.result).toEqual({ text: 'partial response' });
    } else {
      const finish = publish.mock.calls.find(([topic]) => topic === 'workflows-finish')?.[1];
      expect(finish?.data.state).toEqual({ text: 'partial response' });
    }
    expect(publish.mock.calls.some(([, event]) => event.type === 'workflow.cancel')).toBe(false);
  });

  it('dountil over a nested workflow evaluates the loop condition', async () => {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.done === true)
      .commit();

    const result = await runWorkflow(outer, { outer_loop: outer, inner_stage: inner });

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ done: true });
  });

  it('dountil over a nested workflow loops until the condition is met', async () => {
    let count = 0;
    const execute = vi.fn(async () => ({ count: ++count }));
    const inner = createInnerWorkflow(execute);
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.count >= 2)
      .commit();

    const result = await runWorkflow(outer, { outer_loop: outer, inner_stage: inner });

    expect(result.status).toBe('success');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(result.status === 'success' && result.result).toEqual({ count: 2 });
  });

  it('dowhile over a nested workflow evaluates the loop condition', async () => {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dowhile(inner, async ({ inputData }) => inputData?.done !== true)
      .commit();

    const result = await runWorkflow(outer, { outer_loop: outer, inner_stage: inner });

    expect(result.status).toBe('success');
  });

  it('dountil over a nested workflow works when the loop-owning workflow is itself nested', async () => {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.done === true)
      .commit();
    const root = createWorkflow({ id: 'root', inputSchema: z.any(), outputSchema: z.any() }).then(outer).commit();

    const result = await runWorkflow(root, { root, outer_loop: outer, inner_stage: inner });

    expect(result.status).toBe('success');
  });

  // Control: the same workflow on the by-reference pubsub must keep working —
  // guards against the live-registry resolution regressing the in-memory path.
  it('dountil over a nested workflow still works on the plain EventEmitterPubSub', async () => {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.done === true)
      .commit();

    const result = await runWorkflow(outer, { outer_loop: outer, inner_stage: inner }, new EventEmitterPubSub());

    expect(result.status).toBe('success');
  });
});

describe('workflows-finish payloads (#27245)', () => {
  function finishEvents(publish: { mock: { calls: any[][] } }) {
    return publish.mock.calls.filter(([topic]) => topic === 'workflows-finish').map(([, event]) => event);
  }

  function buildNestedWorkflows(execute: () => Promise<any>) {
    const inner = createInnerWorkflow(execute);
    const mid = createWorkflow({ id: 'mid_stage', inputSchema: z.any(), outputSchema: z.any() }).then(inner).commit();
    const root = createWorkflow({
      id: 'finish_root',
      inputSchema: z.any(),
      outputSchema: z.any(),
      stateSchema: z.object({ marker: z.string().default('') }),
    })
      .then(
        createStep({
          id: 'big_step',
          inputSchema: z.any(),
          outputSchema: z.any(),
          stateSchema: z.object({ marker: z.string().default('') }),
          execute: async ({ setState }) => {
            await setState({ marker: 'set' });
            return { blob: 'x'.repeat(10_000) };
          },
        }),
      )
      .then(mid)
      .commit();
    return { root, workflows: { finish_root: root, mid_stage: mid, inner_stage: inner } };
  }

  it('nested runs publish finish events without step history, top-level keeps what the waiter reads', async () => {
    const { root, workflows } = buildNestedWorkflows(async () => ({ done: true }));
    const pubsub = new SerializingPubSub();
    const publish = vi.spyOn(pubsub, 'publish');

    const result = await runWorkflow(root, workflows, pubsub);

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ done: true });
    expect(result.steps.big_step).toMatchObject({ status: 'success', output: { blob: 'x'.repeat(10_000) } });
    expect(result.steps.mid_stage).toMatchObject({ status: 'success', output: { done: true } });
    const events = finishEvents(publish);
    const top = events.find(e => e.data.workflowId === 'finish_root');
    const mid = events.find(e => e.data.workflowId === 'mid_stage');
    const inner = events.find(e => e.data.workflowId === 'inner_stage');

    expect(top?.type).toBe('workflow.end');
    expect(top?.data.parentWorkflow).toBeUndefined();
    expect(top?.data.stepResults.big_step.output.blob).toHaveLength(10_000);
    expect(top?.data.state).toEqual({ marker: 'set' });

    for (const nested of [mid, inner]) {
      expect(nested?.type).toBe('workflow.end');
      expect(nested?.data.stepResults).toBeUndefined();
      expect(nested?.data.state).toBeUndefined();
      expect(nested?.data.prevResult.status).toBe('success');
      expect(JSON.stringify(nested?.data)).not.toContain('x'.repeat(100));
    }

    // The ancestor chain is kept as bare identities so the pubsub proxy can
    // still route nested finish events of internal workflows as localOnly.
    expect(inner?.data.parentWorkflow).toEqual({
      workflowId: 'mid_stage',
      runId: mid?.runId,
      parentWorkflow: { workflowId: 'finish_root', runId: top?.runId },
    });
  });

  it('nested failures publish slim finish events and the top-level run still reports the error', async () => {
    const { root, workflows } = buildNestedWorkflows(async () => {
      throw new Error('inner boom');
    });
    const pubsub = new SerializingPubSub();
    const publish = vi.spyOn(pubsub, 'publish');

    const result = await runWorkflow(root, workflows, pubsub);

    expect(result.status).toBe('failed');
    expect(result.status === 'failed' && String((result.error as Error)?.message ?? result.error)).toContain(
      'inner boom',
    );
    expect(result.steps.big_step).toMatchObject({ status: 'success' });

    const events = finishEvents(publish);
    const top = events.find(e => e.data.workflowId === 'finish_root');
    const inner = events.find(e => e.data.workflowId === 'inner_stage');
    expect(top?.type).toBe('workflow.fail');
    expect(top?.data.stepResults.big_step.status).toBe('success');
    expect(inner?.type).toBe('workflow.fail');
    expect(inner?.data.stepResults).toBeUndefined();
    expect(inner?.data.parentWorkflow?.stepResults).toBeUndefined();
  });
});

class TestWorkflowEventProcessor extends WorkflowEventProcessor {
  callProcessWorkflowEnd(args: any) {
    return this.processWorkflowEnd(args);
  }
}

/**
 * Drives `processWorkflowEnd` directly with a crafted, JSON-round-tripped
 * `workflow.end` payload whose grandparent descriptor cannot be traversed —
 * either because the descriptor disagrees with the live graph (null miss) or
 * because the ancestor chain root isn't registered at all (throwing miss). In
 * both cases the publicly registered loop owner must still be resolved by id —
 * the same lookup the 2-level case uses — so the loop condition evaluates
 * instead of crashing on the function-stripped payload copy.
 */
describe('processWorkflowEnd public-registry fallback on grandparent-descent miss', () => {
  async function processEndWithGrandparent(grandparent: Record<string, any>) {
    const inner = createInnerWorkflow(async () => ({ done: true }));
    const outer = createWorkflow({ id: 'outer_loop', inputSchema: z.any(), outputSchema: z.any() })
      .dountil(inner, async ({ inputData }) => inputData?.done === true)
      .commit();
    const root = createWorkflow({ id: 'root', inputSchema: z.any(), outputSchema: z.any() })
      .then(createStep({ id: 'plain', inputSchema: z.any(), outputSchema: z.any(), execute: async () => ({}) }))
      .commit();

    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { root, outer_loop: outer, inner_stage: inner },
      pubsub,
    });
    const processor = new TestWorkflowEventProcessor({ mastra });

    const events: Event[] = [];
    await pubsub.subscribe('workflows', async event => {
      events.push(event);
    });

    const args = JSON.parse(
      JSON.stringify({
        workflowId: 'inner_stage',
        runId: 'inner-run',
        executionPath: [0],
        resumeSteps: [],
        stepResults: {},
        activeStepsPath: {},
        requestContext: {},
        prevResult: { status: 'success', output: { done: true } },
        parentWorkflow: {
          workflowId: 'outer_loop',
          runId: 'outer-run',
          executionPath: [0],
          resume: false,
          stepResults: {},
          parentWorkflow: grandparent,
          stepId: 'inner_stage',
          stepGraph: outer.stepGraph,
          activeStepsPath: {},
          resumeSteps: [],
          resumeData: undefined,
          input: {},
        },
      }),
    );
    // The wire copy provably lost the loop condition — resolution must go live.
    expect(args.parentWorkflow.stepGraph[0].type).toBe('loop');
    expect(args.parentWorkflow.stepGraph[0].condition).toBeUndefined();

    try {
      await processor.callProcessWorkflowEnd(args);
    } finally {
      await mastra.shutdown();
    }
    return events;
  }

  const grandparentBase = {
    runId: 'root-run',
    resume: false,
    stepResults: {},
    stepId: 'outer_loop',
    stepGraph: [],
    activeStepsPath: {},
    resumeSteps: [],
    resumeData: undefined,
    input: {},
  };

  it('resolves the loop owner by id when the descriptor path mismatches the live graph', async () => {
    // `root` is registered, but the executionPath doesn't land on a workflow
    // entry → getNestedWorkflow returns null.
    const events = await processEndWithGrandparent({ ...grandparentBase, workflowId: 'root', executionPath: [7] });

    const stepEnd = events.find(event => event.type === 'workflow.step.end');
    expect(stepEnd?.data?.workflowId).toBe('outer_loop');
    expect(stepEnd?.runId).toBe('outer-run');
  });

  it('resolves the loop owner by id when the ancestor chain root is unregistered', async () => {
    // `ghost_root` is in no registry → getNestedWorkflow throws.
    const events = await processEndWithGrandparent({
      ...grandparentBase,
      workflowId: 'ghost_root',
      executionPath: [0],
    });

    const stepEnd = events.find(event => event.type === 'workflow.step.end');
    expect(stepEnd?.data?.workflowId).toBe('outer_loop');
    expect(stepEnd?.runId).toBe('outer-run');
  });
});

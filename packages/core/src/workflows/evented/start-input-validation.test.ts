import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '.';

/**
 * #29424: evented `start()` and `startAsync()` replaced omitted or null `inputData` with `{}`
 * before validating it against the workflow `inputSchema`. A top-level schema default never
 * applied, and a nullable schema rejected an explicit `null`. The shared workflow suite covers
 * `start()`/`stream()` on every engine; this file covers the evented `startAsync()` dispatch path,
 * which publishes `workflow.start` and returns before the run finishes.
 */

const SETTLE_TIMEOUT_MS = 5_000;

type Observed = { inputData: unknown; initData: unknown };

function buildWorkflow(id: string, schema: z.ZodType) {
  const observed: Observed[] = [];
  const step = createStep({
    id: 'observe',
    inputSchema: schema,
    outputSchema: z.object({ received: schema }),
    execute: async ({ inputData, getInitData }) => {
      observed.push({ inputData, initData: getInitData() });
      return { received: inputData };
    },
  });
  const workflow = createWorkflow({
    id,
    inputSchema: schema,
    outputSchema: z.object({ received: schema }),
  })
    .then(step)
    .commit();
  return { workflow, observed };
}

const cleanups: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

async function startHost(workflow: ReturnType<typeof buildWorkflow>['workflow']) {
  const storage = new InMemoryStore();
  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub: new EventEmitterPubSub(),
    workflows: { [workflow.id]: workflow },
  });
  cleanups.push(() => mastra.stopWorkers());
  await mastra.startWorkers();
  return storage;
}

/** Dispatches with startAsync, waits for the run to finish, and returns its persisted snapshot. */
async function runViaStartAsync(workflow: ReturnType<typeof buildWorkflow>['workflow'], inputData: unknown) {
  const storage = await startHost(workflow);
  const run = await workflow.createRun();

  let markFinished!: (status: string) => void;
  const finished = new Promise<string>(resolve => (markFinished = resolve));
  const unwatch = run.watch(event => {
    if (event.type === 'workflow-finish') markFinished(event.payload.workflowStatus);
  });
  cleanups.push(async () => unwatch());

  await run.startAsync({ inputData });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const status = await Promise.race([
    finished,
    new Promise<string>(resolve => (timer = setTimeout(() => resolve('timed out'), SETTLE_TIMEOUT_MS))),
  ]).finally(() => clearTimeout(timer));

  const workflowsStore = await storage.getStore('workflows');
  const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
  return { status, snapshot };
}

describe('evented startAsync passes the caller input to inputSchema (#29424)', () => {
  it('applies a top-level object default when inputData is omitted', async () => {
    const { workflow, observed } = buildWorkflow(
      'start-async-object-default',
      z.object({ count: z.number() }).default({ count: 5 }),
    );

    const { status, snapshot } = await runViaStartAsync(workflow, undefined);

    expect(status).toBe('success');
    expect(observed).toEqual([{ inputData: { count: 5 }, initData: { count: 5 } }]);
    expect(snapshot?.status).toBe('success');
    expect(snapshot?.context.input).toEqual({ count: 5 });
    expect(snapshot?.context.observe).toMatchObject({ status: 'success', output: { received: { count: 5 } } });
  });

  it('applies a scalar default when inputData is omitted', async () => {
    const { workflow, observed } = buildWorkflow('start-async-scalar-default', z.number().default(7));

    const { status, snapshot } = await runViaStartAsync(workflow, undefined);

    expect(status).toBe('success');
    expect(observed).toEqual([{ inputData: 7, initData: 7 }]);
    expect(snapshot?.status).toBe('success');
    expect(snapshot?.context.observe).toMatchObject({ status: 'success', output: { received: 7 } });
  });

  it('accepts explicit null for a nullable inputSchema', async () => {
    const { workflow, observed } = buildWorkflow('start-async-nullable', z.string().nullable());

    const { status, snapshot } = await runViaStartAsync(workflow, null);

    expect(status).toBe('success');
    expect(observed).toEqual([{ inputData: null, initData: null }]);
    expect(snapshot?.status).toBe('success');
    expect(snapshot?.context.observe).toMatchObject({ status: 'success', output: { received: null } });
  });

  it('still rejects omitted inputData when the inputSchema has no default', async () => {
    const { workflow, observed } = buildWorkflow('start-async-required', z.object({ count: z.number() }));
    await startHost(workflow);
    const run = await workflow.createRun();

    await expect(run.startAsync({})).rejects.toThrow('Invalid input data');
    expect(observed).toEqual([]);
  });
});

describe('evented start() with no inputData key (#29424)', () => {
  it('applies the inputSchema default for run.start({})', async () => {
    const { workflow, observed } = buildWorkflow(
      'start-object-default',
      z.object({ count: z.number() }).default({ count: 5 }),
    );
    await startHost(workflow);
    const run = await workflow.createRun();

    const result = await run.start({});

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({ received: { count: 5 } });
    expect(observed).toEqual([{ inputData: { count: 5 }, initData: { count: 5 } }]);
  });
});

describe('evented stream() passes the caller input to inputSchema (#29424)', () => {
  async function drain(output: { fullStream: AsyncIterable<unknown> }) {
    for await (const _event of output.fullStream) {
      // consume the stream so the run finishes
    }
  }

  it('applies the inputSchema default when inputData is omitted', async () => {
    const { workflow, observed } = buildWorkflow(
      'stream-object-default',
      z.object({ count: z.number() }).default({ count: 5 }),
    );
    await startHost(workflow);
    const run = await workflow.createRun();

    const output = run.stream({});
    await drain(output);

    expect((await output.result).status).toBe('success');
    expect(observed).toEqual([{ inputData: { count: 5 }, initData: { count: 5 } }]);
  });

  it('passes explicit null to a nullable inputSchema', async () => {
    const { workflow, observed } = buildWorkflow('stream-nullable', z.string().nullable());
    await startHost(workflow);
    const run = await workflow.createRun();

    const output = run.stream({ inputData: null });
    await drain(output);

    expect((await output.result).status).toBe('success');
    expect(observed).toEqual([{ inputData: null, initData: null }]);
  });
});

describe('evented resume feeds the first step the input it started with (#29424)', () => {
  it.each([
    {
      label: 'explicit null with a nullable inputSchema',
      id: 'resume-nullable-input',
      schema: z.string().nullable(),
      start: { inputData: null },
    },
    {
      label: 'omitted input with an optional inputSchema',
      id: 'resume-omitted-input',
      schema: z.string().optional(),
      start: {},
    },
  ])(
    '$label',
    async ({ id, schema, start }) => {
      const expectedInput = 'inputData' in start ? start.inputData : undefined;
      const executions: Array<{ inputData: unknown; resumeData: unknown }> = [];
      const step = createStep({
        id: 'approve',
        inputSchema: schema,
        outputSchema: z.object({ received: schema }),
        resumeSchema: z.object({ approved: z.boolean() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          executions.push({ inputData, resumeData });
          if (!resumeData) return suspend({});
          return { received: inputData };
        },
      });
      const workflow = createWorkflow({
        id,
        inputSchema: schema,
        outputSchema: z.object({ received: schema }),
      })
        .then(step)
        .commit();
      const storage = await startHost(workflow);
      const run = await workflow.createRun();

      const started = await run.start(start);
      expect(started.status).toBe('suspended');

      const workflowsStore = await storage.getStore('workflows');
      const suspendedSnapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: run.runId,
      });
      expect(suspendedSnapshot?.context.approve?.status).toBe('suspended');
      expect(suspendedSnapshot?.context.approve?.payload).toBe(expectedInput);

      const resumed = await run.resume({ step: 'approve', resumeData: { approved: true } });

      expect(resumed.status).toBe('success');
      expect(resumed.status === 'success' && resumed.result).toStrictEqual({ received: expectedInput });
      expect(executions).toStrictEqual([
        { inputData: expectedInput, resumeData: undefined },
        { inputData: expectedInput, resumeData: { approved: true } },
      ]);
    },
    15_000,
  );
});

describe('evented run with an explicit null input reports step failures (#29424)', () => {
  it('returns a failed result when the first step throws', async () => {
    const step = createStep({
      id: 'boom',
      inputSchema: z.string().nullable(),
      outputSchema: z.object({ received: z.string().nullable() }),
      execute: async () => {
        throw new Error('step exploded');
      },
    });
    const workflow = createWorkflow({
      id: 'fail-nullable-input',
      inputSchema: z.string().nullable(),
      outputSchema: z.object({ received: z.string().nullable() }),
    })
      .then(step)
      .commit();
    await startHost(workflow);
    const run = await workflow.createRun();

    const result = await run.start({ inputData: null });

    expect(result.status).toBe('failed');
    expect(result.status === 'failed' && result.error.message).toBe('step exploded');
  }, 15_000);
});

describe('evented nested resume feeds the suspended step its own stored input (#29424)', () => {
  it('resumes a nested step whose input was null, not the nested workflow input', async () => {
    const resumedInputs: unknown[] = [];
    const produceNull = createStep({
      id: 'produce-null',
      inputSchema: z.string(),
      outputSchema: z.string().nullable(),
      execute: async () => null,
    });
    const approve = createStep({
      id: 'approve',
      inputSchema: z.string().nullable(),
      outputSchema: z.object({ received: z.string().nullable() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) return suspend({});
        resumedInputs.push(inputData);
        return { received: inputData };
      },
    });
    const child = createWorkflow({
      id: 'nested-null-child',
      inputSchema: z.string(),
      outputSchema: z.object({ received: z.string().nullable() }),
    })
      .then(produceNull)
      .then(approve)
      .commit();
    const parent = createWorkflow({
      id: 'nested-null-parent',
      inputSchema: z.string(),
      outputSchema: z.object({ received: z.string().nullable() }),
    })
      .then(child)
      .commit();
    await startHost(parent);
    const run = await parent.createRun();

    const started = await run.start({ inputData: 'seed' });
    expect(started.status).toBe('suspended');

    const resumed = await run.resume({ step: [child, approve], resumeData: { approved: true } });

    expect(resumed.status).toBe('success');
    expect(resumedInputs).toEqual([null]);
    expect(resumed.status === 'success' && resumed.result).toEqual({ received: null });
  }, 15_000);
});

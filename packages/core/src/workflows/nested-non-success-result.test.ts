import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep, Run } from './workflow';

// Regression coverage for the nested-run miscast: Workflow.execute() used to
// return `undefined` for every non-success nested run result (canceled,
// suspended with no propagatable step, paused, bailed-on-reread). The parent
// engine then recorded the step as { status: 'success', output: undefined },
// and consumers dereferencing the output — the agentic dowhile's
// `typedInputData.messages` — crashed inside consumeStream, leaving the turn a
// silent zombie with no terminal event and isRunning stuck.
// The fix makes execute() throw a MastraError naming the real nested status so
// the parent records a truthful step failure.
describe('nested workflow non-success resolution', () => {
  // Captured before any spy installs: vi.spyOn on an already-spied prototype
  // re-wraps the same descriptor, so capturing inside each test would chain the
  // mock back into itself and recurse. A single spy with a mutable stub holder
  // also keeps behavior truthful if a wrapper ever outlives its test — with no
  // stub armed every call falls through to the real implementation.
  const realStart = Run.prototype.start;
  let stubbed: { workflowId: string; result: unknown } | null = null;

  beforeEach(() => {
    vi.spyOn(Run.prototype, 'start').mockImplementation(function (this: Run<any, any, any, any, any>, args: any) {
      if (stubbed && this.workflowId === stubbed.workflowId) {
        return Promise.resolve(stubbed.result as any);
      }
      return realStart.call(this, args);
    });
  });

  afterEach(() => {
    stubbed = null;
    vi.restoreAllMocks();
  });

  const noopStep = (id: string, execute = vi.fn().mockResolvedValue({})) =>
    createStep({
      id,
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute,
    });

  function stubNestedRunResult(workflowId: string, result: unknown) {
    stubbed = { workflowId, result };
  }

  function buildParent(nested: ReturnType<typeof createWorkflow>, afterStep: ReturnType<typeof noopStep>) {
    return createWorkflow({
      id: 'parent-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(nested as any)
      .then(afterStep as any)
      .commit();
  }

  it.each(['canceled', 'suspended'] as const)(
    'fails the step truthfully when the nested run resolves %s',
    async status => {
      const afterExecute = vi.fn().mockResolvedValue({});
      const nested = createWorkflow({
        id: 'nested-workflow',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        options: { validateInputs: false },
      })
        .then(noopStep('nested-step'))
        .commit();
      const parent = buildParent(nested, noopStep('after-nested', afterExecute));

      new Mastra({ logger: false, workflows: { 'parent-workflow': parent, 'nested-workflow': nested } });
      stubNestedRunResult('nested-workflow', { status, steps: {} });

      const run = await parent.createRun();
      const result = await run.start({ inputData: {} });

      expect(result.status).toBe('failed');
      const nestedStepResult = result.steps['nested-workflow'];
      // The miscast recorded { status: 'success', output: undefined } here.
      expect(nestedStepResult?.status).toBe('failed');
      expect((nestedStepResult as { error?: { message?: string } })?.error?.message).toContain(`status '${status}'`);
      expect((nestedStepResult as { error?: { message?: string } })?.error?.message).toContain(
        'cannot produce step output',
      );
      expect(afterExecute).not.toHaveBeenCalled();
    },
  );

  it('fails truthfully when a canceled nested run carries earlier suspended steps', async () => {
    // A canceled run can retain a suspended step record; the suspended
    // early-return must not swallow a non-'suspended' run status — the step
    // must fail, not sit suspended on a child that can never resume.
    const afterExecute = vi.fn().mockResolvedValue({});
    const nested = createWorkflow({
      id: 'nested-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(noopStep('nested-step'))
      .commit();
    const parent = buildParent(nested, noopStep('after-nested', afterExecute));

    new Mastra({ logger: false, workflows: { 'parent-workflow': parent, 'nested-workflow': nested } });
    stubNestedRunResult('nested-workflow', {
      status: 'canceled',
      steps: { 'nested-step': { status: 'suspended' } },
    });

    const run = await parent.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('failed');
    expect(result.steps['nested-workflow']?.status).toBe('failed');
    expect((result.steps['nested-workflow'] as { error?: { message?: string } })?.error?.message).toContain(
      `status 'canceled'`,
    );
    expect(afterExecute).not.toHaveBeenCalled();
  });

  it('reports canceled when a loop condition aborts before throwing', async () => {
    const nested = createWorkflow({
      id: 'nested-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(noopStep('nested-step'))
      .commit();
    const parent = createWorkflow({
      id: 'parent-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .dowhile(nested as any, async ({ abort }: { abort: () => void }) => {
        abort();
        throw new Error('threw after abort');
      })
      .commit();

    new Mastra({ logger: false, workflows: { 'parent-workflow': parent, 'nested-workflow': nested } });

    const run = await parent.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('canceled');
  });

  it('propagates a per-step paused nested run instead of failing it', async () => {
    const nestedStep2 = vi.fn().mockResolvedValue({ done: true });
    const nested = createWorkflow({
      id: 'nested-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ done: z.boolean() }),
      options: { validateInputs: false },
    })
      .then(noopStep('nested-step-1'))
      .then(
        createStep({
          id: 'nested-step-2',
          inputSchema: z.object({}),
          outputSchema: z.object({ done: z.boolean() }),
          execute: nestedStep2,
        }),
      )
      .commit();
    const parent = buildParent(nested, noopStep('after-nested'));

    new Mastra({ logger: false, workflows: { 'parent-workflow': parent, 'nested-workflow': nested } });

    const run = await parent.createRun();
    const result = await run.start({ inputData: {}, perStep: true });

    // The nested run pauses after its first step; the handler marks the
    // parent step paused (nestedWflowStepPaused) rather than failing it.
    expect(result.status).toBe('paused');
    expect(result.steps['nested-workflow']?.status).toBe('paused');
    expect(nestedStep2).not.toHaveBeenCalled();
  });

  it('surfaces a dowhile condition throw as a truthful run failure', async () => {
    const storage = new MockStore();
    const iterationError = new Error('malformed iteration output');
    const nested = createWorkflow({
      id: 'nested-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .then(noopStep('nested-step'))
      .commit();
    const parent = createWorkflow({
      id: 'parent-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      options: { validateInputs: false },
    })
      .dowhile(nested as any, async () => {
        throw iterationError;
      })
      .commit();

    new Mastra({
      logger: false,
      storage,
      workflows: { 'parent-workflow': parent, 'nested-workflow': nested },
    });

    const run = await parent.createRun();
    // A condition throw becomes a normal step failure: the run resolves
    // 'failed' carrying the real error instead of rejecting while the
    // durable snapshot stays 'running' — the silent-zombie signature.
    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('failed');
    expect((result as { error?: { message?: string } }).error?.message).toContain('malformed iteration output');
    expect(result.steps['nested-workflow']?.status).toBe('failed');

    // …and the durable snapshot records the failure instead of a stuck
    // 'running' row that reads as a silent zombie.
    const store = await storage.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({ workflowName: 'parent-workflow', runId: run.runId });
    expect(snapshot?.status).toBe('failed');
  });

  it('still returns the nested output on success', async () => {
    const nestedOutput = { nested: 'result' };
    const afterExecute = vi.fn().mockImplementation(({ inputData }: { inputData: unknown }) => inputData);
    const nested = createWorkflow({
      id: 'nested-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ nested: z.string() }),
      options: { validateInputs: false },
    })
      .then(
        createStep({
          id: 'nested-step',
          inputSchema: z.object({}),
          outputSchema: z.object({ nested: z.string() }),
          execute: async () => nestedOutput,
        }),
      )
      .commit();
    const parent = buildParent(nested, noopStep('after-nested', afterExecute));

    new Mastra({ logger: false, workflows: { 'parent-workflow': parent, 'nested-workflow': nested } });

    const run = await parent.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    expect(result.steps['nested-workflow']).toMatchObject({ status: 'success', output: nestedOutput });
    expect(afterExecute).toHaveBeenCalledOnce();
  });
});

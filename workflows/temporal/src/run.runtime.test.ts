import { createStep } from '@mastra/core/workflows';
import type { Client } from '@temporalio/client';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createWorkflow } from './workflow';

const proxyActivities = vi.fn();

vi.mock('@temporalio/workflow', () => ({
  executeChild: vi.fn(),
  proxyActivities,
  sleep: vi.fn(async () => {}),
  log: { info: vi.fn() },
}));

const schema = z.object({ value: z.number() });

async function createRun(workerResult: (args: Record<string, unknown>) => Promise<unknown>) {
  const onFinish = vi.fn();
  const start = vi.fn(async (_type: string, options: { args: [Record<string, unknown>] }) => ({
    result: () => workerResult(options.args[0]),
  }));
  const step = createStep({ id: 'increment', inputSchema: schema, outputSchema: schema, execute: vi.fn() });
  const workflow = createWorkflow(
    { id: 'runtime-workflow', inputSchema: schema, outputSchema: schema, options: { onFinish } },
    { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
  )
    .then(step)
    .commit();
  const run = await workflow.createRun({ runId: 'run-1' });
  return { run, onFinish };
}

async function runOnWorkerRuntime(args: Record<string, unknown>) {
  proxyActivities.mockReturnValue({
    increment: vi.fn(async ({ inputData }: { inputData: { value: number } }) => ({ value: inputData.value + 1 })),
  });
  const runtime = await import('./transforms/temporal-workflow-runtime.mjs');
  return runtime.createWorkflow('runtime-workflow').then('increment').commit()(args);
}

const incrementStep = {
  status: 'success',
  payload: { value: 1 },
  output: { value: 2 },
  startedAt: expect.any(Number),
  endedAt: expect.any(Number),
};

describe('TemporalRun with the generated worker runtime', () => {
  it('returns core step results from start() and passes them to onFinish', async () => {
    const { run, onFinish } = await createRun(runOnWorkerRuntime);

    const result = await run.start({ inputData: { value: 1 } });

    expect(result).toMatchObject({ status: 'success', result: { value: 2 }, steps: { increment: incrementStep } });
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ steps: { increment: incrementStep } }));
    expect((onFinish.mock.calls[0] as any)[0].steps.increment.output).toEqual({ value: 2 });
  });

  it('passes core step results to onFinish after startAsync()', async () => {
    const { run, onFinish } = await createRun(runOnWorkerRuntime);

    await run.startAsync({ inputData: { value: 1 } });

    await vi.waitFor(() => expect(onFinish).toHaveBeenCalledOnce());
    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', result: { value: 2 }, steps: { increment: incrementStep } }),
    );
  });

  it('wraps raw step outputs returned by workers built before step results were recorded', async () => {
    const { run, onFinish } = await createRun(async args => ({
      status: 'success',
      input: args.inputData,
      result: { value: 2 },
      state: undefined,
      steps: { increment: { value: 2 } },
    }));

    const result = await run.start({ inputData: { value: 1 } });
    const expected = { increment: { status: 'success', output: { value: 2 }, startedAt: 0, endedAt: 0 } };

    expect(result.steps).toEqual(expected);
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ steps: expected }));
  });

  it('wraps raw step outputs that only resemble step results', async () => {
    const rawOutput = { status: 'pending', output: 42, startedAt: 1 };
    const { run } = await createRun(async args => ({
      status: 'success',
      input: args.inputData,
      result: { value: 2 },
      state: undefined,
      steps: { increment: rawOutput },
    }));

    const result = await run.start({ inputData: { value: 1 } });

    expect(result.steps).toEqual({ increment: { status: 'success', output: rawOutput, startedAt: 0, endedAt: 0 } });
  });
});

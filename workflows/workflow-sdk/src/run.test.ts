import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { WorkflowSdkWorkflow } from './workflow';
import { createStep, init } from './index';

/**
 * Which function reference a run hands to the Workflow SDK's `start`.
 *
 * `init({ runner })` promises the runner argument is what gets started. That
 * promise was decorative once: `run.ts` imported `mastraRunner` from
 * `src/workflows/runner` and started that instead, so the argument had no
 * effect on execution. It looked fine end-to-end — the bundled copy is the same
 * function in the standard setup — while quietly pulling `"use step"` and
 * `"use workflow"` directives into the host bundle, which made the Workflow SDK
 * treat the host entry as a second workflow module and compile `@mastra/core`
 * into the sandbox.
 *
 * A sentinel runner is the only cheap way to tell the two apart: the bundled
 * copy is never the sentinel. `startAsync()` returns as soon as the run is
 * enqueued, so no other part of the runtime needs to be faked.
 */
const { sdkStart } = vi.hoisted(() => ({ sdkStart: vi.fn() }));

vi.mock('workflow/api', () => ({
  start: sdkStart,
  getRun: vi.fn(),
  resumeHook: vi.fn(),
}));

const numberIn = z.object({ value: z.number() });

const noop = createStep({
  id: 'noop',
  inputSchema: numberIn,
  outputSchema: numberIn,
  execute: async ({ inputData }) => inputData,
});

describe('run start', () => {
  beforeEach(() => {
    sdkStart.mockReset();
    sdkStart.mockResolvedValue({ runId: 'sdk-run-1' });
  });

  it('starts the runner passed to init(), not a copy bundled with the package', async () => {
    const runner = vi.fn(async () => ({}));
    const { createWorkflow } = init({ runner });
    const workflow = createWorkflow({
      id: 'sentinel-workflow',
      inputSchema: numberIn,
      outputSchema: numberIn,
    })
      .then(noop)
      .commit();

    const run = await workflow.createRun();
    await run.startAsync({ inputData: { value: 1 } });

    expect(sdkStart).toHaveBeenCalledTimes(1);
    expect(sdkStart.mock.calls[0]![0]).toBe(runner);
  });

  it('keeps each init()s runner with its own workflows', async () => {
    const first = vi.fn(async () => ({}));
    const second = vi.fn(async () => ({}));

    const firstWorkflow = init({ runner: first })
      .createWorkflow({ id: 'first-workflow', inputSchema: numberIn, outputSchema: numberIn })
      .then(noop)
      .commit();
    const secondWorkflow = init({ runner: second })
      .createWorkflow({ id: 'second-workflow', inputSchema: numberIn, outputSchema: numberIn })
      .then(noop)
      .commit();

    await (await firstWorkflow.createRun()).startAsync({ inputData: { value: 1 } });
    await (await secondWorkflow.createRun()).startAsync({ inputData: { value: 1 } });

    expect(sdkStart.mock.calls.map(call => call[0])).toEqual([first, second]);
  });

  it('refuses to start when no runner was supplied', async () => {
    // `runner` is required by the types, so this is the JavaScript consumer's
    // path. It has to fail loudly: falling back to a package-internal runner is
    // what put directives in the host bundle.
    const workflow = new WorkflowSdkWorkflow(
      { id: 'runnerless-workflow', inputSchema: numberIn, outputSchema: numberIn },
      { runner: undefined as never },
    )
      .then(noop)
      .commit();

    const run = await workflow.createRun();

    await expect(run.startAsync({ inputData: { value: 1 } })).rejects.toThrow(/no Workflow SDK runner was supplied/);
    expect(sdkStart).not.toHaveBeenCalled();
  });
});

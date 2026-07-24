import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { init } from './index';

describe('InngestWorkflow cancelOn runId scope', () => {
  let inngest: Inngest;
  let createFunctionSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    inngest = new Inngest({ id: 'cancel-on-scope-test' });
    createFunctionSpy = vi.spyOn(inngest, 'createFunction');
  });

  it('registers cancelOn with runId match for the workflow function', () => {
    const { createWorkflow, createStep } = init(inngest);

    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ result: 'done' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'scoped-cancel-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
    });

    workflow.then(step1).commit();

    // Registering with Mastra is not required to inspect getFunction() config,
    // but mirrors serve() registration.
    new Mastra({
      storage: new MockStore(),
      workflows: {
        'scoped-cancel-workflow': workflow,
      },
    });

    workflow.getFunction();

    expect(createFunctionSpy).toHaveBeenCalled();
    const opts = createFunctionSpy.mock.calls.find(
      ([config]) => (config as { id?: string }).id === 'workflow.scoped-cancel-workflow',
    )?.[0] as {
      cancelOn?: Array<{ event: string; if?: string }>;
    };

    expect(opts?.cancelOn).toEqual([
      {
        event: 'cancel.workflow.scoped-cancel-workflow',
        if: 'async.data.runId == event.data.runId',
      },
    ]);
  });

  it('registers cancelOn with runId match for the cron function', () => {
    const { createWorkflow, createStep } = init(inngest);

    const step1 = createStep({
      id: 'step1',
      execute: async () => ({ result: 'done' }),
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
    });

    const workflow = createWorkflow({
      id: 'scoped-cancel-cron-workflow',
      inputSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
      cron: '0 * * * *',
    });

    workflow.then(step1).commit();

    const functions = workflow.getFunctions();
    expect(functions.length).toBeGreaterThanOrEqual(2);

    const cronOpts = createFunctionSpy.mock.calls.find(
      ([config]) => (config as { id?: string }).id === 'workflow.scoped-cancel-cron-workflow.cron',
    )?.[0] as {
      cancelOn?: Array<{ event: string; if?: string }>;
    };

    expect(cronOpts?.cancelOn).toEqual([
      {
        event: 'cancel.workflow.scoped-cancel-cron-workflow',
        if: 'async.data.runId == event.data.runId',
      },
    ]);
  });
});

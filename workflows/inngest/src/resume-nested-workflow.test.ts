import { serve as serveHono } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { DefaultStorage } from '@mastra/libsql';
import { execaCommand } from 'execa';
import type { ResultPromise } from 'execa';
import { Hono } from 'hono';
import { Inngest } from 'inngest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { init, serve as inngestServe } from './index';

/**
 * Regression coverage for #23182: resuming a step that suspended inside a
 * nested workflow when the resume addresses only the outer (nested workflow)
 * step id — the form label-based resume dispatches. The failures only manifest
 * across Inngest's multi-pass replay of the parent function, so these tests run
 * against a real inngest-cli dev server instead of mocks:
 *
 * 1. Core strips `suspendPayload` from persisted step results before re-entry
 *    (omitPriorCompletionFields), so on a replay pass the engine can no longer
 *    read the child's run id from `__workflow_meta`. It used to invent a random
 *    one, the child snapshot lookup missed, and resume failed with
 *    "No suspended steps found in nested workflow: ...". The child run id is now
 *    derived from the parent's run id, matching the default engine.
 * 2. When the child finishes, Inngest re-executes the resume block to deliver
 *    the memoized invoke result. The child is no longer suspended on that pass;
 *    the engine now replays the memoized invoke instead of throwing.
 */

const DEV_SERVER_PORT = 4210;
const HANDLER_PORT = 4211;
const APP_ID = 'nested-resume-regression';

let devServer: ResultPromise | null = null;
let handlerServer: ServerType | null = null;

const suspectSchema = z.object({ suspect: z.string() });

function buildWorkflows(inngest: Inngest) {
  const { createWorkflow, createStep } = init(inngest);

  // Scenario 1: resume addressed by only the nested workflow id.
  const innerStepAction = vi.fn().mockImplementation(async ({ resumeData, suspend }) => {
    if (!resumeData?.suspect) {
      return await suspend({ message: 'What is the suspect?' });
    }
    return { suspect: resumeData.suspect };
  });
  const innerStep = createStep({
    id: 'inner-step',
    inputSchema: suspectSchema,
    outputSchema: suspectSchema,
    suspendSchema: z.object({ message: z.string() }),
    resumeSchema: suspectSchema,
    execute: innerStepAction,
  });
  const innerWorkflow = createWorkflow({
    id: 'outer-id-inner-wf',
    inputSchema: suspectSchema,
    outputSchema: suspectSchema,
  })
    .then(innerStep)
    .commit();
  const outerIdWorkflow = createWorkflow({
    id: 'outer-id-main-wf',
    inputSchema: suspectSchema,
    outputSchema: suspectSchema,
  })
    .then(innerWorkflow)
    .commit();

  // Scenario 2: resume addressed by resume label (resolves to the outer step id).
  const labelStepAction = vi.fn().mockImplementation(async ({ resumeData, suspend }) => {
    if (!resumeData?.suspect) {
      return await suspend({ message: 'Approve the suspect?' }, { resumeLabel: 'nested-approve-23182' });
    }
    return { suspect: resumeData.suspect };
  });
  const labelStep = createStep({
    id: 'label-step',
    inputSchema: suspectSchema,
    outputSchema: suspectSchema,
    suspendSchema: z.object({ message: z.string() }),
    resumeSchema: suspectSchema,
    execute: labelStepAction,
  });
  const labelInnerWorkflow = createWorkflow({
    id: 'label-inner-wf',
    inputSchema: suspectSchema,
    outputSchema: suspectSchema,
  })
    .then(labelStep)
    .commit();
  const labelWorkflow = createWorkflow({
    id: 'label-main-wf',
    inputSchema: suspectSchema,
    outputSchema: suspectSchema,
  })
    .then(labelInnerWorkflow)
    .commit();

  return { outerIdWorkflow, labelWorkflow, innerStepAction, labelStepAction };
}

async function waitForFunctionRegistration(expectedFnIds: string[], maxAttempts = 30): Promise<void> {
  const matches = (id: string, candidate: string) =>
    candidate === id || candidate.endsWith(`-${id}`) || candidate.endsWith(`.${id}`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`http://localhost:${DEV_SERVER_PORT}/dev`);
      const data = await response.json();
      const fns = (data.functions ?? []) as Array<{ slug?: string; id?: string; name?: string }>;
      const candidates = fns.flatMap(f => [f.slug, f.id, f.name].filter(Boolean) as string[]);
      if (expectedFnIds.every(id => candidates.some(c => matches(id, c)))) return;
      if (i === Math.floor(maxAttempts / 3)) {
        // Re-trigger registration mid-wait in case the first PUT raced startup.
        await fetch(`http://localhost:${HANDLER_PORT}/inngest/api`, { method: 'PUT' }).catch(() => {});
      }
    } catch {
      // Keep trying.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for function registration: ${expectedFnIds.join(', ')}`);
}

let workflows!: ReturnType<typeof buildWorkflows>;

beforeAll(async () => {
  const inngest = new Inngest({
    id: APP_ID,
    baseUrl: `http://localhost:${DEV_SERVER_PORT}`,
  });

  workflows = buildWorkflows(inngest);

  const mastra = new Mastra({
    logger: false,
    storage: new DefaultStorage({
      id: 'nested-resume-test-storage',
      url: ':memory:',
    }),
    workflows: {
      outerIdWorkflow: workflows.outerIdWorkflow,
      labelWorkflow: workflows.labelWorkflow,
    } as any,
  });

  // Start the handler server FIRST so the dev server can sync with it.
  const app = new Hono();
  const inngestHandler = inngestServe({ mastra, inngest });
  app.use('/inngest/api', async c => inngestHandler(c));
  handlerServer = serveHono({
    fetch: app.fetch,
    port: HANDLER_PORT,
  });

  // Reuse an already-running dev server on our port (e.g. left over from a
  // previous crashed run); otherwise spawn one. Same pattern as the shared
  // harness in index.test.ts.
  let devServerAlreadyRunning = false;
  try {
    const response = await fetch(`http://localhost:${DEV_SERVER_PORT}/dev`, { signal: AbortSignal.timeout(1000) });
    devServerAlreadyRunning = response.ok;
  } catch {
    // Not running yet.
  }

  if (!devServerAlreadyRunning) {
    devServer = execaCommand(
      `npx inngest-cli dev -p ${DEV_SERVER_PORT} -u http://localhost:${HANDLER_PORT}/inngest/api --poll-interval=1 --retry-interval=1`,
      { cwd: import.meta.dirname, stdio: 'ignore', reject: false },
    );
    for (let i = 0; i < 60; i++) {
      try {
        const response = await fetch(`http://localhost:${DEV_SERVER_PORT}/dev`);
        if (response.ok) break;
      } catch {
        // Keep trying.
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Trigger registration, then wait until the dev server sees our functions.
  await fetch(`http://localhost:${HANDLER_PORT}/inngest/api`, { method: 'PUT' }).catch(() => {});
  await waitForFunctionRegistration(['workflow.outer-id-main-wf', 'workflow.label-main-wf']);
}, 120_000);

afterAll(async () => {
  handlerServer?.close();
  handlerServer = null;
  if (devServer) {
    devServer.kill();
    devServer = null;
  }
});

describe('nested workflow suspend/resume (#23182)', () => {
  it('resumes a suspended child step when addressed by only the nested workflow id', async () => {
    const { outerIdWorkflow, innerStepAction } = workflows;

    const run = await outerIdWorkflow.createRun();
    const initialResult = await run.start({ inputData: { suspect: 'initial-suspect' } });
    expect(initialResult.status).toBe('suspended');

    // Only the outer step id — the engine must restore the suspended child path
    // from the child's snapshot, found under the parent's run id even after core
    // stripped suspendPayload, and replay the memoized invoke on the delivery pass.
    const resumeResult = await run.resume({
      step: ['outer-id-inner-wf'],
      resumeData: { suspect: 'resumed-suspect' },
    });

    expect(innerStepAction).toHaveBeenCalledTimes(2);
    expect(resumeResult).toMatchObject({
      status: 'success',
      result: { suspect: 'resumed-suspect' },
    });
    expect(resumeResult.steps['outer-id-inner-wf']).toMatchObject({ status: 'success' });
  });

  it('resumes a suspended child step by resume label', async () => {
    const { labelWorkflow, labelStepAction } = workflows;

    const run = await labelWorkflow.createRun();
    const initialResult = await run.start({ inputData: { suspect: 'initial-suspect' } });
    expect(initialResult.status).toBe('suspended');

    const resumeResult = await run.resume({
      label: 'nested-approve-23182',
      resumeData: { suspect: 'labeled-suspect' },
    });

    expect(labelStepAction).toHaveBeenCalledTimes(2);
    expect(resumeResult).toMatchObject({
      status: 'success',
      result: { suspect: 'labeled-suspect' },
    });
    expect(resumeResult.steps['label-inner-wf']).toMatchObject({ status: 'success' });
  });
});

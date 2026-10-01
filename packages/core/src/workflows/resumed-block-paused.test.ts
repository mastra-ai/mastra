import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createStep, createWorkflow } from './index';

function makeNested(id: string) {
  const gate = createStep({
    id: `${id}-gate`,
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    resumeSchema: z.object({ ok: z.boolean() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) return suspend({ waiting: id });
      return { ok: resumeData.ok };
    },
  });
  const after = createStep({
    id: `${id}-after`,
    inputSchema: z.object({ ok: z.boolean() }),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async ({ inputData }) => inputData,
  });
  return createWorkflow({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
  })
    .then(gate)
    .then(after)
    .commit();
}

describe('resumed parallel block where every branch pauses', () => {
  it('does not report suspended with nothing to resume', async () => {
    const a = makeNested('a');
    const b = makeNested('b');
    const wf = createWorkflow({ id: 'outer', inputSchema: z.object({}), outputSchema: z.any() })
      .parallel([a, b])
      .commit();
    new Mastra({ workflows: { wf }, storage: new MockStore(), logger: false });

    const run = await wf.createRun();
    const start = await run.start({ inputData: {} });
    expect(start.status).toBe('suspended');

    const first = await run.resume({ step: ['a', 'a-gate'], resumeData: { ok: true }, perStep: true });
    expect(first.status).toBe('suspended');

    const second = await run.resume({ step: ['b', 'b-gate'], resumeData: { ok: true }, perStep: true });
    const snapshot = await wf.getWorkflowRunById(run.runId);

    expect(second.status).toBe('paused');
    expect(snapshot?.status).toBe('paused');
  });
});

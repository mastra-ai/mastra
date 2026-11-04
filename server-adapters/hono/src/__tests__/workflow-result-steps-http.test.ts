import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { Hono } from 'hono';
import { describe, expect, it, onTestFinished } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

// A storage v2 run's result reads its step results back from storage on demand, which a JSON
// response can't carry: the routes answer with them read, the same as for a v1 run.
describe.each([1, 2] as const)('workflow routes answer with every step result (storage v%i)', storageVersion => {
  async function serve() {
    const draft = createStep({
      id: 'draft',
      inputSchema: z.object({ to: z.string() }),
      outputSchema: z.object({ to: z.string(), body: z.string() }),
      execute: async ({ inputData }) => ({ to: inputData.to, body: `hello ${inputData.to}` }),
    });
    const approve = createStep({
      id: 'approve',
      inputSchema: z.object({ to: z.string(), body: z.string() }),
      outputSchema: z.object({ to: z.string(), body: z.string(), approver: z.string() }),
      resumeSchema: z.object({ approver: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) return suspend({});
        return { ...inputData, approver: resumeData.approver };
      },
    });
    const send = createStep({
      id: 'send',
      inputSchema: z.object({ to: z.string(), body: z.string(), approver: z.string() }),
      outputSchema: z.object({ sent: z.string() }),
      execute: async ({ inputData }) => ({ sent: `${inputData.body} (approved by ${inputData.approver})` }),
    });
    const workflow = createWorkflow({
      id: 'mail',
      inputSchema: z.object({ to: z.string() }),
      outputSchema: z.object({ sent: z.string() }),
      options: { storageVersion },
    })
      .then(draft)
      .then(approve)
      .then(send)
      .commit();

    const mastra = new Mastra({ logger: false, storage: new InMemoryStore(), workflows: { mail: workflow } });
    onTestFinished(() => mastra.shutdown());
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();

    return async (route: string, runId: string, body: unknown) => {
      const response = await app.request(`/api/workflows/mail/${route}?runId=${runId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(200);
      return response.json();
    };
  }

  const input = { to: 'ana' };
  const drafted = {
    status: 'success',
    output: { to: 'ana', body: 'hello ana' },
    startedAt: expect.any(Number),
    endedAt: expect.any(Number),
  };
  const approved = {
    status: 'success',
    output: { to: 'ana', body: 'hello ana', approver: 'bo' },
    resumePayload: { approver: 'bo' },
    startedAt: expect.any(Number),
    resumedAt: expect.any(Number),
    endedAt: expect.any(Number),
  };
  const sent = {
    status: 'success',
    output: { sent: 'hello ana (approved by bo)' },
    startedAt: expect.any(Number),
    endedAt: expect.any(Number),
  };

  it('start-async and resume-async', async () => {
    const post = await serve();
    const runId = crypto.randomUUID();

    const started = await post('start-async', runId, { inputData: { to: 'ana' } });
    expect(started).toEqual({
      status: 'suspended',
      runId,
      input,
      stepExecutionPath: ['draft', 'approve'],
      suspended: [['approve']],
      suspendPayload: { approve: {} },
      steps: {
        input,
        draft: drafted,
        approve: {
          status: 'suspended',
          suspendPayload: {},
          startedAt: expect.any(Number),
          suspendedAt: expect.any(Number),
        },
      },
    });

    const resumed = await post('resume-async', runId, { step: 'approve', resumeData: { approver: 'bo' } });
    expect(resumed).toEqual({
      status: 'success',
      runId,
      input,
      stepExecutionPath: ['draft', 'approve', 'send'],
      result: sent.output,
      steps: { input, draft: drafted, approve: approved, send: sent },
    });
  });

  it('restart-async of a finished run', async () => {
    const post = await serve();
    const runId = crypto.randomUUID();
    await post('start-async', runId, { inputData: { to: 'ana' } });
    await post('resume-async', runId, { step: 'approve', resumeData: { approver: 'bo' } });

    const restarted = await post('restart-async', runId, {});
    expect(restarted).toEqual({
      status: 'success',
      runId,
      input,
      resumeLabels: {},
      stepExecutionPath: ['draft', 'approve', 'send'],
      result: sent.output,
      steps: {
        input,
        draft: { ...drafted, payload: input },
        approve: { ...approved, payload: drafted.output },
        send: { ...sent, payload: approved.output },
      },
    });
  });

  it('time-travel-async', async () => {
    const post = await serve();
    const runId = crypto.randomUUID();
    await post('start-async', runId, { inputData: { to: 'ana' } });
    await post('resume-async', runId, { step: 'approve', resumeData: { approver: 'bo' } });

    const travelled = await post('time-travel-async', runId, {
      step: 'send',
      inputData: { to: 'ana', body: 'hi again', approver: 'cy' },
    });
    // Time travel records the input it was given as the output of the step before.
    expect(travelled).toEqual({
      status: 'success',
      runId,
      input,
      stepExecutionPath: ['draft', 'approve', 'send', 'send'],
      result: { sent: 'hi again (approved by cy)' },
      steps: {
        input,
        draft: drafted,
        approve: { ...approved, output: { to: 'ana', body: 'hi again', approver: 'cy' } },
        send: {
          ...sent,
          payload: { to: 'ana', body: 'hi again', approver: 'cy' },
          output: { sent: 'hi again (approved by cy)' },
        },
      },
    });
  });
});

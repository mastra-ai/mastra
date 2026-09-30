/**
 * Regression for https://github.com/mastra-ai/mastra/issues/25365 (evented engine).
 *
 * A process that dies while a resumed nested-workflow step is running must be
 * recoverable via restart(): the resumed step re-runs with its original resume
 * data instead of suspending again.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

function build(onResume: (data: any) => Promise<void>) {
  const gate = createStep({
    id: 'gate',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
    resumeSchema: z.boolean(),
    execute: async ({ resumeData, suspend }) => {
      if (resumeData === undefined) {
        return suspend({});
      }
      await onResume(resumeData);
      return { approved: resumeData };
    },
  });
  const nested = createWorkflow({
    id: 'nested',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
  })
    .then(gate)
    .commit();
  const parent = createWorkflow({
    id: 'parent',
    inputSchema: z.object({}),
    outputSchema: z.object({ approved: z.boolean() }),
  })
    .then(nested)
    .commit();
  return { parent, nested };
}

async function makeHost(storage: MockStore, p: ReturnType<typeof build>) {
  const mastra = new Mastra({
    logger: false,
    storage,
    pubsub: new EventEmitterPubSub(),
    workflows: { parent: p.parent, nested: p.nested },
  });
  await mastra.startWorkers();
  return mastra;
}

async function crashMidResume() {
  const storage = new MockStore();
  let markRunning!: () => void;
  const running = new Promise<void>(r => (markRunning = r));
  const p = build(async () => {
    markRunning();
    await new Promise(() => {}); // process "dies" here
  });
  const mastra = await makeHost(storage, p);
  const run = await p.parent.createRun();
  expect((await run.start({ inputData: {} })).status).toBe('suspended');

  const store = (await storage.getStore('workflows'))!;
  const parentBefore = await store.loadWorkflowSnapshot({ workflowName: 'parent', runId: run.runId });
  const nestedRunId = (parentBefore?.context as any).nested.metadata.nestedRunId as string;
  const suspendedNested = JSON.parse(
    JSON.stringify(await store.loadWorkflowSnapshot({ workflowName: 'nested', runId: nestedRunId })),
  );

  void run.resume({ step: ['nested', 'gate'], resumeData: false });
  await running;

  const parentSnapshot = JSON.parse(
    JSON.stringify(await store.loadWorkflowSnapshot({ workflowName: 'parent', runId: run.runId })),
  );
  const nestedSnapshot = JSON.parse(
    JSON.stringify(await store.loadWorkflowSnapshot({ workflowName: 'nested', runId: nestedRunId })),
  );
  await mastra.stopWorkers();
  return { runId: run.runId, nestedRunId, parentSnapshot, nestedSnapshot, suspendedNested };
}

async function restartOnFreshHost(runId: string, nestedRunId: string, parentSnapshot: any, nestedSnapshot: any) {
  const storage = new MockStore();
  const store = (await storage.getStore('workflows'))!;
  await store.persistWorkflowSnapshot({ workflowName: 'parent', runId, snapshot: parentSnapshot });
  await store.persistWorkflowSnapshot({ workflowName: 'nested', runId: nestedRunId, snapshot: nestedSnapshot });

  const seen: any[] = [];
  const p = build(async data => {
    seen.push(data);
  });
  const mastra = await makeHost(storage, p);
  try {
    const result = await (await p.parent.createRun({ runId })).restart();
    const nestedAfter = await store.loadWorkflowSnapshot({ workflowName: 'nested', runId: nestedRunId });
    return { result, seen, nestedAfter };
  } finally {
    await mastra.stopWorkers();
  }
}

describe('evented nested workflow restart after crash during resume (issue #25365)', () => {
  it('records the resume data on the resumed step records', async () => {
    const { parentSnapshot, nestedSnapshot } = await crashMidResume();
    expect(parentSnapshot.status).toBe('running');
    expect(parentSnapshot.context.nested).toMatchObject({ status: 'running', resumePayload: false });
    expect(parentSnapshot.context.nested.suspendPayload.__workflow_meta.runId).toBeTruthy();
    expect(nestedSnapshot.status).toBe('running');
    expect(nestedSnapshot.context.gate).toMatchObject({ status: 'running', resumePayload: false });
  });

  it('restarts the resumed nested step with its falsy resume data', async () => {
    const { runId, nestedRunId, parentSnapshot, nestedSnapshot } = await crashMidResume();
    const { result, seen, nestedAfter } = await restartOnFreshHost(runId, nestedRunId, parentSnapshot, nestedSnapshot);

    expect(result.status).toBe('success');
    expect(seen).toEqual([false]);
    if (result.status === 'success') {
      expect(result.result).toEqual({ approved: false });
    }
    expect(nestedAfter?.status).toBe('success');
  });

  it.each([
    ['before it claimed the resume', 'suspended'],
    ['after it claimed the resume but before the resumed step started', 'running'],
  ] as const)('resumes the nested run when the process died %s', async (_, nestedStatus) => {
    const { runId, nestedRunId, parentSnapshot, suspendedNested } = await crashMidResume();
    const { result, seen, nestedAfter } = await restartOnFreshHost(runId, nestedRunId, parentSnapshot, {
      ...suspendedNested,
      status: nestedStatus,
    });

    expect(result.status).toBe('success');
    expect(seen).toEqual([false]);
    expect(nestedAfter?.status).toBe('success');
  });
});

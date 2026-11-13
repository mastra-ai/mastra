import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep as createDefaultStep, createWorkflow as createDefaultWorkflow } from '../index';
import { createStep, createWorkflow } from '.';

const schema = z.object({ n: z.number() });

async function timebox<T>(promise: Promise<T>, ms = 5000): Promise<T | { status: 'TIMEOUT' }> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<{ status: 'TIMEOUT' }>(resolve => {
        timer = setTimeout(() => resolve({ status: 'TIMEOUT' }), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The version table the run was found in. A run is only ever stored in one of them. */
async function storedVersion(storage: InstanceType<typeof MockStore>, workflowName: string, runId: string) {
  const store = (await storage.getStore('workflows'))!;
  const v1 = await store.loadWorkflowSnapshot({ workflowName, runId, storageVersion: 1 });
  const v2 = await store.loadWorkflowRunHeader({ workflowName, runId });
  return { v1: !!v1, v2: !!v2, status: (v1 ?? v2?.header)?.status };
}

describe.each([
  [2, undefined, 'v2 parent, child follows the parent'],
  [1, 2, 'v1 parent, the child option cannot outvote it'],
  [1, undefined, 'v1 parent, child defaults to v1'],
  [2, 2, 'v2 parent, child agrees'],
] as const)('nested run storage version: parent v%s, child option %s (%s)', (parentVersion, childVersion, _case) => {
  it("stores the nested run in its parent run's version", async () => {
    const id = `nested-version-${parentVersion}-${childVersion ?? 'inherit'}`;
    const child = createWorkflow({
      id: `${id}-child`,
      inputSchema: schema,
      outputSchema: schema,
      options: childVersion ? { storageVersion: childVersion } : undefined,
    })
      .then(
        createStep({
          id: 'inc',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ inputData }) => ({ n: inputData.n + 1 }),
        }),
      )
      .commit();
    const parent = createDefaultWorkflow({
      id,
      inputSchema: schema,
      outputSchema: schema,
      options: { storageVersion: parentVersion },
    })
      .then(child as any)
      .then(
        createDefaultStep({
          id: 'double',
          inputSchema: schema,
          outputSchema: schema,
          execute: async ({ inputData }) => ({ n: inputData.n * 2 }),
        }) as any,
      )
      .commit();
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { [id]: parent, [child.id]: child },
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startWorkers();
    try {
      const run = await parent.createRun();
      const result: any = await timebox(run.start({ inputData: { n: 1 } }));
      expect(result.status).toBe('success');
      expect(result.result).toEqual({ n: 4 });

      const store = (await storage.getStore('workflows'))!;
      const { runs } = await store.listWorkflowRuns({ workflowName: child.id });
      expect(runs).toHaveLength(1);
      const childStored = await storedVersion(storage, child.id, runs[0]!.runId);
      // A parent resumes its child through its own version, so a child stored anywhere else
      // makes the parent fail to find it on resume and on restart.
      expect(childStored.v1).toBe(parentVersion === 1);
      expect(childStored.v2).toBe(parentVersion === 2);
      expect(childStored.status).toBe('success');
    } finally {
      await mastra.stopWorkers();
    }
  });
});

describe.each([
  [2, undefined],
  [1, 2],
] as const)('suspended nested run resumed directly: parent v%s, child option %s', (parentVersion, childVersion) => {
  it('resumes the parent after the nested run finished', async () => {
    const id = `nested-resume-${parentVersion}-${childVersion ?? 'inherit'}`;
    const child = createWorkflow({
      id: `${id}-child`,
      inputSchema: schema,
      outputSchema: schema,
      options: childVersion ? { storageVersion: childVersion } : undefined,
    })
      .then(
        createStep({
          id: 'gate',
          inputSchema: schema,
          outputSchema: schema,
          resumeSchema: z.object({ ok: z.boolean() }),
          execute: async ({ inputData, resumeData, suspend }) => {
            if (!resumeData) return suspend({});
            return { n: inputData.n + 1 };
          },
        }),
      )
      .commit();
    const parent = createDefaultWorkflow({
      id,
      inputSchema: schema,
      outputSchema: schema,
      options: { storageVersion: parentVersion },
    })
      .then(child as any)
      .commit();
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      workflows: { [id]: parent, [child.id]: child },
      pubsub: new EventEmitterPubSub(),
    });
    await mastra.startWorkers();
    try {
      const run = await parent.createRun();
      const started: any = await timebox(run.start({ inputData: { n: 1 } }));
      expect(started.status).toBe('suspended');

      const store = (await storage.getStore('workflows'))!;
      const { runs } = await store.listWorkflowRuns({ workflowName: child.id });
      const childRunId = runs[0]!.runId;
      const childRun = await child.createRun({ runId: childRunId });
      const childResult: any = await timebox(childRun.resume({ step: 'gate', resumeData: { ok: true } }));
      expect(childResult.status).toBe('success');

      // A finished child under the parent's version is found when the parent continues; the
      // same child under another version is not, and the resume fails as not suspended.
      let parentResult: any = await timebox(
        (async () => {
          for (let i = 0; i < 20; i++) {
            const status = await parent.getWorkflowRunById(run.runId, { withNestedWorkflows: false });
            if (status?.status !== 'suspended' && status?.status !== 'running') return { status: status?.status };
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          return undefined;
        })(),
      );
      if (!parentResult) {
        const again = await parent.createRun({ runId: run.runId });
        parentResult = await timebox(again.resume({ step: child.id, resumeData: { ok: true } }));
      }
      expect(parentResult.status).toBe('success');
    } finally {
      await mastra.stopWorkers();
    }
  });
});

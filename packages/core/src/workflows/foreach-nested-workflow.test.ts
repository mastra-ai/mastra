import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { RequestContext } from '../request-context';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

describe('foreach nested workflow runs', () => {
  it('includes every nested workflow invocation in getWorkflowRunById', async () => {
    const itemSchema = z.object({ value: z.string() });

    const childStep = createStep({
      id: 'child-step',
      inputSchema: itemSchema,
      outputSchema: itemSchema,
      execute: async ({ inputData }) => inputData,
    });

    const childWorkflow = createWorkflow({
      id: 'child-workflow',
      inputSchema: itemSchema,
      outputSchema: itemSchema,
    })
      .then(childStep)
      .commit();

    const parentWorkflow = createWorkflow({
      id: 'parent-workflow',
      inputSchema: z.array(itemSchema),
      outputSchema: z.array(itemSchema),
    })
      .foreach(childWorkflow)
      .commit();

    const storage = new MockStore();
    new Mastra({
      workflows: { parentWorkflow },
      storage,
      logger: false,
    });

    const run = await parentWorkflow.createRun();
    await run.start({ inputData: [{ value: 'first' }, { value: 'second' }] });

    const workflowsStore = await storage.getStore('workflows');
    const parentSnapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId: run.runId,
    });
    const foreachResult = parentSnapshot?.context?.[childWorkflow.id];
    const nestedRunIds = foreachResult?.metadata?.nestedRunId;

    expect(nestedRunIds).toHaveLength(2);
    expect(nestedRunIds?.[0]).toEqual(expect.any(String));
    expect(nestedRunIds?.[1]).toEqual(expect.any(String));
    expect(nestedRunIds?.[0]).not.toBe(nestedRunIds?.[1]);

    const polled = await parentWorkflow.getWorkflowRunById(run.runId, {
      withNestedWorkflows: true,
      fields: ['steps'],
    });

    expect(polled?.steps?.['child-workflow[0].child-step']).toMatchObject({
      status: 'success',
      output: { value: 'first' },
    });
    expect(polled?.steps?.['child-workflow[1].child-step']).toMatchObject({
      status: 'success',
      output: { value: 'second' },
    });
  });

  it.each([1, 5, 10])(
    'starts a fresh child run for each iteration when siblings suspend (concurrency %i)',
    async concurrency => {
      const childStep = createStep({
        id: 'maybe-suspend',
        inputSchema: z.number(),
        outputSchema: z.number(),
        resumeSchema: z.object({ add: z.number() }),
        execute: async ({ inputData, resumeData, suspend }) => {
          if (inputData % 2 === 1 && !resumeData) {
            return suspend({ value: inputData });
          }
          return inputData + (resumeData?.add ?? 0);
        },
      });

      const childWorkflow = createWorkflow({ id: 'child', inputSchema: z.number(), outputSchema: z.number() })
        .then(childStep)
        .commit();

      const parentWorkflow = createWorkflow({
        id: 'parent',
        inputSchema: z.array(z.number()),
        outputSchema: z.array(z.number()),
      })
        .foreach(childWorkflow, { concurrency })
        .commit();

      new Mastra({ workflows: { parentWorkflow }, storage: new MockStore(), logger: false });

      const run = await parentWorkflow.createRun();
      let result = await run.start({ inputData: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
      expect(result.status).toBe('suspended');

      for (const forEachIndex of [1, 3, 5, 7, 9]) {
        expect(result.status).toBe('suspended');
        result = await run.resume({
          step: [childWorkflow.id, childStep.id],
          resumeData: { add: 100 },
          forEachIndex,
        });
      }

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual([0, 101, 2, 103, 4, 105, 6, 107, 8, 109]);
      }
    },
  );
  it('allows only one nested child to resume the suspended parent at a time', async () => {
    let alphaResumeStarted!: () => void;
    const alphaResumeHasStarted = new Promise<void>(resolve => {
      alphaResumeStarted = resolve;
    });
    let releaseAlphaResume!: () => void;
    const alphaResumeReleased = new Promise<void>(resolve => {
      releaseAlphaResume = resolve;
    });

    const childStep = createStep({
      id: 'approval-step',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ item: inputData.item });
        }
        if (resumeData && inputData.item === 'alpha') {
          alphaResumeStarted();
          await alphaResumeReleased;
        }
        return inputData.item;
      },
    });

    const childWorkflow = createWorkflow({
      id: 'concurrent-child-workflow',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
    })
      .then(childStep)
      .commit();

    const parentWorkflow = createWorkflow({
      id: 'concurrent-parent-workflow',
      inputSchema: z.array(z.object({ item: z.string() })),
      outputSchema: z.array(z.string()),
    })
      .foreach(childWorkflow, { concurrency: 2 })
      .commit();

    const storage = new MockStore();
    new Mastra({ workflows: { parentWorkflow }, storage, logger: false });

    const parentRun = await parentWorkflow.createRun();
    expect(await parentRun.start({ inputData: [{ item: 'alpha' }, { item: 'beta' }] })).toMatchObject({
      status: 'suspended',
    });

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) throw new Error('Workflows store is unavailable');
    const parentSnapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId: parentRun.runId,
    });
    const iterations =
      parentSnapshot?.context?.[childWorkflow.id]?.suspendPayload?.__workflow_meta?.foreachOutput ?? [];
    const nestedRunIds = iterations.map(
      (iteration: { metadata?: { nestedRunId?: string } }) => iteration.metadata?.nestedRunId,
    ) as string[];
    expect(nestedRunIds).toEqual([expect.any(String), expect.any(String)]);

    const childRuns = await Promise.all(nestedRunIds.map((runId: string) => childWorkflow.createRun({ runId })));
    const alphaResume = childRuns[0]!.resume({ resumeData: { approved: true } });
    await alphaResumeHasStarted;

    await expect(childRuns[1]!.resume({ resumeData: { approved: true } })).rejects.toMatchObject({
      id: 'WORKFLOW_RESUME_ALREADY_CLAIMED',
    });
    const rejectedChildSnapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: childWorkflow.id,
      runId: nestedRunIds[1],
    });
    expect(rejectedChildSnapshot?.status).toBe('suspended');

    releaseAlphaResume();
    await expect(alphaResume).resolves.toMatchObject({ status: 'success' });
    await expect
      .poll(async () => {
        const snapshot = await workflowsStore.loadWorkflowSnapshot({
          workflowName: parentWorkflow.id,
          runId: parentRun.runId,
        });
        return snapshot?.status;
      })
      .toBe('suspended');

    expect(await childRuns[1]!.resume({ resumeData: { approved: true } })).toMatchObject({
      status: 'success',
    });
    await expect
      .poll(async () => {
        const snapshot = await workflowsStore.loadWorkflowSnapshot({
          workflowName: parentWorkflow.id,
          runId: parentRun.runId,
        });
        return snapshot?.status;
      })
      .toBe('success');
  });

  it('preserves a directly resumed child result when releasing the parent fails', async () => {
    const childStep = createStep({
      id: 'approval-step',
      inputSchema: z.string(),
      outputSchema: z.string(),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, suspend }) => suspend({ item: inputData }),
    });

    const childWorkflow = createWorkflow({
      id: 'release-error-child-workflow',
      inputSchema: z.string(),
      outputSchema: z.string(),
    })
      .then(childStep)
      .commit();
    const parentWorkflow = createWorkflow({
      id: 'release-error-parent-workflow',
      inputSchema: z.array(z.string()),
      outputSchema: z.array(z.string()),
    })
      .foreach(childWorkflow)
      .commit();

    const storage = new MockStore();
    new Mastra({ workflows: { parentWorkflow }, storage, logger: false });
    const parentRun = await parentWorkflow.createRun();
    expect(await parentRun.start({ inputData: ['alpha'] })).toMatchObject({ status: 'suspended' });

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) throw new Error('Workflows store is unavailable');
    const parentSnapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId: parentRun.runId,
    });
    const nestedRunId =
      parentSnapshot?.context?.[childWorkflow.id]?.suspendPayload?.__workflow_meta?.foreachOutput?.[0]?.metadata
        ?.nestedRunId;
    expect(nestedRunId).toEqual(expect.any(String));

    const updateWorkflowState = workflowsStore.updateWorkflowState.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'updateWorkflowState').mockImplementation(async args => {
      if (
        args.workflowName === parentWorkflow.id &&
        args.opts.status === 'suspended' &&
        args.opts.expectedStatus === 'running'
      ) {
        throw new Error('parent release failed');
      }
      return updateWorkflowState(args);
    });

    const childRun = await childWorkflow.createRun({ runId: nestedRunId });
    await expect(childRun.resume({ resumeData: { approved: true } })).resolves.toMatchObject({ status: 'suspended' });
  });

  it('releases the parent when authorization rejects its continuation before execution', async () => {
    const childStep = createStep({
      id: 'approval-step',
      inputSchema: z.string(),
      outputSchema: z.string(),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) await suspend({ item: inputData });
        return inputData;
      },
    });
    const childWorkflow = createWorkflow({
      id: 'authorization-child-workflow',
      inputSchema: z.string(),
      outputSchema: z.string(),
    })
      .then(childStep)
      .commit();
    const parentWorkflow = createWorkflow({
      id: 'authorization-parent-workflow',
      inputSchema: z.array(z.string()),
      outputSchema: z.array(z.string()),
    })
      .foreach(childWorkflow)
      .commit();

    const fgaProvider = {
      require: vi.fn().mockImplementation(async (_user, { resource }) => {
        if (resource.id === parentWorkflow.id) {
          throw new Error('parent authorization failed');
        }
      }),
      check: vi.fn(),
      filterAccessible: vi.fn(),
    };
    const storage = new MockStore();
    new Mastra({ workflows: { parentWorkflow }, storage, logger: false, server: { fga: fgaProvider } });
    const startContext = new RequestContext();
    startContext.set('user', { id: 'user-1' });
    const parentRun = await parentWorkflow.createRun();
    expect(await parentRun.start({ inputData: ['alpha'], requestContext: startContext })).toMatchObject({
      status: 'suspended',
    });

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) throw new Error('Workflows store is unavailable');
    const parentSnapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId: parentRun.runId,
    });
    const nestedRunId =
      parentSnapshot?.context?.[childWorkflow.id]?.suspendPayload?.__workflow_meta?.foreachOutput?.[0]?.metadata
        ?.nestedRunId;
    const childRun = await childWorkflow.createRun({ runId: nestedRunId });

    await expect(
      childRun.resume({ resumeData: { approved: true }, requestContext: startContext }),
    ).resolves.toMatchObject({ status: 'success' });
    await expect
      .poll(async () => {
        const snapshot = await workflowsStore.loadWorkflowSnapshot({
          workflowName: parentWorkflow.id,
          runId: parentRun.runId,
        });
        return snapshot?.status;
      })
      .toBe('suspended');
  });

  it('restores a legacy nested child parent association before it suspends again', async () => {
    const childStep = createStep({
      id: 'approval-step',
      inputSchema: z.string(),
      outputSchema: z.string(),
      resumeSchema: z.object({ stage: z.number() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData || resumeData.stage === 1) {
          await suspend({ stage: resumeData?.stage ?? 0 });
        }
        return inputData;
      },
    });
    const childWorkflow = createWorkflow({
      id: 'legacy-child-workflow',
      inputSchema: z.string(),
      outputSchema: z.string(),
    })
      .then(childStep)
      .commit();
    const parentWorkflow = createWorkflow({
      id: 'legacy-parent-workflow',
      inputSchema: z.array(z.string()),
      outputSchema: z.array(z.string()),
    })
      .foreach(childWorkflow)
      .commit();

    const storage = new MockStore();
    new Mastra({ workflows: { parentWorkflow }, storage, logger: false });
    const parentRun = await parentWorkflow.createRun();
    expect(await parentRun.start({ inputData: ['alpha'] })).toMatchObject({ status: 'suspended' });

    const workflowsStore = await storage.getStore('workflows');
    if (!workflowsStore) throw new Error('Workflows store is unavailable');
    const parentSnapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId: parentRun.runId,
    });
    const nestedRunId =
      parentSnapshot?.context?.[childWorkflow.id]?.suspendPayload?.__workflow_meta?.foreachOutput?.[0]?.metadata
        ?.nestedRunId;
    if (!nestedRunId) throw new Error('Nested run ID is unavailable');

    const legacyChildSnapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: childWorkflow.id,
      runId: nestedRunId,
    });
    if (!legacyChildSnapshot) throw new Error('Nested snapshot is unavailable');
    delete legacyChildSnapshot.parentWorkflow;
    await workflowsStore.persistWorkflowSnapshot({
      workflowName: childWorkflow.id,
      runId: nestedRunId,
      snapshot: legacyChildSnapshot,
    });

    expect(
      await parentRun.resume({
        step: [childWorkflow.id, childStep.id],
        resumeData: { stage: 1 },
        forEachIndex: 0,
      }),
    ).toMatchObject({ status: 'suspended' });

    const childRun = await childWorkflow.createRun({ runId: nestedRunId });
    expect(await childRun.resume({ resumeData: { stage: 2 } })).toMatchObject({ status: 'success' });

    await expect
      .poll(async () => {
        const snapshot = await workflowsStore.loadWorkflowSnapshot({
          workflowName: parentWorkflow.id,
          runId: parentRun.runId,
        });
        return snapshot?.status;
      })
      .toBe('success');
  });

  it('continues the parent when a nested child is resumed directly', async () => {
    const childStep = createStep({
      id: 'approval-step',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
      suspendSchema: z.object({ item: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({ item: inputData.item });
        }
        return inputData.item;
      },
    });

    const childWorkflow = createWorkflow({
      id: 'approval-child-workflow',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.string(),
    })
      .then(childStep)
      .commit();

    const parentWorkflow = createWorkflow({
      id: 'approval-parent-workflow',
      inputSchema: z.array(z.object({ item: z.string() })),
      outputSchema: z.array(z.string()),
    })
      .foreach(childWorkflow)
      .commit();

    const fgaProvider = {
      require: vi.fn().mockResolvedValue(undefined),
      check: vi.fn(),
      filterAccessible: vi.fn(),
    };
    const storage = new MockStore();
    new Mastra({ workflows: { parentWorkflow }, storage, logger: false, server: { fga: fgaProvider } });

    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });

    const parentRun = await parentWorkflow.createRun();
    const parentEvents: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const unwatch = parentRun.watch(event => {
      parentEvents.push(event);
    });
    const suspended = await parentRun.start({ inputData: [{ item: 'alpha' }], requestContext });
    expect(suspended.status).toBe('suspended');

    const workflowsStore = await storage.getStore('workflows');
    const parentSnapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId: parentRun.runId,
    });
    const nestedRunId =
      parentSnapshot?.context?.[childWorkflow.id]?.suspendPayload?.__workflow_meta?.foreachOutput?.[0]?.metadata
        ?.nestedRunId;
    expect(nestedRunId).toEqual(expect.any(String));

    const eventsBeforeChildResume = parentEvents.length;
    const childRun = await childWorkflow.createRun({ runId: nestedRunId });
    const childResult = await childRun.resume({ resumeData: { approved: true }, requestContext });
    expect(childResult.status).toBe('success');

    await expect
      .poll(async () => {
        const snapshot = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: parentWorkflow.id,
          runId: parentRun.runId,
        });
        return snapshot?.status;
      })
      .toBe('success');

    await expect
      .poll(() =>
        parentEvents
          .slice(eventsBeforeChildResume)
          .some(
            event =>
              event.type === 'workflow-step-result' &&
              event.payload.id === childWorkflow.id &&
              event.payload.status === 'success',
          ),
      )
      .toBe(true);
    unwatch();

    const completedParent = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: parentWorkflow.id,
      runId: parentRun.runId,
    });
    expect(completedParent?.result).toEqual(['alpha']);
  });
});

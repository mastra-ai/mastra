import { materializeWorkflowResumeOperationHash } from '@mastra/core/storage';
import type {
  AdmitWorkflowResumeInput,
  FinalizeWorkflowResumeInput,
  RollbackWorkflowResumeInput,
  WorkflowsStorage,
} from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { expect } from 'vitest';

function suspendedSnapshot(runId: string, resourceId: string): WorkflowRunState {
  return {
    runId,
    resourceId,
    status: 'suspended',
    value: { retained: 'true' },
    context: {
      input: { topic: 'atomic-resume' },
      wait: { status: 'suspended', payload: {}, startedAt: 1, suspendedAt: 2 },
    } as unknown as WorkflowRunState['context'],
    serializedStepGraph: [],
    activePaths: [],
    activeStepsPath: {},
    suspendedPaths: { wait: [0] },
    resumeLabels: {},
    waitingPaths: {},
    timestamp: 1,
    executionGeneration: 'wfeg:atomic-resume-contract',
    lifecycleResumeAttempt: 0,
    lifecycleStepStates: {},
  };
}

/** Focused cross-adapter contract for the atomic resume transaction boundary. */
export async function expectAtomicWorkflowResumeStorageContract(options: {
  primary: WorkflowsStorage;
  concurrent?: WorkflowsStorage;
  workflowName: string;
}): Promise<void> {
  const secondary = options.concurrent ?? options.primary;
  const resourceId = 'Resource-Case-Sensitive';
  const runIds = {
    main: 'run-main',
    conflict: 'run-conflict',
    ordinary: 'run-ordinary-resume',
    rollback: 'run-rollback',
    race: 'run-rollback-finalize-race',
    skipped: 'run-skipped',
    missing: 'run-missing',
  };
  const admissionFor = (runId: string): AdmitWorkflowResumeInput => ({
    workflowName: options.workflowName,
    runId,
    resourceId,
    resumeOperationHash: materializeWorkflowResumeOperationHash({ runId, step: 'wait', approved: true }),
    operationReplayContext: { version: 1, steps: ['wait'], resumePath: [0] },
    executionGeneration: 'wfeg:atomic-resume-contract',
    lifecycleResumeAttempt: 0,
    lifecycleStepStates: {},
    nextLifecycleResumeAttempt: 1,
    requestContext: { tenant: 'Tenant-Case-Sensitive' },
  });
  const seedAndAdmit = async (runId: string) => {
    const admission = admissionFor(runId);
    await options.primary.persistWorkflowSnapshot({
      workflowName: options.workflowName,
      runId,
      resourceId,
      snapshot: suspendedSnapshot(runId, resourceId),
    });
    await expect(options.primary.admitWorkflowResume(admission)).resolves.toMatchObject({ status: 'admitted' });
    const admitted = await options.primary.loadWorkflowSnapshot({
      workflowName: options.workflowName,
      runId,
    });
    expect(admitted).toMatchObject({ status: 'running', lifecycleResumeAttempt: 1 });
    return { admission, admitted: admitted! };
  };
  const finalizationFor = (
    admission: AdmitWorkflowResumeInput,
    admitted: WorkflowRunState,
    receiptKey: string,
    winner: string,
  ): FinalizeWorkflowResumeInput => ({
    workflowName: options.workflowName,
    runId: admission.runId,
    resourceId,
    resumeOperationHash: admission.resumeOperationHash,
    executionGeneration: admission.executionGeneration,
    lifecycleResumeAttempt: 1,
    lifecycleStepStates: {},
    shouldPersistSnapshot: false,
    receiptKey,
    snapshot: { ...admitted, status: 'success', result: { winner } },
    result: { status: 'success', steps: {}, result: { winner } },
  });
  const rollbackFor = (admission: AdmitWorkflowResumeInput): RollbackWorkflowResumeInput => ({
    workflowName: options.workflowName,
    runId: admission.runId,
    resourceId,
    resumeOperationHash: admission.resumeOperationHash,
    executionGeneration: admission.executionGeneration,
    lifecycleResumeAttempt: 1,
    lifecycleStepStates: {},
  });

  try {
    expect(options.primary.getWorkflowResumeCapabilities()).toEqual({
      atomicResumeVersion: 1,
      fencedStepUpdateVersion: 1,
    });

    const ordinarySnapshot = suspendedSnapshot(runIds.ordinary, resourceId);
    await options.primary.persistWorkflowSnapshot({
      workflowName: options.workflowName,
      runId: runIds.ordinary,
      resourceId,
      snapshot: ordinarySnapshot,
    });
    const ordinaryUpdates = await Promise.all([
      options.primary.persistWorkflowStepUpdate({
        workflowName: options.workflowName,
        runId: runIds.ordinary,
        resourceId,
        expectedExecutionGeneration: ordinarySnapshot.executionGeneration,
        expectedLifecycleResumeAttempt: 1,
        snapshot: {
          ...ordinarySnapshot,
          status: 'suspended',
          value: { winner: 'primary' },
          lifecycleResumeAttempt: 1,
        },
      }),
      secondary.persistWorkflowStepUpdate({
        workflowName: options.workflowName,
        runId: runIds.ordinary,
        resourceId,
        expectedExecutionGeneration: ordinarySnapshot.executionGeneration,
        expectedLifecycleResumeAttempt: 1,
        snapshot: {
          ...ordinarySnapshot,
          status: 'suspended',
          value: { winner: 'secondary' },
          lifecycleResumeAttempt: 1,
        },
      }),
    ]);
    expect(ordinaryUpdates.map(result => result.status).sort()).toEqual(['persisted', 'stale_execution']);
    const ordinaryWinner =
      ordinaryUpdates.findIndex(result => result.status === 'persisted') === 0 ? 'primary' : 'secondary';
    await expect(
      options.primary.loadWorkflowSnapshot({ workflowName: options.workflowName, runId: runIds.ordinary }),
    ).resolves.toMatchObject({
      status: 'suspended',
      value: { winner: ordinaryWinner },
      lifecycleResumeAttempt: 1,
    });

    const admission = admissionFor(runIds.main);
    await options.primary.persistWorkflowSnapshot({
      workflowName: options.workflowName,
      runId: runIds.main,
      resourceId,
      snapshot: suspendedSnapshot(runIds.main, resourceId),
    });
    const concurrentAdmissions = await Promise.all([
      options.primary.admitWorkflowResume(admission),
      secondary.admitWorkflowResume(admission),
    ]);
    expect(concurrentAdmissions.map(result => result.status).sort()).toEqual(['admitted', 'already_admitted']);

    await expect(
      secondary.admitWorkflowResume({
        ...admission,
        resumeOperationHash: materializeWorkflowResumeOperationHash({ step: 'wait', payload: { approved: false } }),
      }),
    ).resolves.toEqual({ status: 'operation_conflict' });

    const admitted = await options.primary.loadWorkflowSnapshot({
      workflowName: options.workflowName,
      runId: runIds.main,
    });
    expect(admitted).toMatchObject({
      status: 'running',
      resourceId,
      requestContext: { tenant: 'Tenant-Case-Sensitive' },
      lifecycleResumeAttempt: 1,
      resumeCheckpoint: {
        operationReplayContext: { version: 1, steps: ['wait'], resumePath: [0] },
        snapshot: { status: 'suspended', resourceId },
      },
    });

    const sameFinalization = finalizationFor(admission, admitted!, 'receipt:atomic-resume-contract', 'same');
    const sameFinalizations = await Promise.all([
      options.primary.finalizeWorkflowResume(sameFinalization),
      secondary.finalizeWorkflowResume(sameFinalization),
    ]);
    expect(sameFinalizations.map(result => result.status).sort()).toEqual(['already_finalized', 'finalized']);

    await expect(
      secondary.persistWorkflowStepUpdate({
        workflowName: options.workflowName,
        runId: runIds.main,
        resourceId: 'stale-resource',
        expectedResumeOperationHash: admission.resumeOperationHash,
        expectedExecutionGeneration: admission.executionGeneration,
        expectedLifecycleResumeAttempt: 1,
        snapshot: { ...admitted!, status: 'running', value: { stale: 'true' } },
      }),
    ).resolves.toEqual({ status: 'finalized', disposition: 'superseded' });

    const missingAdmission = admissionFor(runIds.missing);
    await expect(
      secondary.persistWorkflowStepUpdate({
        workflowName: options.workflowName,
        runId: runIds.missing,
        resourceId,
        expectedResumeOperationHash: missingAdmission.resumeOperationHash,
        expectedExecutionGeneration: missingAdmission.executionGeneration,
        expectedLifecycleResumeAttempt: 1,
        snapshot: { ...suspendedSnapshot(runIds.missing, resourceId), status: 'running', lifecycleResumeAttempt: 1 },
      }),
    ).resolves.toEqual({ status: 'missing_run' });
    await expect(
      options.primary.loadWorkflowSnapshot({ workflowName: options.workflowName, runId: runIds.missing }),
    ).resolves.toBeNull();

    const consumeInput = {
      workflowName: options.workflowName,
      runId: runIds.main,
      resumeOperationHash: admission.resumeOperationHash,
      executionGeneration: admission.executionGeneration,
      lifecycleResumeAttempt: 1,
      receiptKey: 'receipt:atomic-resume-contract',
      consumerId: 'consumer-1',
    } as const;
    const competingConsumes = await Promise.all([
      options.primary.consumeWorkflowResumeResult(consumeInput),
      secondary.consumeWorkflowResumeResult({ ...consumeInput, consumerId: 'consumer-2' }),
    ]);
    expect(competingConsumes.map(result => result.status).sort()).toEqual(['consumed', 'receipt_conflict']);
    const winningConsume = competingConsumes.find(result => result.status === 'consumed');
    expect(winningConsume).toMatchObject({ receipt: { result: { status: 'success' } } });
    const winningConsumer = winningConsume?.status === 'consumed' ? winningConsume.receipt.consumedBy : undefined;
    expect(winningConsumer).toMatch(/^consumer-[12]$/);

    await expect(
      options.primary.loadWorkflowSnapshot({ workflowName: options.workflowName, runId: runIds.main }),
    ).resolves.toMatchObject({
      status: 'suspended',
      resourceId,
      lifecycleResumeAttempt: 1,
      resumeResultReceipt: { receiptKey: 'receipt:atomic-resume-contract', consumedBy: winningConsumer },
    });

    const conflicting = await seedAndAdmit(runIds.conflict);
    const receiptKeys = ['receipt:conflict-a', 'receipt:conflict-b'] as const;
    const conflictingFinalizations = await Promise.all([
      options.primary.finalizeWorkflowResume(
        finalizationFor(conflicting.admission, conflicting.admitted, receiptKeys[0], 'a'),
      ),
      secondary.finalizeWorkflowResume(
        finalizationFor(conflicting.admission, conflicting.admitted, receiptKeys[1], 'b'),
      ),
    ]);
    expect(conflictingFinalizations.map(result => result.status).sort()).toEqual(['finalized', 'receipt_conflict']);
    const winningFinalizationIndex = conflictingFinalizations.findIndex(result => result.status === 'finalized');
    await expect(
      options.primary.loadWorkflowSnapshot({ workflowName: options.workflowName, runId: runIds.conflict }),
    ).resolves.toMatchObject({
      resumeResultReceipt: {
        receiptKey: receiptKeys[winningFinalizationIndex],
        result: { result: { winner: winningFinalizationIndex === 0 ? 'a' : 'b' } },
      },
    });

    const rollback = await seedAndAdmit(runIds.rollback);
    await expect(options.primary.rollbackWorkflowResume(rollbackFor(rollback.admission))).resolves.toEqual({
      status: 'rolled_back',
    });
    await expect(secondary.rollbackWorkflowResume(rollbackFor(rollback.admission))).resolves.toEqual({
      status: 'already_rolled_back',
    });

    const race = await seedAndAdmit(runIds.race);
    const raceResults = await Promise.all([
      options.primary.rollbackWorkflowResume(rollbackFor(race.admission)),
      secondary.finalizeWorkflowResume(finalizationFor(race.admission, race.admitted, 'receipt:race', 'finalize')),
    ]);
    const raceSnapshot = await options.primary.loadWorkflowSnapshot({
      workflowName: options.workflowName,
      runId: runIds.race,
    });
    if (raceResults[0].status === 'rolled_back') {
      expect(raceResults[1]).toEqual({ status: 'checkpoint_conflict' });
      expect(raceSnapshot).toMatchObject({
        status: 'suspended',
        resumeRollbackReceipt: { resumeOperationHash: race.admission.resumeOperationHash },
      });
      expect(raceSnapshot).not.toHaveProperty('resumeResultReceipt');
    } else {
      expect(raceResults).toMatchObject([{ status: 'checkpoint_conflict' }, { status: 'finalized' }]);
      expect(raceSnapshot).toMatchObject({ resumeResultReceipt: { receiptKey: 'receipt:race' } });
      expect(raceSnapshot).not.toHaveProperty('resumeRollbackReceipt');
    }

    await options.primary.persistWorkflowSnapshot({
      workflowName: options.workflowName,
      runId: runIds.skipped,
      resourceId,
      snapshot: { ...suspendedSnapshot(runIds.skipped, resourceId), status: 'skipped' },
    });
    await expect(
      secondary.persistWorkflowStepUpdate({
        workflowName: options.workflowName,
        runId: runIds.skipped,
        expectedExecutionGeneration: 'wfeg:atomic-resume-contract',
        expectedLifecycleResumeAttempt: 0,
        snapshot: { ...suspendedSnapshot(runIds.skipped, resourceId), status: 'running' },
      }),
    ).resolves.toEqual({ status: 'finalized', disposition: 'skipped' });
  } finally {
    await Promise.all(
      Object.values(runIds).map(runId =>
        options.primary.deleteWorkflowRunById({ workflowName: options.workflowName, runId }),
      ),
    );
  }
}

import type { MastraCompositeStore } from '../../../storage/base';

/**
 * Stores the run's `waiting` sleep the way it was stored before sleeps kept
 * their wake time, as a run that slept across an upgrade has it.
 */
export async function forgetWakeTime(
  storage: MastraCompositeStore,
  workflowName: string,
  runId: string,
): Promise<void> {
  const store = (await storage.getStore('workflows'))!;
  const snapshot = (await store.loadWorkflowSnapshot({ workflowName, runId }))!;
  for (const result of Object.values(snapshot.context) as { status?: string; metadata?: unknown }[]) {
    if (result?.status === 'waiting') {
      delete result.metadata;
    }
  }

  await store.persistWorkflowSnapshot({ workflowName, runId, snapshot });
}

/**
 * The `<runId>::ended` marker a run's end leaves behind (see
 * {@link runEndedKey}), cleared when the run starts again.
 */
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import { LATE_DELIVERY_MARKER_TTL_MS, runEndedKey } from './keys';

/**
 * Releases a live `<runId>::ended` claim, so a run that starts again under the
 * same run ID (a time travel, a resume, a reused run ID) is not read as the
 * run that ended.
 */
export async function clearRunEnded(store: WorkflowsStorage, runId: string): Promise<void> {
  const key = runEndedKey(runId);
  if (!(await store.getRunOwnership({ runId: key }))?.live) {
    return;
  }

  const claim = await store.claimRunOwnership({
    runId: key,
    ownerId: globalThis.crypto.randomUUID(),
    leaseMs: LATE_DELIVERY_MARKER_TTL_MS,
    force: true,
  });
  if (claim.acquired) {
    const { generation, ownerId } = claim.record;
    await store.releaseRunOwnership({ runId: key, generation, ownerId });
  }
}

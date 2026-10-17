/**
 * Shared run-ownership model for agent runs.
 *
 * - The stored agentic-loop row decides a run's state. A lease only says a live
 *   process is still driving the run.
 * - Lease owners are `<holderId>/<runId>`, so two processes driving the same run
 *   never share an owner token.
 * - One lease TTL source: `MASTRA_AGENT_THREAD_LEASE_TTL_MS`.
 */
import type { Mastra } from '../mastra';
import { readPositiveIntEnv } from '../utils';
import type { WorkflowRunStatus } from '../workflows/types';
import { DurableStepIds } from './durable/constants';

/**
 * Lease TTL for agent run leases. Kept short so a crashed owner frees the
 * thread quickly; the owner renews it while the run is live. Overridable via
 * `MASTRA_AGENT_THREAD_LEASE_TTL_MS` (15s default).
 */
export const AGENT_LEASE_TTL_MS = readPositiveIntEnv('MASTRA_AGENT_THREAD_LEASE_TTL_MS', 15_000);

/**
 * Interval at which an owner renews its lease. Defaults to TTL/3, leaving room
 * for two missed renewals before the lease expires. Overridable via
 * `MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS`.
 */
export const AGENT_LEASE_RENEW_INTERVAL_MS = readPositiveIntEnv(
  'MASTRA_AGENT_THREAD_LEASE_RENEW_INTERVAL_MS',
  Math.floor(AGENT_LEASE_TTL_MS / 3),
);

export function formatLeaseOwner(holderId: string, runId: string): string {
  return `${holderId}/${runId}`;
}

/** The runId in a lease owner token. A token without `/` is a legacy bare runId. */
export function leaseOwnerRunId(owner: string | undefined): string | undefined {
  if (owner === undefined) return undefined;
  const separator = owner.indexOf('/');
  return separator === -1 ? owner : owner.slice(separator + 1);
}

/**
 * - `running`: the run is still executing (or about to).
 * - `suspended`: the run is parked and can be resumed.
 * - `terminal`: the run ended.
 * - `missing`: no stored row. Plain agents have none while running, and durable
 *   runs drop theirs after finishing, so this alone does not mean "ended".
 * - `unknown`: no storage, or the read failed.
 */
export type StoredRunStatus = 'running' | 'suspended' | 'terminal' | 'missing' | 'unknown';

const AGENTIC_LOOP_WORKFLOW_NAMES = ['agentic-loop', DurableStepIds.AGENTIC_LOOP];

function mapStatus(status: WorkflowRunStatus | undefined): StoredRunStatus {
  switch (status) {
    case 'running':
    case 'pending':
    case 'waiting':
      return 'running';
    case 'suspended':
    case 'paused':
      return 'suspended';
    case 'success':
    case 'failed':
    case 'canceled':
    case 'tripwire':
    case 'bailed':
    case 'skipped':
      return 'terminal';
    default:
      return 'unknown';
  }
}

/** Read the stored status of an agent run's agentic-loop row. Never throws. */
export async function readStoredRunStatus(
  mastra: Pick<Mastra, 'getStorage'> | undefined,
  runId: string,
): Promise<StoredRunStatus> {
  try {
    const workflowsStore = await mastra?.getStorage()?.getStore('workflows');
    if (!workflowsStore) return 'unknown';
    for (const workflowName of AGENTIC_LOOP_WORKFLOW_NAMES) {
      const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName, runId });
      if (snapshot) return mapStatus(snapshot.status);
    }
    return 'missing';
  } catch {
    return 'unknown';
  }
}

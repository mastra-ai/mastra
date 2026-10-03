import {
  RUN_FENCE_CONFLICT_ERROR_ID,
  RunFenceConflictError,
  TABLE_MEMORY_RUN_FENCES,
  TABLE_WORKFLOW_RUN_OWNERS,
} from '@mastra/core/storage';
import type {
  ClaimRunOwnershipInput,
  ClaimRunOwnershipResult,
  RenewRunOwnershipInput,
  RenewRunOwnershipResult,
  RunFence,
  RunOwnershipRecord,
} from '@mastra/core/storage';

import type { ConvexAdminClient, RawStorageResult } from './client';
import type { RunClaimRequest, RunClaimResult, RunClaimTable, StorageRequest, StoredRunClaim } from './types';

/** A write's fence, and the table holding the run's current claim to check it against. */
export interface RunFenceCheck {
  claims: RunClaimTable;
  fence: RunFence;
  operation: string;
}

/** The storage calls ConvexDB makes. */
export interface StorageCaller {
  callStorageRaw<T = any>(request: StorageRequest): Promise<RawStorageResult<T>>;
  callStorage<T = any>(request: StorageRequest): Promise<T>;
}

// Every other operation writes, so an operation added later is fenced unless
// it is listed here.
const READ_OPS = new Set<StorageRequest['op']>([
  'load',
  'loadMany',
  'queryTable',
  'omGetLatest',
  'omGetHistory',
  'listDueSchedules',
  'listScheduleTriggers',
]);

async function callRunClaim<T>(
  client: ConvexAdminClient,
  request: RunClaimRequest,
  operation: string,
): Promise<RawStorageResult<T>> {
  try {
    return await client.callStorageRaw<T>(request);
  } catch (error) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    if (code === RUN_FENCE_CONFLICT_ERROR_ID && request.op === 'fenced') {
      throw new RunFenceConflictError(request.fence, operation);
    }
    // A storage function deployed before run fencing routes these operations
    // to the generic table, which rejects them.
    if (typeof message === 'string' && message.startsWith(`Unsupported operation ${request.op}`)) {
      throw new Error(
        `The deployed Convex storage function does not support run fencing (${request.op}). ` +
          'Redeploy your Convex functions with the installed version of @mastra/convex.',
        { cause: error },
      );
    }
    throw error;
  }
}

/** Sends writes inside a fenced operation, so each is applied only while `check.fence` holds the run. */
class FencedStorageCaller implements StorageCaller {
  constructor(
    private readonly client: ConvexAdminClient,
    private readonly check: RunFenceCheck,
  ) {}

  callStorageRaw<T = any>(request: StorageRequest): Promise<RawStorageResult<T>> {
    if (READ_OPS.has(request.op)) return this.client.callStorageRaw<T>(request);
    return callRunClaim<T>(
      this.client,
      { op: 'fenced', tableName: this.check.claims, fence: toFence(this.check.fence), request },
      this.check.operation,
    );
  }

  async callStorage<T = any>(request: StorageRequest): Promise<T> {
    return (await this.callStorageRaw<T>(request)).result;
  }
}

/** The client, or one that fences every write when `check` is set. */
export function fencedCaller(client: ConvexAdminClient, check: RunFenceCheck | undefined): StorageCaller {
  return check ? new FencedStorageCaller(client, check) : client;
}

/**
 * Rejects a fenced write that turns out to have nothing to write when its
 * fence is no longer current, as the write itself would have been rejected.
 */
export async function assertRunFence(client: ConvexAdminClient, check: RunFenceCheck | undefined): Promise<void> {
  if (!check) return;
  await callRunClaim(client, { op: 'fenced', tableName: check.claims, fence: toFence(check.fence) }, check.operation);
}

// Sends only the fence's own fields, whatever else the caller's object holds.
function toFence({ runId, generation, ownerId }: RunFence): RunFence {
  return { runId, generation, ownerId };
}

function toRecord(claim: StoredRunClaim | null, now: number): RunOwnershipRecord | null {
  if (!claim) return null;
  const { runId, generation, ownerId, leaseExpiresAt } = claim;
  return {
    runId,
    generation,
    ownerId,
    leaseExpiresAt: leaseExpiresAt === null ? null : new Date(leaseExpiresAt),
    live: leaseExpiresAt !== null && leaseExpiresAt > now,
  };
}

async function ownerOperation(
  client: ConvexAdminClient,
  request: RunClaimRequest,
): Promise<{ applied: boolean; record: RunOwnershipRecord | null }> {
  const { result } = await callRunClaim<RunClaimResult>(client, request, request.op);
  return { applied: result.applied, record: toRecord(result.claim, result.now) };
}

export async function claimRunOwnership(
  client: ConvexAdminClient,
  { runId, ownerId, leaseMs, force, expectedGeneration }: ClaimRunOwnershipInput,
): Promise<ClaimRunOwnershipResult> {
  const { applied, record } = await ownerOperation(client, {
    op: 'claimRunOwnership',
    tableName: TABLE_WORKFLOW_RUN_OWNERS,
    runId,
    ownerId,
    leaseMs,
    force: force ?? false,
    ...(expectedGeneration !== undefined ? { expectedGeneration } : {}),
  });
  return applied ? { acquired: true, record: record! } : { acquired: false, record };
}

export async function renewRunOwnership(
  client: ConvexAdminClient,
  { leaseMs, ...fence }: RenewRunOwnershipInput,
): Promise<RenewRunOwnershipResult> {
  const { applied, record } = await ownerOperation(client, {
    op: 'renewRunOwnership',
    tableName: TABLE_WORKFLOW_RUN_OWNERS,
    fence: toFence(fence),
    leaseMs,
  });
  return applied ? { renewed: true, record: record! } : { renewed: false, record };
}

export async function releaseRunOwnership(client: ConvexAdminClient, fence: RunFence): Promise<boolean> {
  const { applied } = await ownerOperation(client, {
    op: 'releaseRunOwnership',
    tableName: TABLE_WORKFLOW_RUN_OWNERS,
    fence: toFence(fence),
  });
  return applied;
}

export async function getRunOwnership(client: ConvexAdminClient, runId: string): Promise<RunOwnershipRecord | null> {
  const { record } = await ownerOperation(client, {
    op: 'getRunOwnership',
    tableName: TABLE_WORKFLOW_RUN_OWNERS,
    runId,
  });
  return record;
}

export async function raiseRunFence(client: ConvexAdminClient, fence: RunFence): Promise<boolean> {
  const { applied } = await ownerOperation(client, {
    op: 'raiseRunFence',
    tableName: TABLE_MEMORY_RUN_FENCES,
    fence: toFence(fence),
  });
  return applied;
}

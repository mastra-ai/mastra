import type { GenericMutationCtx as MutationCtx } from 'convex/server';
import type { GenericId } from 'convex/values';

import type {
  RunClaimFence,
  RunClaimRequest,
  RunClaimResult,
  RunClaimTable,
  StorageRequest,
  StorageResponse,
  StoredRunClaim,
} from '../storage/types';

// Same value as core's RUN_FENCE_CONFLICT_ERROR_ID, which the client maps back
// to RunFenceConflictError.
export const RUN_FENCE_CONFLICT_CODE = 'STORAGE_RUN_FENCE_CONFLICT';

const RUN_CLAIM_OPS = new Set<string>([
  'claimRunOwnership',
  'renewRunOwnership',
  'releaseRunOwnership',
  'getRunOwnership',
  'raiseRunFence',
  'fenced',
]);
const RUN_CLAIM_TABLES = new Set<string>(['mastra_workflow_run_owners', 'mastra_memory_run_fences']);
const CLAIMS_TABLE = 'mastra_documents';

type ClaimDoc = { _id: GenericId<string>; record: StoredRunClaim };

export function isRunClaimRequest(request: StorageRequest | RunClaimRequest): request is RunClaimRequest {
  return RUN_CLAIM_OPS.has(request.op);
}

async function findClaim(ctx: MutationCtx<any>, table: RunClaimTable, runId: string): Promise<ClaimDoc | null> {
  return ctx.db
    .query(CLAIMS_TABLE)
    .withIndex('by_table_primary', (q: any) => q.eq('table', table).eq('primaryKey', runId))
    .unique();
}

async function writeClaim(
  ctx: MutationCtx<any>,
  table: RunClaimTable,
  doc: ClaimDoc | null,
  claim: StoredRunClaim,
): Promise<StoredRunClaim> {
  const record = { id: claim.runId, ...claim };
  if (doc) {
    await ctx.db.patch(doc._id, { record });
  } else {
    await ctx.db.insert(CLAIMS_TABLE, { table, primaryKey: claim.runId, record });
  }
  return claim;
}

function holds(claim: StoredRunClaim | null, fence: RunClaimFence): claim is StoredRunClaim {
  return claim !== null && claim.generation === fence.generation && claim.ownerId === fence.ownerId;
}

function reply(applied: boolean, claim: StoredRunClaim | null, now: number): StorageResponse {
  const result: RunClaimResult = { applied, claim, now };
  return { ok: true, result };
}

/**
 * Runs a run fencing operation. Each reads and writes the run's claim in the
 * calling mutation, so Convex serializes it against every other claim
 * operation and fenced write on the same run. Leases are measured on the
 * mutation's clock.
 *
 * `route` runs the request a fenced operation wraps.
 */
export async function handleRunClaimOperation(
  ctx: MutationCtx<any>,
  request: RunClaimRequest,
  route: (ctx: MutationCtx<any>, request: StorageRequest) => Promise<StorageResponse>,
): Promise<StorageResponse> {
  if (!RUN_CLAIM_TABLES.has(request.tableName)) {
    return { ok: false, error: `Unsupported run claim table ${request.tableName}` };
  }
  const now = Date.now();

  switch (request.op) {
    case 'claimRunOwnership': {
      const { tableName, runId, ownerId, leaseMs, force, expectedGeneration } = request;
      const doc = await findClaim(ctx, tableName, runId);
      const current = doc?.record ?? null;
      const leaseExpiresAt = now + leaseMs;
      if (!current) {
        if (expectedGeneration !== undefined && expectedGeneration !== 0) return reply(false, null, now);
        return reply(
          true,
          await writeClaim(ctx, tableName, doc, { runId, generation: 1, ownerId, leaseExpiresAt }),
          now,
        );
      }
      if (expectedGeneration !== undefined && current.generation !== expectedGeneration) {
        return reply(false, current, now);
      }
      if (!force && current.leaseExpiresAt !== null && current.leaseExpiresAt > now) {
        return reply(false, current, now);
      }
      const claim = { runId, generation: current.generation + 1, ownerId, leaseExpiresAt };
      return reply(true, await writeClaim(ctx, tableName, doc, claim), now);
    }

    case 'renewRunOwnership': {
      const { tableName, fence, leaseMs } = request;
      const doc = await findClaim(ctx, tableName, fence.runId);
      const current = doc?.record ?? null;
      if (!holds(current, fence) || current.leaseExpiresAt === null) return reply(false, current, now);
      return reply(true, await writeClaim(ctx, tableName, doc, { ...current, leaseExpiresAt: now + leaseMs }), now);
    }

    case 'releaseRunOwnership': {
      const { tableName, fence } = request;
      const doc = await findClaim(ctx, tableName, fence.runId);
      const current = doc?.record ?? null;
      if (!holds(current, fence)) return reply(false, current, now);
      return reply(true, await writeClaim(ctx, tableName, doc, { ...current, leaseExpiresAt: null }), now);
    }

    case 'getRunOwnership': {
      const doc = await findClaim(ctx, request.tableName, request.runId);
      return reply(true, doc?.record ?? null, now);
    }

    case 'raiseRunFence': {
      const { tableName, fence } = request;
      const doc = await findClaim(ctx, tableName, fence.runId);
      const current = doc?.record ?? null;
      if (!current || current.generation < fence.generation) {
        const claim = { ...fence, leaseExpiresAt: null };
        return reply(true, await writeClaim(ctx, tableName, doc, claim), now);
      }
      return reply(holds(current, fence), current, now);
    }

    case 'fenced': {
      const { tableName, fence, request: inner } = request;
      const doc = await findClaim(ctx, tableName, fence.runId);
      if (!holds(doc?.record ?? null, fence)) {
        return {
          ok: false,
          error: `Run ${fence.runId} is no longer claimed by generation ${fence.generation} of ${fence.ownerId}`,
          code: RUN_FENCE_CONFLICT_CODE,
        };
      }
      if (!inner) return { ok: true };
      if (RUN_CLAIM_OPS.has(inner.op)) {
        return { ok: false, error: `Unsupported fenced operation ${inner.op}` };
      }
      return route(ctx, inner);
    }
  }
}

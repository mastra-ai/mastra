import type { RunFence } from '@mastra/core/storage';
import { RunFenceConflictError } from '@mastra/core/storage';
import type { ClientSession, Collection } from 'mongodb';
import type { MongoDBConnector } from '../connectors/MongoDBConnector';

/** A write's fence, and the collection holding the run's current claim to check it against. */
export interface RunFenceCheck {
  claims: string;
  fence: RunFence;
  operation: string;
}

/**
 * A run's claim: its ownership document (workflows) or raised fence (memory),
 * keyed by runId.
 */
export interface RunClaimDocument {
  _id: string;
  generation: number;
  ownerId: string;
  leaseExpiresAt?: Date | null;
  fencedWrites?: number;
}

export async function getRunClaims(connector: MongoDBConnector, name: string): Promise<Collection<RunClaimDocument>> {
  // Connector collections are untyped, and their default schema keys documents by ObjectId.
  return (await connector.getCollection(name)) as unknown as Collection<RunClaimDocument>;
}

/** Duplicate-key error: an upsert lost the race to insert the document. */
export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 11000;
}

/**
 * Runs a write, fenced when `check` is set. A fenced write runs in a
 * transaction that first updates the run's claim document, matching it on
 * the fence. A fence that is no longer current matches nothing, and the write
 * throws `RunFenceConflictError` before anything is written. A claim that
 * changes while the transaction runs makes the update conflict, so the
 * transaction retries and sees the new claim; a claim attempted after the
 * update waits until the transaction commits. Updating the claim document,
 * rather than reading it, is what makes concurrent claims conflict.
 *
 * Fencing is declared only on deployments that support transactions.
 */
export async function withRunFence<T>(
  connector: MongoDBConnector,
  check: RunFenceCheck | undefined,
  write: (session?: ClientSession) => Promise<T>,
): Promise<T> {
  if (!check) return write();
  const { claims, fence, operation } = check;
  const collection = await getRunClaims(connector, claims);
  return connector.withTransaction(async session => {
    const touched = await collection.updateOne(
      { _id: fence.runId, generation: fence.generation, ownerId: fence.ownerId },
      { $inc: { fencedWrites: 1 } },
      { session },
    );
    if (touched.matchedCount === 0) throw new RunFenceConflictError(fence, operation);
    return write(session);
  });
}

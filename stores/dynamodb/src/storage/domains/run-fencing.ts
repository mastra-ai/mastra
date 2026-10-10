import type { RunFence } from '@mastra/core/storage';
import { matchesRunFence, RunFenceConflictError } from '@mastra/core/storage';
import type { Service } from 'electrodb';

/** Entity holding a run's current claim: its ownership item (workflows) or raised fence (memory). */
export type RunClaimEntity = 'workflow_run_owner' | 'memory_run_fence';

/** A write's fence, and the entity holding the run's current claim to check it against. */
export interface RunFenceCheck {
  claims: RunClaimEntity;
  fence: RunFence;
  operation: string;
}

/** An ElectroDB write chain, run on its own with `go()` or as a transaction item with `commit()`. */
export interface WriteChain {
  go(): Promise<unknown>;
  commit(): unknown;
}

interface CanceledItem {
  code?: string;
  message?: string;
}

const MAX_CONFLICT_RETRIES = 8;
const BASE_DELAY_MS = 20;

async function backoff(attempt: number): Promise<void> {
  const delay = BASE_DELAY_MS * 2 ** attempt;
  await new Promise(resolve => setTimeout(resolve, delay + Math.random() * delay * 0.5));
}

function hasErrorName(error: unknown, errorName: string): boolean {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const { name, code } = current as { name?: unknown; code?: unknown };
    if (name === errorName || code === errorName) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

function isTransactionConflict(error: unknown): boolean {
  return hasErrorName(error, 'TransactionConflictException');
}

/** Whether a write failed its condition, either directly or wrapped by ElectroDB. */
export function isConditionalCheckFailed(error: unknown): boolean {
  return hasErrorName(error, 'ConditionalCheckFailedException');
}

/**
 * Runs a single-item write, retrying while a transaction is writing the same
 * item. DynamoDB rejects such a write with TransactionConflictException
 * instead of waiting for the transaction, and the SDK does not retry it.
 */
export async function retryOnTransactionConflict<T>(write: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write();
    } catch (error) {
      if (attempt >= MAX_CONFLICT_RETRIES || !isTransactionConflict(error)) throw error;
      await backoff(attempt);
    }
  }
}

/**
 * Rejects a fenced write that turns out to have nothing to write when its
 * fence is no longer current, as the write itself would have been rejected.
 */
export async function assertRunFence(
  service: Service<Record<string, any>>,
  check: RunFenceCheck | undefined,
): Promise<void> {
  if (!check) return;
  const { claims, fence, operation } = check;
  const { data } = await service.entities[claims]!.get({ entity: claims, run_id: fence.runId }).go({
    consistent: true,
  });
  if (!matchesRunFence(data, fence)) throw new RunFenceConflictError(fence, operation);
}

/**
 * Runs a write, fenced when `check` is set. A fenced write is a transaction
 * whose first item is a condition check on the run's claim, matching it on
 * the fence. A fence that is no longer current fails the check, and the write
 * throws `RunFenceConflictError` without writing anything. Transactions are
 * serializable with the single-item writes that claim a run, so a takeover
 * lands either before the transaction (failing its check) or after it.
 *
 * A fenced write whose own condition fails throws an error named
 * `ConditionalCheckFailedException`, as the unfenced write would.
 */
export async function goWithRunFence(
  service: Service<Record<string, any>>,
  check: RunFenceCheck | undefined,
  write: WriteChain,
): Promise<void> {
  if (!check) {
    await write.go();
    return;
  }
  const { claims, fence, operation } = check;
  for (let attempt = 0; ; attempt++) {
    const result = await service.transaction
      .write(entities => [
        entities[claims]!.check({ entity: claims, run_id: fence.runId })
          .where(
            (attr: any, op: any) =>
              `${op.eq(attr.generation, fence.generation)} AND ${op.eq(attr.ownerId, fence.ownerId)}`,
          )
          .commit(),
        write.commit() as any,
      ])
      .go();
    if (!result.canceled) return;

    const [claim, target] = result.data as CanceledItem[];
    if (claim?.code === 'ConditionalCheckFailed') throw new RunFenceConflictError(fence, operation);
    if (target?.code === 'ConditionalCheckFailed') {
      const error = new Error(target.message ?? 'The conditional request failed');
      error.name = 'ConditionalCheckFailedException';
      throw error;
    }
    const reasons = (result.data as CanceledItem[]).map(item => item?.code ?? 'None');
    if (attempt >= MAX_CONFLICT_RETRIES || !reasons.includes('TransactionConflict')) {
      throw new Error(`DynamoDB canceled the fenced ${operation} transaction: ${reasons.join(', ')}`);
    }
    await backoff(attempt);
  }
}

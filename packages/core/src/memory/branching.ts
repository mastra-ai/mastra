import { ErrorCategory, ErrorDomain, MastraError } from '../error';

export type {
  BranchThreadInput,
  BranchThreadOutput,
  GetThreadBranchInput,
  InternalThreadBranchMetadata,
  ListThreadBranchesInput,
  ListThreadBranchesOutput,
  PublicThreadBranchMetadata,
  ThreadBranchHistoryOutput,
} from '../storage/types';

/** @internal Framework-owned thread metadata key used for shared-history lineage. */
export const MASTRA_THREAD_BRANCH_METADATA_KEY = '__mastra_thread_branch';
/**
 * @internal Top-level copies of a branch's parent thread ID and state, so storage can find a
 * thread's branches with a `listThreads` metadata filter instead of loading every thread.
 */
export const MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY = '__mastra_thread_branch_parent';
/** @internal See {@link MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY}. */
export const MASTRA_THREAD_BRANCH_STATE_METADATA_KEY = '__mastra_thread_branch_state';
/** @internal Every thread metadata key Mastra owns for shared-history lineage. */
export const MASTRA_THREAD_BRANCH_METADATA_KEYS = [
  MASTRA_THREAD_BRANCH_METADATA_KEY,
  MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY,
  MASTRA_THREAD_BRANCH_STATE_METADATA_KEY,
] as const;
const MASTRA_MEMORY_TOKEN_LIMITER_METADATA_KEY = 'memoryTokenLimiter';

export type ThreadBranchErrorCode =
  | 'BRANCHING_UNSUPPORTED'
  | 'BRANCH_INVALID_REQUEST'
  | 'BRANCH_NOT_FOUND'
  | 'BRANCH_LINEAGE_CORRUPT'
  | 'BRANCH_MUTATION_CONFLICT';

export function createThreadBranchError(code: ThreadBranchErrorCode, text: string): MastraError {
  return new MastraError({
    id: code,
    domain: ErrorDomain.MASTRA_MEMORY,
    category: ErrorCategory.USER,
    text,
  });
}

export function assertNoReservedThreadBranchMetadata(metadata?: Record<string, unknown>): void {
  if (!metadata) return;

  const reservedKey = [...MASTRA_THREAD_BRANCH_METADATA_KEYS, MASTRA_MEMORY_TOKEN_LIMITER_METADATA_KEY].find(key =>
    Object.prototype.hasOwnProperty.call(metadata, key),
  );
  if (reservedKey) {
    throw createThreadBranchError(
      'BRANCH_MUTATION_CONFLICT',
      `Thread metadata key "${reservedKey}" is reserved for Mastra-managed memory state.`,
    );
  }
}

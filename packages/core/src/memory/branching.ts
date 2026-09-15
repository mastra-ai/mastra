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
  if (metadata && Object.prototype.hasOwnProperty.call(metadata, MASTRA_THREAD_BRANCH_METADATA_KEY)) {
    throw createThreadBranchError(
      'BRANCH_MUTATION_CONFLICT',
      `Thread metadata key "${MASTRA_THREAD_BRANCH_METADATA_KEY}" is reserved for Mastra-managed branch lineage.`,
    );
  }
}

/**
 * Thread-branching helpers copied from @mastra/core instead of imported from it.
 *
 * @mastra/memory's peer range admits @mastra/core versions that predate thread branching and have no
 * `@mastra/core/memory/internal` subpath. Importing these values from core would crash a published
 * memory build during ESM instantiation on those versions, before user code runs.
 *
 * Keep in sync with packages/core/src/memory/branching.ts and packages/core/src/memory/internal.ts
 * until the peer range can be tightened.
 */
import type { MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMemory, MemoryConfig, StorageThreadType } from '@mastra/core/memory';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { PaginationInfo } from '@mastra/core/storage';

// Type copies: the published declarations must not reference branch types that older @mastra/core
// versions lack, or they would resolve to `any` and drop type checking of the branch API.

export type ThreadBranchErrorCode =
  | 'BRANCHING_UNSUPPORTED'
  | 'BRANCH_INVALID_REQUEST'
  | 'BRANCH_NOT_FOUND'
  | 'BRANCH_LINEAGE_CORRUPT'
  | 'BRANCH_MUTATION_CONFLICT';

export type BranchThreadInput = {
  threadId: string;
  branchPointMessageId: string;
  title?: string;
  metadata?: Record<string, unknown>;
};

export type PublicThreadBranchMetadata = {
  parentThreadId: string;
  branchPointMessageId: string;
  branchPointCreatedAt: Date;
  branchCreatedAt: Date;
};

/** @internal Framework-owned branch state persisted in thread metadata. */
export type InternalThreadBranchMetadata = PublicThreadBranchMetadata & {
  observationalMemoryThreadId: string;
  state: 'pending' | 'ready';
};

export type BranchThreadOutput = {
  thread: StorageThreadType;
  branch: PublicThreadBranchMetadata;
};

export type GetThreadBranchInput = {
  threadId: string;
};

export type ListThreadBranchesInput = {
  threadId: string;
  page?: number;
  perPage?: number | false;
};

export type ListThreadBranchesOutput = PaginationInfo & {
  branches: BranchThreadOutput[];
};

export type ThreadBranchHistoryOutput = {
  history: Array<{
    thread: StorageThreadType;
    branch: PublicThreadBranchMetadata | null;
  }>;
};

export type GeneratedMessagePersistenceInput = {
  messages: MastraDBMessage[];
  memoryConfig?: MemoryConfig;
  observabilityContext?: Partial<ObservabilityContext>;
  /** @internal See `MastraMemory.saveMessages`. */
  embeddedMessages?: Map<string, string>;
  /** @internal Thread to create atomically with validated message persistence when absent. */
  thread?: StorageThreadType;
  /** @internal Reject when `thread` already exists instead of persisting into it. */
  requireThreadCreation?: boolean;
  /** @internal Store the messages without writing semantic recall vectors; the SemanticRecall processor writes them. */
  skipVectors?: boolean;
};

export const MASTRA_THREAD_BRANCH_METADATA_KEY = '__mastra_thread_branch';
export const MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY = '__mastra_thread_branch_parent';
export const MASTRA_THREAD_BRANCH_STATE_METADATA_KEY = '__mastra_thread_branch_state';
export const MASTRA_THREAD_BRANCH_METADATA_KEYS = [
  MASTRA_THREAD_BRANCH_METADATA_KEY,
  MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY,
  MASTRA_THREAD_BRANCH_STATE_METADATA_KEY,
] as const;
const MASTRA_MEMORY_TOKEN_LIMITER_METADATA_KEY = 'memoryTokenLimiter';

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

const GENERATED_MESSAGE_PERSISTENCE_HOOK = '__mastraPersistGeneratedMessages';

function assertGeneratedMessageIds(input: GeneratedMessagePersistenceInput, generatedMessageIds: readonly string[]) {
  const inputIds = input.messages.map(message => message.id);
  if (inputIds.some(id => !id) || new Set(inputIds).size !== inputIds.length) {
    throw new Error('Generated message persistence requires every input message ID to be present exactly once.');
  }
  if (new Set(generatedMessageIds).size !== generatedMessageIds.length) {
    throw new Error('Generated message persistence received duplicate generated message IDs.');
  }
  const inputIdSet = new Set(inputIds);
  if (generatedMessageIds.some(id => !inputIdSet.has(id))) {
    throw new Error('Generated message persistence received an unknown generated message ID.');
  }
}

function getGeneratedMessagePersistenceHook(memory: MastraMemory) {
  return (memory as unknown as Record<string, unknown>)[GENERATED_MESSAGE_PERSISTENCE_HOOK];
}

export async function persistGeneratedMessages(
  memory: MastraMemory,
  input: GeneratedMessagePersistenceInput,
  generatedMessageIds: readonly string[],
): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
  if (generatedMessageIds.length === 0) {
    const {
      thread: _thread,
      requireThreadCreation: _requireThreadCreation,
      skipVectors: _skipVectors,
      ...saveInput
    } = input;
    return memory.saveMessages(saveInput);
  }

  assertGeneratedMessageIds(input, generatedMessageIds);

  const hook = getGeneratedMessagePersistenceHook(memory);
  if (typeof hook !== 'function') {
    const {
      thread: _thread,
      requireThreadCreation: _requireThreadCreation,
      skipVectors: _skipVectors,
      ...saveInput
    } = input;
    return memory.saveMessages(saveInput);
  }
  return (
    hook as (
      input: GeneratedMessagePersistenceInput,
      generatedMessageIds: readonly string[],
    ) => ReturnType<MastraMemory['saveMessages']>
  ).call(memory, input, generatedMessageIds);
}

export async function persistMessagesWithThreadCreation(
  memory: MastraMemory,
  input: GeneratedMessagePersistenceInput,
  generatedMessageIds: readonly string[],
): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
  if (!input.thread) return persistGeneratedMessages(memory, input, generatedMessageIds);
  if (generatedMessageIds.length > 0) assertGeneratedMessageIds(input, generatedMessageIds);
  const hook = getGeneratedMessagePersistenceHook(memory);
  if (typeof hook !== 'function') {
    const {
      thread: _thread,
      requireThreadCreation: _requireThreadCreation,
      skipVectors: _skipVectors,
      ...saveInput
    } = input;
    return memory.saveMessages(saveInput);
  }
  return (
    hook as (
      input: GeneratedMessagePersistenceInput,
      generatedMessageIds: readonly string[],
    ) => ReturnType<MastraMemory['saveMessages']>
  ).call(memory, input, generatedMessageIds);
}

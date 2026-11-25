/**
 * Thread-branching helpers copied from @mastra/core instead of imported from it.
 *
 * @mastra/server's peer range admits @mastra/core versions that predate thread branching and have no
 * `@mastra/core/memory/internal` subpath. Importing these values from core would crash the server
 * during ESM instantiation on those versions. With the copies the server loads on any core in range:
 * branch routes report BRANCHING_UNSUPPORTED (memory without `supportsThreadBranching`), and ordinary
 * reads and writes take the same fallbacks core uses for memory without the branching hooks.
 *
 * Keep in sync with packages/core/src/memory/branching.ts and packages/core/src/memory/internal.ts
 * until the peer range can be tightened.
 */
import type { MastraDBMessage } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { MastraMemory, MemoryConfig, StorageThreadType } from '@mastra/core/memory';
import type { ObservabilityContext } from '@mastra/core/observability';

// Type copies: the published declarations must not reference branch types that older @mastra/core
// versions lack, or they would resolve to `any` and drop type checking.

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

export type BranchThreadOutput = {
  thread: StorageThreadType;
  branch: PublicThreadBranchMetadata;
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

export type InternalThreadBranchState = {
  state: 'absent' | 'ordinary' | 'pending' | 'ready';
  hasReadyDescendants: boolean;
};

export type InternalThreadBranchAuthorizationCandidate = {
  id: string;
  resourceId?: string;
};

export const MASTRA_THREAD_BRANCH_METADATA_KEY = '__mastra_thread_branch';
export const MASTRA_THREAD_BRANCH_METADATA_KEYS = [
  MASTRA_THREAD_BRANCH_METADATA_KEY,
  '__mastra_thread_branch_parent',
  '__mastra_thread_branch_state',
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
const GENERATED_BRANCH_PERSISTENCE_HOOK = '__mastraBranchThreadWithGeneratedId';
const THREAD_BRANCH_STATE_HOOK = '__mastraInspectThreadBranchState';
const THREAD_BRANCH_AUTHORIZATION_CANDIDATES_HOOK = '__mastraGetThreadBranchAuthorizationCandidates';

function getHook(memory: MastraMemory, name: string): unknown {
  return (memory as unknown as Record<string, unknown>)[name];
}

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

export async function persistGeneratedMessages(
  memory: MastraMemory,
  input: GeneratedMessagePersistenceInput,
  generatedMessageIds: readonly string[],
): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
  if (generatedMessageIds.length > 0) assertGeneratedMessageIds(input, generatedMessageIds);
  const hook = generatedMessageIds.length > 0 ? getHook(memory, GENERATED_MESSAGE_PERSISTENCE_HOOK) : undefined;
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
  const hook = getHook(memory, GENERATED_MESSAGE_PERSISTENCE_HOOK);
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

export async function getThreadBranchAuthorizationCandidates(
  memory: MastraMemory,
  threadId: string,
  direction: 'ancestors' | 'children' | 'descendants',
): Promise<InternalThreadBranchAuthorizationCandidate[]> {
  const hook = getHook(memory, THREAD_BRANCH_AUTHORIZATION_CANDIDATES_HOOK);
  if (typeof hook !== 'function') {
    if (memory.supportsThreadBranching) {
      throw createThreadBranchError(
        'BRANCHING_UNSUPPORTED',
        'The configured memory does not support pre-validation branch authorization.',
      );
    }
    const thread = await memory.getThreadById({ threadId });
    return thread ? [{ id: thread.id, resourceId: thread.resourceId }] : [];
  }
  return (
    hook as (
      threadId: string,
      direction: 'ancestors' | 'children' | 'descendants',
    ) => Promise<InternalThreadBranchAuthorizationCandidate[]>
  ).call(memory, threadId, direction);
}

export async function inspectThreadBranchState(
  memory: MastraMemory,
  threadId: string,
): Promise<InternalThreadBranchState> {
  const hook = getHook(memory, THREAD_BRANCH_STATE_HOOK);
  if (typeof hook !== 'function') {
    const thread = await memory.getThreadById({ threadId });
    return { state: thread ? 'ordinary' : 'absent', hasReadyDescendants: false };
  }
  return (hook as (threadId: string) => Promise<InternalThreadBranchState>).call(memory, threadId);
}

export async function branchThreadWithGeneratedId(
  memory: MastraMemory,
  input: BranchThreadInput & { generatedThreadId: string },
): Promise<BranchThreadOutput> {
  const hook = getHook(memory, GENERATED_BRANCH_PERSISTENCE_HOOK);
  if (typeof hook !== 'function') {
    throw new Error('The configured memory does not support transport-authorized branch creation.');
  }
  return (hook as (input: BranchThreadInput & { generatedThreadId: string }) => Promise<BranchThreadOutput>).call(
    memory,
    input,
  );
}

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
import type { MastraMemory, ThreadBranchErrorCode } from '@mastra/core/memory';
import type { GeneratedMessagePersistenceInput } from '@mastra/core/memory/internal';

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

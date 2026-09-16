import type { MastraDBMessage } from '../agent/message-list';
import type { ObservabilityContext } from '../observability';
import type { BranchThreadInput, BranchThreadOutput } from '../storage/types';

import { createThreadBranchError } from './branching';
import type { MastraMemory } from './memory';
import type { MemoryConfig, StorageThreadType } from './types';

export type GeneratedMessagePersistenceInput = {
  messages: MastraDBMessage[];
  memoryConfig?: MemoryConfig;
  observabilityContext?: Partial<ObservabilityContext>;
  /** @internal Thread to create atomically with validated message persistence when absent. */
  thread?: StorageThreadType;
  /** @internal Reject when `thread` already exists instead of persisting into it. */
  requireThreadCreation?: boolean;
};

const GENERATED_MESSAGE_PERSISTENCE_HOOK = '__mastraPersistGeneratedMessages';
const GENERATED_BRANCH_PERSISTENCE_HOOK = '__mastraBranchThreadWithGeneratedId';
const THREAD_BRANCH_STATE_HOOK = '__mastraInspectThreadBranchState';
const THREAD_BRANCH_AUTHORIZATION_CANDIDATES_HOOK = '__mastraGetThreadBranchAuthorizationCandidates';

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

/**
 * Persists framework-generated messages while preserving deterministic lineage ordering.
 *
 * @internal This unsupported subpath exists only for Mastra framework packages. It is not a security boundary.
 */
export async function persistGeneratedMessages(
  memory: MastraMemory,
  input: GeneratedMessagePersistenceInput,
  generatedMessageIds: readonly string[],
): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
  if (generatedMessageIds.length === 0) {
    const { thread: _thread, requireThreadCreation: _requireThreadCreation, ...saveInput } = input;
    return memory.saveMessages(saveInput);
  }

  assertGeneratedMessageIds(input, generatedMessageIds);

  const hook = getGeneratedMessagePersistenceHook(memory);
  if (typeof hook !== 'function') {
    const { thread: _thread, requireThreadCreation: _requireThreadCreation, ...saveInput } = input;
    return memory.saveMessages(saveInput);
  }
  return (
    hook as (
      input: GeneratedMessagePersistenceInput,
      generatedMessageIds: readonly string[],
    ) => ReturnType<MastraMemory['saveMessages']>
  ).call(memory, input, generatedMessageIds);
}

/** @internal Persists messages and atomically creates the supplied thread in branching-capable Memory implementations. */
export async function persistMessagesWithThreadCreation(
  memory: MastraMemory,
  input: GeneratedMessagePersistenceInput,
  generatedMessageIds: readonly string[],
): Promise<{ messages: MastraDBMessage[]; usage?: { tokens: number } }> {
  if (!input.thread) return persistGeneratedMessages(memory, input, generatedMessageIds);
  if (generatedMessageIds.length > 0) assertGeneratedMessageIds(input, generatedMessageIds);
  const hook = getGeneratedMessagePersistenceHook(memory);
  if (typeof hook !== 'function') {
    const { thread: _thread, requireThreadCreation: _requireThreadCreation, ...saveInput } = input;
    return memory.saveMessages(saveInput);
  }
  return (
    hook as (
      input: GeneratedMessagePersistenceInput,
      generatedMessageIds: readonly string[],
    ) => ReturnType<MastraMemory['saveMessages']>
  ).call(memory, input, generatedMessageIds);
}

export type InternalThreadBranchState = {
  state: 'absent' | 'ordinary' | 'pending' | 'ready';
  hasReadyDescendants: boolean;
};

export type InternalThreadBranchAuthorizationCandidate = {
  id: string;
  resourceId?: string;
};

/** @internal Returns raw relationship candidates so transports can authorize them before strict lineage validation. */
export async function getThreadBranchAuthorizationCandidates(
  memory: MastraMemory,
  threadId: string,
  direction: 'ancestors' | 'children' | 'descendants',
): Promise<InternalThreadBranchAuthorizationCandidate[]> {
  const hook = (memory as unknown as Record<string, unknown>)[THREAD_BRANCH_AUTHORIZATION_CANDIDATES_HOOK];
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

/** @internal Reports physical branch state without exposing reserved lineage metadata publicly. */
export async function inspectThreadBranchState(
  memory: MastraMemory,
  threadId: string,
): Promise<InternalThreadBranchState> {
  const hook = (memory as unknown as Record<string, unknown>)[THREAD_BRANCH_STATE_HOOK];
  if (typeof hook !== 'function') {
    const thread = await memory.getThreadById({ threadId });
    return { state: thread ? 'ordinary' : 'absent', hasReadyDescendants: false };
  }
  return (hook as (threadId: string) => Promise<InternalThreadBranchState>).call(memory, threadId);
}

/** @internal Creates a branch with a transport-authorized generated thread ID. */
export async function branchThreadWithGeneratedId(
  memory: MastraMemory,
  input: BranchThreadInput & { generatedThreadId: string },
): Promise<BranchThreadOutput> {
  const hook = (memory as unknown as Record<string, unknown>)[GENERATED_BRANCH_PERSISTENCE_HOOK];
  if (typeof hook !== 'function') {
    throw new Error('The configured memory does not support transport-authorized branch creation.');
  }
  return (hook as (input: BranchThreadInput & { generatedThreadId: string }) => Promise<BranchThreadOutput>).call(
    memory,
    input,
  );
}

import type { MastraDBMessage } from '../agent/message-list';
import type { ObservabilityContext } from '../observability';

import type { MastraMemory } from './memory';
import type { MemoryConfig, StorageThreadType } from './types';

export type GeneratedMessagePersistenceInput = {
  messages: MastraDBMessage[];
  memoryConfig?: MemoryConfig;
  observabilityContext?: Partial<ObservabilityContext>;
  /** @internal Thread to create atomically with validated message persistence when absent. */
  thread?: StorageThreadType;
};

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
    const { thread: _thread, ...saveInput } = input;
    return memory.saveMessages(saveInput);
  }

  assertGeneratedMessageIds(input, generatedMessageIds);

  const hook = getGeneratedMessagePersistenceHook(memory);
  if (typeof hook !== 'function') {
    const { thread: _thread, ...saveInput } = input;
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
    const { thread: _thread, ...saveInput } = input;
    return memory.saveMessages(saveInput);
  }
  return (
    hook as (
      input: GeneratedMessagePersistenceInput,
      generatedMessageIds: readonly string[],
    ) => ReturnType<MastraMemory['saveMessages']>
  ).call(memory, input, generatedMessageIds);
}

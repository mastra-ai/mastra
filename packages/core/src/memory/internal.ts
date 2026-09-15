import type { MastraDBMessage } from '../agent/message-list';
import type { ObservabilityContext } from '../observability';

import type { MastraMemory } from './memory';
import type { MemoryConfig } from './types';

export type GeneratedMessagePersistenceInput = {
  messages: MastraDBMessage[];
  memoryConfig?: MemoryConfig;
  observabilityContext?: Partial<ObservabilityContext>;
};

const GENERATED_MESSAGE_PERSISTENCE_HOOK = '__mastraPersistGeneratedMessages';

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
    return memory.saveMessages(input);
  }

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

  const hook = (memory as unknown as Record<string, unknown>)[GENERATED_MESSAGE_PERSISTENCE_HOOK];
  if (typeof hook !== 'function') {
    return memory.saveMessages(input);
  }
  return (
    hook as (
      input: GeneratedMessagePersistenceInput,
      generatedMessageIds: readonly string[],
    ) => ReturnType<MastraMemory['saveMessages']>
  ).call(memory, input, generatedMessageIds);
}

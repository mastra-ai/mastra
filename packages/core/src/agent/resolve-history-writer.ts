import type { MastraMemory } from '../memory/memory';
import { normalizeMessageHistoryConfig } from '../memory/message-history-config';
import { isObservationalMemoryEnabled } from '../memory/types';
import type { MemoryConfigInternal } from '../memory/types';
import type { OutputProcessorOrWorkflow } from '../processors';
import { isProcessorWorkflow } from '../processors/is-processor-workflow';
import type { MessageHistory } from '../processors/memory/message-history';

/**
 * Where a run's turn is saved when the run finishes normally.
 * - `memory`: memory's own MessageHistory processor writes to agent memory.
 * - `processor`: an explicitly configured MessageHistory writes, possibly to its own store.
 * - `none`: nothing writes the turn as history (history off, read-only memory, observational
 *   memory owns the writes, or a custom `message-history` processor without `persistMessages`).
 * @internal
 */
export type HistoryWriter =
  | { kind: 'none' }
  | { kind: 'memory' }
  | { kind: 'processor'; processor: Pick<MessageHistory, 'persistMessages'> };

/**
 * Mirrors Memory.getOutputProcessors: an explicitly configured MessageHistory always saves; memory
 * adds one only when history is enabled and observational memory does not own the writes.
 * @internal
 */
export function resolveHistoryWriter(
  memory: MastraMemory,
  memoryConfig: MemoryConfigInternal | undefined,
  configuredOutputProcessors: OutputProcessorOrWorkflow[],
): HistoryWriter {
  const effectiveConfig = memory.getMergedThreadConfig(memoryConfig);
  if (effectiveConfig.readOnly) return { kind: 'none' };
  const configured = (id: string) =>
    configuredOutputProcessors.find(p => !isProcessorWorkflow(p) && p.id === id) as
      | Partial<Pick<MessageHistory, 'persistMessages'>>
      | undefined;
  const configuredHistory = configured('message-history');
  if (configuredHistory) {
    // A custom processor using the message-history id replaces the built-in one, and the finish
    // path only saves through it. Without persistMessages there is nothing equivalent to call.
    return typeof configuredHistory.persistMessages === 'function'
      ? { kind: 'processor', processor: configuredHistory as Pick<MessageHistory, 'persistMessages'> }
      : { kind: 'none' };
  }
  const memoryAddsMessageHistory =
    normalizeMessageHistoryConfig(effectiveConfig.lastMessages, effectiveConfig.messageHistory).enabled &&
    !configured('observational-memory') &&
    !isObservationalMemoryEnabled(effectiveConfig.observationalMemory);
  return memoryAddsMessageHistory ? { kind: 'memory' } : { kind: 'none' };
}

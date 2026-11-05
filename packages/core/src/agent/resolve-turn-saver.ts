import type { MastraMemory } from '../memory/memory';
import { normalizeMessageHistoryConfig } from '../memory/message-history-config';
import { isObservationalMemoryEnabled } from '../memory/types';
import type { MemoryConfigInternal } from '../memory/types';
import type { OutputProcessorOrWorkflow } from '../processors';
import { isProcessorWorkflow } from '../processors/is-processor-workflow';
import type { MessageHistory } from '../processors/memory/message-history';

/**
 * What saves a run's turn to thread history.
 *
 * - `configured-history`: a MessageHistory the agent configured itself. It saves to its own
 *   storage, which may not be memory's.
 * - `memory`: memory's own store, through the MessageHistory processor memory adds, or through
 *   observational memory when that owns the writes (`observational`).
 */
export type TurnSaver =
  | { kind: 'configured-history'; processor: Pick<MessageHistory, 'persistMessages'> }
  | { kind: 'memory'; observational: boolean };

/**
 * Resolves what saves this run's turn, mirroring `Memory.getOutputProcessors`. Undefined when
 * nothing does: memory is read-only, history is off, a configured observational memory processor
 * saves through its own storage, or a custom processor took the `message-history` id without a
 * `persistMessages` to call.
 *
 * Every save made before the finish (the early save of a sent message, the save after a total
 * timeout) decides where to write from this one answer, so they cannot drift from each other or
 * from the finish path.
 */
export function resolveTurnSaver({
  memory,
  memoryConfig,
  configuredOutputProcessors,
}: {
  memory: MastraMemory;
  memoryConfig?: MemoryConfigInternal;
  /** The run's configured output processors, resolved once for the run. */
  configuredOutputProcessors: OutputProcessorOrWorkflow[];
}): TurnSaver | undefined {
  const config = memory.getMergedThreadConfig(memoryConfig);
  if (config.readOnly) return;

  const configured = (id: string) => configuredOutputProcessors.find(p => !isProcessorWorkflow(p) && p.id === id);
  const history = configured('message-history') as Partial<Pick<MessageHistory, 'persistMessages'>> | undefined;
  if (history) {
    return typeof history.persistMessages === 'function'
      ? { kind: 'configured-history', processor: history as Pick<MessageHistory, 'persistMessages'> }
      : undefined;
  }
  if (configured('observational-memory')) return;

  const observational = isObservationalMemoryEnabled(config.observationalMemory);
  if (!observational && !normalizeMessageHistoryConfig(config.lastMessages, config.messageHistory).enabled) return;
  return { kind: 'memory', observational };
}

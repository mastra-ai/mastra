import { isMastraGatewayModel } from '../llm/model/gateways/gateway-helpers';
import type { MastraLanguageModel } from '../llm/model/shared.types';
import type { IMastraLogger } from '../logger';
import type { MastraMemory } from '../memory/memory';
import type { MemoryConfigInternal } from '../memory/types';
import type { OutputProcessorOrWorkflow } from '../processors';
import { filterMessagesForPersistence } from './filter-messages-for-persistence';
import type { MastraDBMessage, MessageList } from './message-list';
import { resolveTurnSaver } from './resolve-turn-saver';
import { isUserAuthoredMessage } from './signals';

export type SaveAcceptedUserSignals = (messages: MastraDBMessage[], model: MastraLanguageModel) => Promise<void>;

/**
 * Saves messages a person sent (`user` signals) to the thread before the model request that
 * reads them, so a chat reloaded mid-run shows them; the turn's own save later overwrites the
 * rows by id. Undefined unless memory's own store saves the turn (see `resolveTurnSaver`): a
 * configured MessageHistory saves to its own storage, and its `persistMessages` marks the live
 * thread stream as saved up to now, which would drop streamed parts the turn has not stored yet.
 * Skipped for a Mastra gateway model under observational memory, which leaves the turn to the
 * gateway.
 *
 * Best effort: a failed save is logged and retried before the next model request, and the turn's
 * save still writes the messages with its own checks.
 */
export function createAcceptedUserSignalSaver({
  memory,
  memoryConfig,
  configuredOutputProcessors,
  messageList,
  authorizeWrite,
  logger,
  runId,
}: {
  memory: MastraMemory;
  memoryConfig?: MemoryConfigInternal;
  /** The run's configured output processors, resolved once for the run. */
  configuredOutputProcessors: OutputProcessorOrWorkflow[];
  messageList: MessageList;
  authorizeWrite: () => Promise<void>;
  logger: IMastraLogger;
  runId: string;
}): SaveAcceptedUserSignals | undefined {
  const saver = resolveTurnSaver({ memory, memoryConfig, configuredOutputProcessors });
  if (saver?.kind !== 'memory') return;

  const savedIds = new Set<string>();
  return async (messages, model) => {
    if (saver.observational && isMastraGatewayModel(model)) return;
    // Only signals: a `user` row sent to `generate` or `stream` keeps the end-of-turn contract,
    // including MessageHistory's guard against an input-only failed turn.
    const unsaved = filterMessagesForPersistence(
      messages.filter(m => m.role === 'signal' && isUserAuthoredMessage(m) && !savedIds.has(m.id)),
    );
    if (unsaved.length === 0) return;
    try {
      await authorizeWrite();
      // The store directly: memory.saveMessages would also index the message for semantic recall,
      // which the turn's save does under the message id, and MessageHistory.persistMessages would
      // mark the live thread stream as saved.
      const store = await memory.storage.getStore('memory');
      await store?.saveMessages({ messages: messageList.transformMessagesForTranscript(unsaved) });
      for (const message of unsaved) savedIds.add(message.id);
    } catch (error) {
      logger.warn('Could not save sent messages before the model request; retried at the next request', {
        error,
        runId,
      });
    }
  };
}

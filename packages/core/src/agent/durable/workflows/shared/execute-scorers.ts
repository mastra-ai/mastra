import type { MastraScorer, MastraScorerEntry } from '../../../../evals/base';
import { runScorer } from '../../../../evals/hooks';
import type { Mastra } from '../../../../mastra';
import { createObservabilityContext } from '../../../../observability';
import { RequestContext } from '../../../../request-context';
import { MessageList } from '../../../message-list';
import type { StoredMessageLoader } from '../../../message-list/memory-message-refs';
import type { DurableAgenticLoopOutput, DurableAgenticWorkflowInput } from '../../types';

export interface ExecuteDurableAgentScorersParams {
  /** Workflow init data, carrying the serialized scorer config and run identity. */
  initData: DurableAgenticWorkflowInput;
  /** The run's final output, carrying the response messages to score. */
  finalOutput: Pick<DurableAgenticLoopOutput, 'messageListState'>;
  mastra?: Mastra;
  requestContext?: RequestContext;
  tracingContext?: Parameters<typeof createObservabilityContext>[0];
  /** Loads response messages the run pruned from its transcript (kept there by id only) from memory. */
  loadStoredMessages?: StoredMessageLoader;
}

/**
 * Run an agent's configured scorers after a durable run completes.
 *
 * Every durable engine needs this, so it lives here rather than inside one
 * engine's workflow builder: the Inngest engine shipped without scorers purely
 * because its builder was a copy that missed a step core later added. Sharing
 * the implementation means a scorer change lands on every engine at once.
 *
 * Scoring is fire-and-forget and must never affect the run: scorers are
 * resolved by name from the Mastra instance (so this is safe on a worker in
 * another process), and anything that goes wrong is logged and skipped.
 */
export async function executeDurableAgentScorers({
  initData,
  finalOutput,
  mastra,
  requestContext,
  tracingContext,
  loadStoredMessages,
}: ExecuteDurableAgentScorersParams): Promise<void> {
  const scorers = initData.scorers;
  if (!scorers || Object.keys(scorers).length === 0) {
    return;
  }

  const logger = mastra?.getLogger?.();

  // Messages as they stood before generation are the scorer's input.
  const inputMessageList = new MessageList();
  inputMessageList.deserialize(initData.messageListState);

  const scorerInput = {
    inputMessages: inputMessageList.getPersisted.input.db(),
    rememberedMessages: inputMessageList.getPersisted.remembered.db(),
    systemMessages: inputMessageList.getSystemMessages(),
    taggedSystemMessages: inputMessageList.getPersisted.taggedSystemMessages,
  };

  const outputMessageList = new MessageList();
  outputMessageList.deserialize(finalOutput.messageListState);
  let scorerOutput: Awaited<ReturnType<MessageList['getRunResponseMessages']>>;
  try {
    scorerOutput = await outputMessageList.getRunResponseMessages(loadStoredMessages);
  } catch (error) {
    // Scoring is observability, not execution: never fail a run over it.
    logger?.warn?.('Skipped scorers: could not load pruned response messages', {
      error,
      runId: initData.runId,
    });
    return;
  }

  const resolveContext = requestContext ?? new RequestContext();

  for (const [scorerKey, scorerEntry] of Object.entries(scorers)) {
    const { scorerName, sampling, filter } = scorerEntry;

    try {
      // Scorers are serialized by name. `getScorerById` searches by id-or-name
      // without throwing on the common path, so try it first, then fall back to
      // the registration-key-keyed `getScorer` for older configs.
      let scorer: MastraScorer | undefined;
      try {
        scorer = mastra?.getScorerById?.(scorerName) as MastraScorer | undefined;
      } catch {
        scorer = undefined;
      }
      if (!scorer) {
        try {
          scorer = mastra?.getScorer?.(scorerName) as MastraScorer | undefined;
        } catch {
          scorer = undefined;
        }
      }

      if (!scorer) {
        logger?.warn?.(`Scorer ${scorerName} not found in Mastra, skipping`, {
          runId: initData.runId,
          scorerKey,
        });
        continue;
      }

      const scorerObject: MastraScorerEntry = {
        scorer,
        sampling,
        filter,
      };

      runScorer({
        mastra,
        runId: initData.runId,
        scorerId: scorerKey,
        scorerObject,
        input: scorerInput,
        output: scorerOutput,
        requestContext: resolveContext as any,
        entity: {
          id: initData.agentId,
          name: initData.agentName ?? initData.agentId,
        },
        structuredOutput: false,
        source: 'LIVE',
        entityType: 'AGENT',
        threadId: initData.state?.threadId,
        resourceId: initData.state?.resourceId,
        ...createObservabilityContext(tracingContext),
      });
    } catch (error) {
      // Scoring is observability, not execution: never fail a run over it.
      logger?.warn?.(`Error executing scorer ${scorerName}`, {
        error,
        runId: initData.runId,
        scorerKey,
      });
    }
  }
}

import type { MastraScorer, MastraScorerEntry } from '../../../evals/base';
import { runScorer } from '../../../evals/hooks';
import type { Mastra } from '../../../mastra';
import { createObservabilityContext } from '../../../observability';
import type { ExportedSpan, SpanType, TracingContext } from '../../../observability';
import { RequestContext } from '../../../request-context';
import { MessageList } from '../../message-list';
import type { DurableAgenticWorkflowInput, SerializableScorersConfig } from '../types';

/**
 * Execute the run's agent scorers (fire-and-forget) — the durable equivalent of the
 * non-durable scorer hooks. Shared by both durable engines' post-finish step: scorers
 * are serialized BY NAME on the workflow input and resolved from the Mastra instance,
 * so this is cross-process safe by construction. Historically only core's
 * `createDurableAgenticWorkflow` had this step — the Inngest engine finished runs
 * without ever running scorers.
 *
 * Scorer spans are parented under the run's rebuilt AGENT_RUN (when `agentSpanData`
 * is provided) for the same reason as the finish side effects: the terminal step's
 * own tracing context is an internal workflow span that is never exported.
 */
export async function runDurableScorers({
  initData,
  finalMessageListState,
  mastra,
  requestContext,
  tracingContext,
  agentSpanData,
  logger,
}: {
  initData: DurableAgenticWorkflowInput;
  /** FINAL serialized MessageList state (the terminal iteration's). */
  finalMessageListState: DurableAgenticWorkflowInput['messageListState'];
  mastra?: Mastra;
  requestContext?: RequestContext;
  tracingContext?: TracingContext;
  agentSpanData?: ExportedSpan<SpanType.AGENT_RUN>;
  logger?: { warn?: (...args: any[]) => void };
}): Promise<void> {
  const scorers = initData.scorers as SerializableScorersConfig | undefined;
  if (!scorers || Object.keys(scorers).length === 0) return;

  // Parent scorer spans under the run's AGENT_RUN (same rebuild as the finish
  // side effects; falls back to the step's tracingContext).
  let effectiveTracingContext = tracingContext;
  if (agentSpanData && mastra) {
    try {
      const observability = (mastra as any).observability?.getSelectedInstance?.({ requestContext });
      const rebuiltAgentSpan = observability?.rebuildSpan?.(agentSpanData);
      if (rebuiltAgentSpan) effectiveTracingContext = { currentSpan: rebuiltAgentSpan };
    } catch {
      /* fall back to the step's tracingContext */
    }
  }

  // Reconstruct input MessageList to extract scorer input
  const inputMessageList = new MessageList();
  inputMessageList.deserialize(initData.messageListState);

  // Build scorer input (messages before generation)
  const scorerInput = {
    inputMessages: inputMessageList.getPersisted.input.db(),
    rememberedMessages: inputMessageList.getPersisted.remembered.db(),
    systemMessages: inputMessageList.getSystemMessages(),
    taggedSystemMessages: inputMessageList.getPersisted.taggedSystemMessages,
  };

  // Reconstruct output MessageList to extract scorer output
  const outputMessageList = new MessageList();
  outputMessageList.deserialize(finalMessageListState);
  const scorerOutput = outputMessageList.getPersisted.response.db();

  const resolveContext = requestContext ?? new RequestContext();

  // Execute each scorer (fire-and-forget)
  for (const [scorerKey, scorerEntry] of Object.entries(scorers)) {
    const { scorerName, sampling } = scorerEntry;

    try {
      // Resolve the scorer from Mastra. We serialize scorers by name, and
      // `getScorerById` searches by id-or-name without throwing on the common
      // path, so try it first. Fall back to the registration-key-keyed
      // `getScorer` for older configs.
      let scorer: MastraScorer | undefined;
      try {
        scorer = (mastra as Mastra)?.getScorerById?.(scorerName) as MastraScorer | undefined;
      } catch {
        scorer = undefined;
      }
      if (!scorer) {
        try {
          scorer = (mastra as Mastra)?.getScorer?.(scorerName) as MastraScorer | undefined;
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

      // Create the scorer entry expected by runScorer
      const scorerObject: MastraScorerEntry = {
        scorer,
        sampling,
      };

      // Call runScorer (fire-and-forget via hooks)
      runScorer({
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
        ...createObservabilityContext(effectiveTracingContext),
      });
    } catch (error) {
      // Log but don't fail - scorer errors shouldn't affect main execution
      logger?.warn?.(`Error executing scorer ${scorerName}`, {
        error,
        runId: initData.runId,
        scorerKey,
      });
    }
  }
}

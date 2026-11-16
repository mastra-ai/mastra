import type { IMastraLogger } from '../../../logger';
import type { RequestContext } from '../../../request-context';
import type { AgentExecutionOptions } from '../../agent.types';
import type { SerializableDurableOptions } from '../types';

type PersistedCompletion = NonNullable<SerializableDurableOptions['isTaskComplete']>;
type CompletionPolicy = NonNullable<AgentExecutionOptions<any>['isTaskComplete']>;

/**
 * Rebuild a run's `isTaskComplete` policy in a process that did not prepare it
 * (recovery after a restart, or a worker that runs the completion step).
 * Scorers and `onComplete` cannot be serialized, so only a policy taken from
 * the agent defaults can be restored, and only when the defaults still resolve
 * to the same scorers. Anything else logs a warning and returns undefined.
 */
export async function restoreCompletionPolicy({
  agent,
  persisted,
  requestContext,
  runId,
  logger,
}: {
  agent: { getDefaultOptions(options?: { requestContext?: RequestContext }): unknown } | undefined;
  persisted: PersistedCompletion | undefined;
  requestContext: RequestContext;
  runId: string;
  logger?: IMastraLogger;
}): Promise<CompletionPolicy | undefined> {
  if (!persisted) return undefined;

  let configured: CompletionPolicy | undefined;
  if (persisted.fromAgentDefaults && agent) {
    try {
      const defaults = (await agent.getDefaultOptions({ requestContext })) as AgentExecutionOptions<any> | undefined;
      configured = defaults?.isTaskComplete;
    } catch (error) {
      logger?.warn?.(`[DurableAgent] Failed to resolve agent defaults for run ${runId}: ${error}`);
    }
  }

  const scorerIds = configured?.scorers?.map(scorer => scorer.id);
  if (
    !configured?.scorers ||
    !persisted.scorerIds ||
    JSON.stringify(scorerIds) !== JSON.stringify(persisted.scorerIds)
  ) {
    logger?.warn?.(`[DurableAgent] Cannot restore isTaskComplete for run ${runId}; completion checks will not run`);
    return undefined;
  }

  return {
    scorers: configured.scorers,
    onComplete: configured.onComplete,
    strategy: persisted.strategy,
    timeout: persisted.timeout,
    parallel: persisted.parallel,
    suppressFeedback: persisted.suppressFeedback,
  };
}

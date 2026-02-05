import { AvailableHooks, executeHook } from '../hooks';
import type { ObservabilityContext } from '../observability';
import type { MastraScorerEntry } from './base';
import type { ScoringEntityType, ScoringHookInput, ScoringSource } from './types';

export function runScorer({
  runId,
  scorerId,
  scorerObject,
  input,
  output,
  requestContext,
  entity,
  structuredOutput,
  source,
  entityType,
  threadId,
  resourceId,
  ...observabilityContext
}: {
  scorerId: string;
  scorerObject: MastraScorerEntry;
  runId: string;
  input: any;
  output: any;
  requestContext: Record<string, any>;
  entity: Record<string, any>;
  structuredOutput: boolean;
  source: ScoringSource;
  entityType: ScoringEntityType;
  threadId?: string;
  resourceId?: string;
} & ObservabilityContext) {
  let shouldExecute = false;

  if (!scorerObject?.sampling || scorerObject?.sampling?.type === 'none') {
    shouldExecute = true;
  }

  if (scorerObject?.sampling?.type) {
    switch (scorerObject?.sampling?.type) {
      case 'ratio':
        shouldExecute = Math.random() < scorerObject?.sampling?.rate;
        break;
      default:
        shouldExecute = true;
    }
  }

  if (!shouldExecute) {
    return;
  }

  const payload: ScoringHookInput = {
    scorer: {
      id: scorerObject.scorer?.id || scorerId,
      name: scorerObject.scorer?.name,
      description: scorerObject.scorer.description,
    },
    input,
    output,
    requestContext: Object.fromEntries(requestContext.entries()),
    runId,
    source,
    entity,
    structuredOutput,
    entityType,
    threadId,
    resourceId,
    ...observabilityContext,
  };

  executeHook(AvailableHooks.ON_SCORER_RUN, payload);
}

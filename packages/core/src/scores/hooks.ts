import type { TracingContext } from '../ai-tracing';
import { AvailableHooks, executeHook } from '../hooks';
import type { MastraScorerEntry } from './base';
import type { ScoringEntityType, ScoringHookInput, ScoringSource } from './types';

export function runScorer({
  runId,
  scorerId,
  scorerObject,
  input,
  output,
  runtimeContext,
  tracingContext,
  entity,
  structuredOutput,
  source,
  entityType,
  threadId,
  resourceId,
}: {
  scorerId: string;
  scorerObject: MastraScorerEntry;
  runId: string;
  input: any;
  output: any;
  runtimeContext: Record<string, any>;
  tracingContext?: TracingContext;
  entity: Record<string, any>;
  structuredOutput: boolean;
  source: ScoringSource;
  entityType: ScoringEntityType;
  threadId?: string;
  resourceId?: string;
}) {
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
      id: scorerId,
      name: scorerObject.scorer.name,
      description: scorerObject.scorer.description,
    },
    input,
    output,
    runtimeContext: Object.fromEntries(runtimeContext.entries()),
    tracingContext,
    runId,
    source,
    entity,
    structuredOutput,
    entityType,
    threadId,
    resourceId,
  };

  executeHook(AvailableHooks.ON_SCORER_RUN, payload);
}

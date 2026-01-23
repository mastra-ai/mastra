import type { CallSettings } from '@internal/ai-sdk-v5';
import { AvailableHooks, executeHook } from '../hooks';
import type { TracingContext } from '../observability';
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
  tracingContext,
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
  tracingContext?: TracingContext;
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

  // Get modelSettings and temperatures from scorer config
  const { modelSettings, temperatures } = scorerObject;

  // If temperatures array is provided, run scorer for each temperature
  // Otherwise, run once with the base modelSettings (or no modelSettings)
  const tempsToRun: (number | undefined)[] = temperatures?.length ? temperatures : [undefined];

  for (const temperature of tempsToRun) {
    // Build effective modelSettings: base settings + temperature override
    let effectiveModelSettings: Omit<CallSettings, 'abortSignal'> | undefined = modelSettings;
    if (temperature !== undefined) {
      effectiveModelSettings = { ...modelSettings, temperature };
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
      tracingContext,
      temperature,
      modelSettings: effectiveModelSettings,
    };

    executeHook(AvailableHooks.ON_SCORER_RUN, payload);
  }
}

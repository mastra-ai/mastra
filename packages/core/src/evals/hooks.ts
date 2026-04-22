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

  // Only serialize safe, lightweight keys from requestContext.
  // The full requestContext contains large objects (harness state, workspace with env vars)
  // that should not leak into scorer data or observability storage.
  // The harness stores threadId, resourceId, modeId, harnessId inside a nested 'harness'
  // object — we extract those scalars so they're available to scorers.
  const SAFE_HARNESS_KEYS = ['threadId', 'resourceId', 'modeId', 'harnessId'] as const;
  const safeContext: Record<string, any> = {};
  if (requestContext) {
    const entries: Iterable<[string, any]> =
      typeof requestContext.entries === 'function' ? requestContext.entries() : Object.entries(requestContext);
    for (const [key, value] of entries) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        // Allow primitive values from any top-level key (they're lightweight and safe)
        safeContext[key] = value;
      } else if (key === 'harness' && value && typeof value === 'object') {
        // Extract only safe scalar fields from the harness context
        for (const hKey of SAFE_HARNESS_KEYS) {
          const v = (value as Record<string, unknown>)[hKey];
          if (v !== undefined && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
            safeContext[hKey] = v;
          }
        }
      }
    }
  }

  const payload: ScoringHookInput = {
    scorer: {
      id: scorerObject.scorer?.id || scorerId,
      name: scorerObject.scorer?.name,
      description: scorerObject.scorer.description,
    },
    input,
    output,
    requestContext: safeContext,
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

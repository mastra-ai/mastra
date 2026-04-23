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

  // Extract all primitive (string | number | boolean) values from requestContext,
  // flattening nested objects so scorers can access any key regardless of depth.
  // Non-primitive values (objects with circular refs, buffers, functions, env vars)
  // are skipped to keep the payload lightweight and safe.
  const safeContext: Record<string, any> = {};
  if (requestContext) {
    const MAX_DEPTH = 8;
    const visited = new WeakSet<object>();
    const flatten = (obj: Record<string, unknown>, prefix?: string, depth = 0) => {
      if (depth > MAX_DEPTH) return;
      if (visited.has(obj)) return;
      visited.add(obj);

      const entries: Iterable<[string, unknown]> =
        typeof (obj as any).entries === 'function' ? (obj as any).entries() : Object.entries(obj);
      for (const [key, value] of entries) {
        const flatKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          safeContext[flatKey] = value;
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          flatten(value as Record<string, unknown>, flatKey, depth + 1);
        }
      }
    };
    flatten(requestContext as Record<string, unknown>);
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

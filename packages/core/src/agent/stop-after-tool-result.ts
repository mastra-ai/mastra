import type { StopCondition as StopConditionV5 } from '@internal/ai-sdk-v5';
import type { StopCondition as StopConditionV6 } from '@internal/ai-v6';
import type { StopAfterToolResultConfig } from './agent.types';

/**
 * Stop condition function signature compatible with AI SDK v5/v6.
 * We use `any` to be compatible with both AI SDK versions.
 */
type StopCondition = StopConditionV5<any> | StopConditionV6<any>;

/**
 * Creates a stopWhen condition from a stopAfterToolResult configuration.
 *
 * This converts the user-friendly `stopAfterToolResult` config into a `stopWhen`
 * callback that can be used by the agent loop.
 *
 * @param config - The stopAfterToolResult configuration
 * @returns A stopWhen condition function
 *
 * @example
 * ```typescript
 * // Stop after any tool result
 * const condition = createStopAfterToolResultCondition(true);
 *
 * // Stop after specific tool
 * const condition = createStopAfterToolResultCondition('fetchData');
 *
 * // Stop after any of these tools
 * const condition = createStopAfterToolResultCondition(['getData', 'fetchRecords']);
 *
 * // Custom predicate
 * const condition = createStopAfterToolResultCondition((result, toolName) => {
 *   return toolName === 'fetchData' && result?.success === true;
 * });
 * ```
 */
export function createStopAfterToolResultCondition(config: StopAfterToolResultConfig): StopCondition {
  // Cast to any to avoid type incompatibilities between AI SDK v5/v6 step types
  // The actual runtime structure is compatible across versions
  return (async ({ steps }: { steps: any[] }) => {
    for (const step of steps) {
      // Check content array for tool-result items (primary source)
      const contentItems = step.content ?? [];
      const toolResults = contentItems.filter((item: any) => item.type === 'tool-result');

      // Also check toolResults array if content is empty (fallback for different step formats)
      const toolResultsFromArray = (step.toolResults ?? []).map((tr: any) => ({
        type: 'tool-result' as const,
        toolName: tr.toolName,
        result: tr.result,
      }));

      const allToolResults = [...toolResults, ...toolResultsFromArray];

      if (allToolResults.length === 0) {
        continue;
      }

      // If true, stop after any tool result
      if (config === true) {
        return true;
      }

      // If string, stop after specific tool
      if (typeof config === 'string') {
        if (allToolResults.some((item: any) => item.toolName === config)) {
          return true;
        }
        continue;
      }

      // If array, stop after any of the specified tools
      if (Array.isArray(config)) {
        if (allToolResults.some((item: any) => item.toolName && config.includes(item.toolName))) {
          return true;
        }
        continue;
      }

      // If function, use custom predicate
      if (typeof config === 'function') {
        for (const item of allToolResults) {
          const shouldStop = await config(item.result, item.toolName ?? '');
          if (shouldStop) {
            return true;
          }
        }
      }
    }

    return false;
  }) as StopCondition;
}

/**
 * Merges stopAfterToolResult configuration with existing stopWhen conditions.
 *
 * @param stopAfterToolResult - The stopAfterToolResult configuration
 * @param existingStopWhen - Existing stopWhen condition(s)
 * @returns Merged array of stop conditions, or undefined if none
 */
export function mergeStopConditions(
  stopAfterToolResult: StopAfterToolResultConfig | undefined,
  existingStopWhen: StopCondition | StopCondition[] | undefined,
): StopCondition[] | undefined {
  const conditions: StopCondition[] = [];

  // Add existing stopWhen if present
  if (existingStopWhen) {
    if (Array.isArray(existingStopWhen)) {
      conditions.push(...existingStopWhen);
    } else {
      conditions.push(existingStopWhen);
    }
  }

  // Convert stopAfterToolResult to a stopWhen condition
  if (stopAfterToolResult !== undefined) {
    conditions.push(createStopAfterToolResultCondition(stopAfterToolResult));
  }

  return conditions.length > 0 ? conditions : undefined;
}

import { EntityType, SpanType } from '../observability';
import type { ToolExecutionContext } from './types';

/**
 * Symbol used to track tool execution depth for circular call protection.
 */
const TOOL_CALL_DEPTH = Symbol('toolCallDepth');
const TOOL_CALL_CHAIN = Symbol('toolCallChain');

export interface SafeExecuteToolOptions {
  /** Maximum nested tool call depth before aborting (default: 10) */
  maxDepth?: number;
  /** Custom span name for tracing (defaults to tool.id or 'unknown-tool') */
  spanName?: string;
}

/**
 * Safely execute a Mastra tool from within another tool's execute function.
 *
 * Features:
 * - Graceful error handling (returns null on failure instead of throwing)
 * - Tracing span creation for nested tool calls (child spans under parent)
 * - Full context propagation (requestContext, tracingContext, abortSignal, writer)
 * - Circular dependency detection via max depth tracking
 * - AbortSignal respect (checks before execution)
 *
 * @example
 * ```typescript
 * import { createTool, safeExecuteTool } from '@mastra/core/tools';
 *
 * const compositeTool = createTool({
 *   id: 'composite-tool',
 *   execute: async (input, context) => {
 *     const result = await safeExecuteTool(otherTool, { query: 'test' }, context);
 *     if (!result) return { error: 'inner tool failed' };
 *     return { data: result };
 *   }
 * });
 * ```
 */
export async function safeExecuteTool<TOutput, TInput = any>(
  tool: { id?: string; execute?: (input: TInput, context?: any) => Promise<TOutput> },
  input: TInput,
  context?: ToolExecutionContext<any, any, any>,
  options?: SafeExecuteToolOptions,
): Promise<TOutput | null> {
  // Guard: tool must have an execute function
  if (!tool || typeof tool.execute !== 'function') {
    return null;
  }

  // Store execute function to avoid non-null assertions later
  const executeFunction = tool.execute;
  const maxDepth = options?.maxDepth ?? 10;
  const toolId = tool.id || 'unknown-tool';
  const spanName = options?.spanName || `safeExecuteTool:${toolId}`;

  // Check abort signal before starting
  if (context?.abortSignal?.aborted) {
    return null;
  }

  // Circular call / max depth protection
  // Using symbols to avoid collisions with user properties
  const contextWithSymbols = context as any;
  const currentDepth = (contextWithSymbols?.[TOOL_CALL_DEPTH] as number) ?? 0;
  const callChain: string[] = (contextWithSymbols?.[TOOL_CALL_CHAIN] as string[]) ?? [];

  if (currentDepth >= maxDepth) {
    const chain = [...callChain, toolId].join(' → ');
    const logger = context?.mastra?.getLogger?.();
    logger?.warn?.(
      `[safeExecuteTool] Max depth (${maxDepth}) reached. Call chain: ${chain}. Aborting to prevent infinite recursion.`,
    );
    return null;
  }

  // Build child context with incremented depth and updated call chain
  const childContext = {
    ...context,
    [TOOL_CALL_DEPTH]: currentDepth + 1,
    [TOOL_CALL_CHAIN]: [...callChain, toolId],
  };

  // Get logger once at the start
  const logger = context?.mastra?.getLogger?.();

  // Execute with tracing if available
  try {
    // Log the nested tool call for observability
    logger?.debug?.(`[safeExecuteTool] Executing nested tool: ${toolId} (depth: ${currentDepth + 1}/${maxDepth})`, {
      toolId,
      depth: currentDepth + 1,
      maxDepth,
      callChain: [...callChain, toolId],
    });

    // If we have tracing context, create a child span
    const currentSpan = context?.tracingContext?.currentSpan;
    if (currentSpan) {
      const childSpan = currentSpan.createChildSpan?.({
        type: SpanType.TOOL_CALL,
        name: spanName,
        input,
        entityType: EntityType.TOOL,
        entityId: toolId,
        entityName: toolId,
      });

      // Update child context to include the child span in tracingContext
      // This ensures nested tool calls see the child span as the current span
      const childContextWithTracing = childSpan
        ? {
            ...childContext,
            tracingContext: {
              ...context?.tracingContext,
              currentSpan: childSpan,
            },
          }
        : childContext;

      try {
        const result = await executeFunction(input, childContextWithTracing);
        childSpan?.end?.({ output: result, attributes: { success: true } });
        return result;
      } catch (error) {
        // Use the span's error method to record the error properly
        childSpan?.error?.({ error: error as Error, attributes: { success: false } });

        logger?.error?.(`[safeExecuteTool] Tool ${toolId} threw an error`, { error, toolId });
        return null;
      }
    }

    // Fallback: execute without tracing span
    const result = await executeFunction(input, childContext);
    return result;
  } catch (error) {
    logger?.error?.(`[safeExecuteTool] Tool ${toolId} threw an error`, { error, toolId });
    return null;
  }
}

/**
 * Workspace Tracing Utilities
 *
 * Creates and manages WORKSPACE_ACTION spans for workspace tool operations.
 * Each workspace tool wraps its core operation in a span that captures
 * category, operation name, and operation-specific attributes.
 */

import type { AnySpan, WorkspaceActionAttributes } from '../../observability/types/tracing';
import { SpanType } from '../../observability/types/tracing';
import type { ToolExecutionContext } from '../../tools/types';
import type { Workspace } from '../workspace';

/**
 * Options for starting a workspace action span.
 */
export interface WorkspaceSpanOptions {
  /** Action category */
  category: WorkspaceActionAttributes['category'];
  /** Operation name (e.g. 'readFile', 'executeCommand') */
  operation: string;
  /** Input data to record on the span */
  input?: unknown;
  /** Initial attributes (merged with workspace metadata at span end) */
  attributes?: Partial<Omit<WorkspaceActionAttributes, 'category' | 'operation'>>;
}

/**
 * Handle returned by startWorkspaceSpan for ending the span.
 */
export interface WorkspaceSpanHandle {
  /** The underlying span (undefined when tracing is not active) */
  span: AnySpan | undefined;
  /** End the span successfully with final attributes */
  end(attrs?: Partial<WorkspaceActionAttributes>, output?: unknown): void;
  /** End the span with an error */
  error(err: unknown, attrs?: Partial<WorkspaceActionAttributes>): void;
}

/**
 * Start a WORKSPACE_ACTION child span from the tool execution context.
 *
 * Returns a handle with `end()` and `error()` methods. If no tracing context
 * is available (no parent span), all operations are safe no-ops.
 *
 * @example
 * ```typescript
 * const span = startWorkspaceSpan(context, workspace, {
 *   category: 'filesystem',
 *   operation: 'readFile',
 *   input: { path },
 *   attributes: { filePath: path },
 * });
 * try {
 *   const result = await filesystem.readFile(path);
 *   span.end({ success: true, bytesTransferred: result.length }); // success must be explicit
 *   return result;
 * } catch (err) {
 *   span.error(err, { filePath: path });
 *   throw err;
 * }
 * ```
 */
export function startWorkspaceSpan(
  context: ToolExecutionContext | undefined,
  workspace: Workspace | undefined,
  options: WorkspaceSpanOptions,
): WorkspaceSpanHandle {
  const currentSpan = context?.tracing?.currentSpan ?? context?.tracingContext?.currentSpan;

  if (!currentSpan) {
    return noOpHandle;
  }

  const { category, operation, input, attributes } = options;
  const startTime = Date.now();

  const span = currentSpan.createChildSpan<SpanType.WORKSPACE_ACTION>({
    type: SpanType.WORKSPACE_ACTION,
    name: `workspace:${category}:${operation}`,
    input,
    attributes: {
      category,
      operation,
      workspaceId: workspace?.id,
      workspaceName: workspace?.name,
      ...attributes,
    },
  });

  return {
    span,
    end(attrs?: Partial<WorkspaceActionAttributes>, output?: unknown) {
      span?.end({
        output,
        attributes: {
          durationMs: Date.now() - startTime,
          ...attrs,
        },
      });
    },
    error(err: unknown, attrs?: Partial<WorkspaceActionAttributes>) {
      const error = err instanceof Error ? err : new Error(String(err));
      span?.error({
        error,
        attributes: {
          success: false,
          durationMs: Date.now() - startTime,
          ...attrs,
        },
      });
    },
  };
}

/** No-op handle when tracing is not available */
const noOpHandle: WorkspaceSpanHandle = {
  span: undefined,
  end() {},
  error() {},
};

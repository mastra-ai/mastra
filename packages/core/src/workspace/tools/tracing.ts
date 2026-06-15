/**
 * Workspace Tracing Utilities
 *
 * Creates and manages WORKSPACE_ACTION spans for workspace tool operations.
 * Each workspace tool wraps its core operation in a span that captures
 * category, operation name, and operation-specific input/output.
 *
 * Data placement follows span conventions:
 * - `input`: what the operation receives (path, command, query, etc.)
 * - `output`: what the operation produces (results, bytes, exit codes, etc.)
 * - `attributes`: span metadata (category, workspaceId, provider, success)
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
  /** Input data to record on the span (path, command, query, etc.) */
  input?: unknown;
  /** Initial attributes (workspace metadata, provider info) */
  attributes?: Partial<Omit<WorkspaceActionAttributes, 'category'>>;
}

/**
 * Handle returned by startWorkspaceSpan for ending the span.
 */
export interface WorkspaceSpanHandle {
  /** The underlying span (undefined when tracing is not active) */
  span: AnySpan | undefined;
  /** End the span with final attributes and output */
  end(attrs?: Partial<WorkspaceActionAttributes>, output?: unknown): void;
  /** End the span with an error */
  error(err: unknown, attrs?: Partial<WorkspaceActionAttributes>): void;
}

const ENV_FIELD_NAMES = new Set(['env', 'environment', 'process_env']);
const SECRET_FIELD_PATTERN =
  /(^|[_-])(api[_-]?key|key|token|secret|password|passwd|pwd|credential|credentials|auth|authorization|cookie|session)([_-]|$)/i;

function normalizeFieldName(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function redactEnv(value: unknown) {
  return {
    redacted: true,
    keys: isPlainObject(value) || Array.isArray(value) ? Object.keys(value).sort() : undefined,
  };
}

function sanitizeWorkspaceTraceData(value: unknown, seen = new WeakSet<object>()): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[redacted:circular]';
    }
    seen.add(value);
    try {
      return value.map(item => sanitizeWorkspaceTraceData(item, seen));
    } finally {
      seen.delete(value);
    }
  }

  if (!isPlainObject(value)) {
    return value;
  }

  if (seen.has(value)) {
    return '[redacted:circular]';
  }
  seen.add(value);
  try {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => {
        const normalized = normalizeFieldName(key);
        if (ENV_FIELD_NAMES.has(normalized)) {
          return [key, redactEnv(entry)];
        }
        if (SECRET_FIELD_PATTERN.test(normalized)) {
          return [key, '[redacted]'];
        }
        return [key, sanitizeWorkspaceTraceData(entry, seen)];
      }),
    );
  } finally {
    seen.delete(value);
  }
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
 *   attributes: { filesystemProvider: filesystem.provider },
 * });
 * try {
 *   const result = await filesystem.readFile(path);
 *   span.end({ success: true }, { bytesTransferred: result.length });
 *   return result;
 * } catch (err) {
 *   span.error(err);
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

  const span = currentSpan.createChildSpan<SpanType.WORKSPACE_ACTION>({
    type: SpanType.WORKSPACE_ACTION,
    name: `workspace:${category}:${operation}`,
    input: sanitizeWorkspaceTraceData(input),
    attributes: {
      category,
      workspaceId: workspace?.id,
      workspaceName: workspace?.name,
      ...attributes,
    },
  });

  return {
    span,
    end(attrs?: Partial<WorkspaceActionAttributes>, output?: unknown) {
      span?.end({
        output: sanitizeWorkspaceTraceData(output),
        attributes: {
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

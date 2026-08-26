import type { IMastraLogger } from '../../../logger';
import { EntityType, SpanType } from '../../../observability';
import type { AnySpan } from '../../../observability';
import { emitLifecycleFact } from '../../../pulse/lifecycle';

/**
 * Provider tool calls are stashed at call time and their PROVIDER_TOOL_CALL span is
 * created when the result arrives, so the span can parent under the MODEL_STEP that
 * is open at that moment — a span's parent cannot be changed after creation, and at
 * call time we can't know which step (same or a later one) will deliver the result.
 * Shared between the regular and durable agent loops.
 */
export type PendingProviderToolCall = {
  toolName: string;
  args?: unknown;
  startTime: Date;
  toolDescription?: string;
  /** Anchor for calls whose result never arrives (run ends or stream errors). */
  fallbackParentSpan: AnySpan;
};

export function endPendingProviderToolSpan({
  toolCallId,
  pending,
  parentSpan,
  result,
  logger,
}: {
  toolCallId: string;
  pending: Omit<PendingProviderToolCall, 'fallbackParentSpan'>;
  parentSpan: AnySpan;
  result?: { output: unknown; isError?: boolean };
  logger?: IMastraLogger;
}): void {
  let span;
  try {
    span = parentSpan.createChildSpan({
      type: SpanType.PROVIDER_TOOL_CALL,
      name: `provider_tool: '${pending.toolName}'`,
      entityType: EntityType.TOOL,
      entityId: pending.toolName,
      entityName: pending.toolName,
      attributes: {
        toolType: 'provider-tool',
        ...(pending.toolDescription !== undefined ? { toolDescription: pending.toolDescription } : {}),
        toolCallId,
      },
      metadata: { toolCallId },
      startTime: pending.startTime,
      ...(pending.args !== undefined ? { input: pending.args } : {}),
    });
  } catch (err) {
    logger?.warn?.('[ProviderToolObservability] failed to create PROVIDER_TOOL_CALL span', {
      error: err instanceof Error ? err.message : String(err),
      toolName: pending.toolName,
    });
    return;
  }
  try {
    span?.end(result ? { output: result.output, attributes: { success: !result.isError } } : undefined);
    // First-hand pulse facts (runId via the ambient run context). Both are
    // emitted at result time — that is when the provider reveals the call.
    const pulseCtx = {
      surface: 'tool',
      base: 'call',
      occurrence: toolCallId,
      name: `provider_tool: '${pending.toolName}'`,
      parent: { surface: 'agent', base: 'run' },
      attributes: { toolCallId, toolType: 'provider-tool' },
    } as const;
    emitLifecycleFact('started', { ...pulseCtx, timestamp: pending.startTime });
    emitLifecycleFact('ended', { ...pulseCtx, error: result?.isError === true, output: result !== undefined });
  } catch (err) {
    logger?.warn?.('[ProviderToolObservability] failed to end PROVIDER_TOOL_CALL span', {
      error: err instanceof Error ? err.message : String(err),
      toolName: pending.toolName,
    });
  }
}

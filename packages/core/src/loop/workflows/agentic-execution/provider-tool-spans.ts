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
    emitLifecycleFact('started', undefined);
    emitLifecycleFact('ended', undefined);
  } catch (err) {
    logger?.warn?.('[ProviderToolObservability] failed to end PROVIDER_TOOL_CALL span', {
      error: err instanceof Error ? err.message : String(err),
      toolName: pending.toolName,
    });
  }
}

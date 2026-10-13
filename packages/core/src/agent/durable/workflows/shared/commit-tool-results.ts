import {
  commitToolResult,
  computeModelOutputProviderMetadata,
} from '../../../../loop/shared/steps/tool-result-commit-core';
import type { AnySpan } from '../../../../observability';
import { withToolPayloadTransformProviderMetadata } from '../../../../tools/payload-transform';
import type { MessageList } from '../../../message-list';
import type { DurableToolCallOutput } from '../../types';

/**
 * A pending client-side / HITL call: no result, no error, not provider-executed
 * and not a resolved denial. It must stay in `call` state (issue #23295).
 * Aborted and tripwire-blocked calls are resolved, not awaiting input.
 */
export function isPendingDurableClientCall(toolResult: DurableToolCallOutput): boolean {
  return (
    toolResult.result === undefined &&
    !toolResult.error &&
    !toolResult.aborted &&
    !toolResult.resultBlocked &&
    !toolResult.providerExecuted &&
    toolResult.approval?.approved !== false
  );
}

/**
 * Commit finished durable tool-call outputs to the message list. Shared by the
 * llm-mapping step and the suspend path that commits siblings of a suspended
 * call (#26514), so both record results the same way.
 */
export async function commitDurableToolResults(
  messageList: MessageList,
  toolResults: DurableToolCallOutput[],
  options: { tools?: Record<string, unknown>; parentSpan?: AnySpan } = {},
): Promise<void> {
  for (const toolResult of toolResults) {
    // An aborted call was cancelled mid-flight, not completed: recording it
    // would fake-complete the call, so leave the invocation incomplete.
    if (toolResult.aborted) continue;

    // A processToolResult processor blocked this result via tripwire at
    // tool-call time; leave the invocation incomplete.
    if (toolResult.resultBlocked) continue;

    // Provider-executed results are committed by llm-execution when the result
    // arrives in-stream; committing again would clobber that entry.
    if (toolResult.providerExecuted) continue;

    // A declined approval has no `result` but is resolved: persist it as
    // `output-denied` so it round-trips on recall.
    if (toolResult.approval?.approved === false) {
      commitToolResult({
        messageList,
        outcome: {
          kind: 'denied',
          approval: { id: toolResult.approval.id, approved: false, reason: toolResult.approval.reason },
        },
        toolCallId: toolResult.toolCallId,
        toolName: toolResult.toolName,
        toolArgs: toolResult.args,
      });
      continue;
    }

    // Recording a pending call as a `result` would feed the model a fabricated output.
    if (isPendingDurableClientCall(toolResult)) continue;

    // Results mapped eagerly in tool-call.ts (`modelOutputComputed`) are not
    // recomputed; this only covers results that crossed the boundary unmapped.
    let providerMetadata = toolResult.providerMetadata as Record<string, unknown> | undefined;
    if (!toolResult.error && toolResult.result != null && !toolResult.modelOutputComputed) {
      providerMetadata = await computeModelOutputProviderMetadata({
        tool: options.tools?.[toolResult.toolName] as { toModelOutput?: (output: unknown) => unknown } | undefined,
        toolName: toolResult.toolName,
        toolCallId: toolResult.toolCallId,
        result: toolResult.result,
        existingProviderMetadata: providerMetadata,
        parentSpan: options.parentSpan,
      });
    }

    // Layer the tool-payload-transform metadata captured at emission time (L18b).
    if (toolResult.transformMetadata) {
      providerMetadata = withToolPayloadTransformProviderMetadata(providerMetadata, toolResult.transformMetadata) as
        | Record<string, unknown>
        | undefined;
    }

    // Tool errors are recorded as `output-error`; successes keep `state: 'result'`.
    commitToolResult({
      messageList,
      outcome: toolResult.error
        ? { kind: 'error', errorText: toolResult.error.message }
        : { kind: 'result', result: toolResult.result },
      toolCallId: toolResult.toolCallId,
      toolName: toolResult.toolName,
      toolArgs: toolResult.args,
      approval: toolResult.approval,
      providerMetadata: providerMetadata as any,
      fallbackAppend: true,
    });
  }
}

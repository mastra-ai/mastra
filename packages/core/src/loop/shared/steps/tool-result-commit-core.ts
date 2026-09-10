import type { MessageList } from '../../../agent/message-list';
import { sanitizeToolName } from '../../../agent/message-list/utils/tool-name';
import { EntityType, SpanType } from '../../../observability';
import type { ProviderMetadata } from '../../../stream/types';
import { normalizeModelOutput } from '../normalize-model-output';

/** Minimal span surface for the MAPPING child span; both engines' spans satisfy it. */
interface MappingSpan {
  end(options?: unknown): void;
  error(options: unknown): void;
}

export interface ToolMappingParentSpan {
  createChildSpan(options: unknown): MappingSpan | undefined;
}

/**
 * Shared `toModelOutput` computation for the tool-result commit (PHASE3 Step 5).
 *
 * Runs the tool's `toModelOutput` mapper under a MAPPING child span, normalizes
 * media parts into the AI SDK's LanguageModelV2ToolResultOutput shape, and
 * merges the mapped output into `providerMetadata.mastra.modelOutput`.
 *
 * A nullish mapping result means "no special mapping needed" — the raw result
 * is already what the model should see. The key is not written in that case,
 * because MessageList keys off its presence and would otherwise override the
 * real result with `undefined`, producing a tool message with no output.
 *
 * Mapping-failure policy is engine-supplied (PHASE3 ledger): when
 * `onMappingError` is omitted the error propagates (the main loop's current
 * policy); when supplied, the core reports the failure and keeps the existing
 * metadata — the tool result itself is still usable (durable's policy).
 */
export async function computeModelOutputProviderMetadata(deps: {
  /** Pre-resolved tool. Engines own the lookup: run-scope stepTools / static
   * tools on main, the in-process registry on durable. */
  tool: { toModelOutput?: (output: unknown) => unknown } | undefined;
  toolName: string;
  toolCallId?: string;
  result: unknown;
  existingProviderMetadata?: Record<string, unknown>;
  /** Parent for the MAPPING child span (main: current tracing span; durable:
   * the MODEL_STEP span rebuilt from serialized state). */
  parentSpan?: ToolMappingParentSpan;
  onMappingError?: (error: unknown) => void;
}): Promise<Record<string, unknown> | undefined> {
  const { tool, result } = deps;
  let modelOutput: unknown;
  if (tool?.toModelOutput && result != null) {
    const mappingSpan = deps.parentSpan?.createChildSpan({
      type: SpanType.MAPPING,
      name: `tool output mapping: '${deps.toolName}'`,
      entityType: EntityType.TOOL,
      entityId: deps.toolName,
      entityName: deps.toolName,
      input: result,
      attributes: {
        mappingType: 'toModelOutput',
        toolCallId: deps.toolCallId,
      },
    });
    try {
      modelOutput = await tool.toModelOutput(result);
      modelOutput = normalizeModelOutput(modelOutput);
      mappingSpan?.end({ output: modelOutput });
    } catch (err) {
      mappingSpan?.error({ error: err as Error, endSpan: true });
      if (!deps.onMappingError) throw err;
      deps.onMappingError(err);
      modelOutput = undefined;
    }
  }

  const existingMastra = (deps.existingProviderMetadata as { mastra?: Record<string, unknown> } | undefined)?.mastra;
  const providerMetadata = {
    ...deps.existingProviderMetadata,
    ...(modelOutput != null ? { mastra: { ...existingMastra, modelOutput } } : {}),
  };
  return Object.keys(providerMetadata).length > 0 ? providerMetadata : undefined;
}

/** Resolved terminal state for one tool call, as recorded to the transcript. */
export type ToolResultCommitOutcome =
  | { kind: 'denied'; approval: { id: string; approved: false; reason?: string } }
  | { kind: 'error'; errorText?: string }
  | { kind: 'result'; result: unknown };

/**
 * Shared per-result transcript commit (PHASE3 Step 5): record one resolved
 * tool call on the MessageList as `output-denied`, `output-error`, or
 * `result`. Returns whether a matching invocation was found and updated.
 *
 * Adjudications:
 * - `sanitizeToolName` on every commit: main-only since #13633 (Bedrock
 *   rejects unsanitized hallucinated names on replay); dated drift — durable
 *   adopts via this core.
 * - `errorText` fallback to 'Tool execution failed': same drift class — an
 *   empty error message otherwise persists a failure with no explanation.
 * - `fallbackAppend` (durable true / main false): after a process hop the
 *   merge step may operate on a MessageList rebuilt from serialized state
 *   where the original call part is missing — losing a completed result is
 *   worse than appending a standalone tool message. In main the list is the
 *   same live object that recorded the call, so a miss indicates corruption
 *   and appending would mask the real bug. C1-forced deliberate difference,
 *   not drift.
 */
export function commitToolResult(deps: {
  messageList: MessageList;
  outcome: ToolResultCommitOutcome;
  toolCallId: string;
  toolName: string;
  toolArgs: unknown;
  /** Approval decision for an approved approval-gated tool, preserved so it
   * round-trips on recall (denied outcomes carry their own decision). */
  approval?: { id: string; approved: boolean; reason?: string };
  /** Fully-merged metadata for the commit. Engines own the merging: main
   * layers transform metadata on top from the live chunk; durable layers it
   * from the `transformMetadata` carried on the serialized step output (L18b). */
  providerMetadata?: ProviderMetadata;
  fallbackAppend?: boolean;
}): boolean {
  const { messageList, outcome } = deps;
  const toolName = sanitizeToolName(deps.toolName);

  if (outcome.kind === 'denied') {
    return messageList.updateToolInvocation({
      type: 'tool-invocation' as const,
      toolInvocation: {
        state: 'output-denied' as const,
        toolCallId: deps.toolCallId,
        toolName,
        args: deps.toolArgs,
        approval: outcome.approval,
      },
    });
  }

  const errorText = outcome.kind === 'error' ? outcome.errorText || 'Tool execution failed' : undefined;
  const updated = messageList.updateToolInvocation({
    type: 'tool-invocation' as const,
    toolInvocation: {
      ...(outcome.kind === 'error'
        ? { state: 'output-error' as const, errorText: errorText! }
        : { state: 'result' as const, result: outcome.result }),
      toolCallId: deps.toolCallId,
      toolName,
      args: deps.toolArgs,
      ...(deps.approval ? { approval: deps.approval } : {}),
    },
    ...(deps.providerMetadata ? { providerMetadata: deps.providerMetadata } : {}),
  });

  if (!updated && deps.fallbackAppend) {
    messageList.add(
      [
        {
          role: 'tool' as const,
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: deps.toolCallId,
              toolName,
              result: outcome.kind === 'error' ? errorText : outcome.result,
              isError: outcome.kind === 'error',
            },
          ],
        },
      ],
      'response',
    );
  }

  return updated;
}

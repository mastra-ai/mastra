import type { MessageList } from '../../../agent/message-list';
import { sanitizeToolName } from '../../../agent/message-list/utils/tool-name';
import { EntityType, SpanType } from '../../../observability';
import { isProcessorWorkflow } from '../../../processors/is-processor-workflow';
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
 * Shared `toModelOutput` computation for the tool-result commit.
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
 * Mapping failures propagate so a broken `toModelOutput` fails the run.
 *
 * Deliberately NOT consolidated with the background-task path
 * (`background-task-result-core.ts`), which always overwrites
 * `mastra.modelOutput` (null included) to clear the placeholder-derived value
 * and runs without a tracing span. The presence-keyed omit here vs the
 * always-overwrite there are both load-bearing; see its docblock.
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
      throw err;
    }
  }

  const existingMastra = (deps.existingProviderMetadata as { mastra?: Record<string, unknown> } | undefined)?.mastra;
  const providerMetadata = {
    ...deps.existingProviderMetadata,
    ...(modelOutput != null ? { mastra: { ...existingMastra, modelOutput } } : {}),
  };
  return Object.keys(providerMetadata).length > 0 ? providerMetadata : undefined;
}

/** The mapped `toModelOutput` value carried in `providerMetadata.mastra.modelOutput`, if any. */
export function readModelOutput(providerMetadata: Record<string, unknown> | undefined): unknown {
  return (providerMetadata as { mastra?: { modelOutput?: unknown } } | undefined)?.mastra?.modelOutput;
}

/** Whether any output processor (or processor workflow) can run `processToolResult`. */
export function hasToolResultProcessor(processors: readonly unknown[] | undefined): boolean {
  return (
    processors?.some(
      processor =>
        isProcessorWorkflow(processor) ||
        typeof (processor as { processToolResult?: unknown } | null)?.processToolResult === 'function',
    ) ?? false
  );
}

/**
 * A content snapshot of a tool result taken before `processToolResult` runs, so a
 * processor that edits the result in place (same object, new contents) is still
 * seen as having changed it. Undefined when the result can't be serialized; then
 * only a replaced object counts as a change.
 */
export function snapshotToolResult(result: unknown): string | undefined {
  try {
    return JSON.stringify(result);
  } catch {
    return undefined;
  }
}

/**
 * The mapped output the next `processToolResult` should see: the one an earlier
 * processor committed in `providerMetadata.mastra.modelOutput` (undefined when it
 * cleared it), otherwise `fallback`, the output mapped before the hook.
 */
export function latestProcessedModelOutput(messageList: MessageList, toolCallId: string, fallback: unknown): unknown {
  const mastra = (
    findCommittedToolInvocationPart(messageList, toolCallId)?.providerMetadata as
      | { mastra?: Record<string, unknown> }
      | undefined
  )?.mastra;
  if (!mastra || !('modelOutput' in mastra)) return fallback;
  return normalizeModelOutput(mastra.modelOutput) ?? undefined;
}

/**
 * Resolve the model output after `processToolResult` ran.
 *
 * Processors rewrite a tool result by committing a `result`-state part through
 * `messageList.updateToolInvocation`. That part may carry a replacement
 * `providerMetadata.mastra.modelOutput` (e.g. resized or removed images); it
 * then replaces the mapped output. A processor that only replaces the raw
 * `result` gets it re-mapped through `toModelOutput`, so the model never sees
 * the mapping of the value the processor replaced. Without either, the output
 * mapped before the hook stands and `toModelOutput` is not called again. A
 * result edited in place counts as replaced when its contents differ from
 * `resultSnapshotBeforeProcessors`.
 */
export async function resolveModelOutputAfterToolResultProcessors(deps: {
  messageList: MessageList;
  tool: { toModelOutput?: (output: unknown) => unknown } | undefined;
  toolName: string;
  toolCallId: string;
  /** The result the processors were given. */
  resultBeforeProcessors: unknown;
  /** `snapshotToolResult(resultBeforeProcessors)`, taken before the processors ran. */
  resultSnapshotBeforeProcessors?: string;
  /** Metadata computed before the processors ran, including the mapped output. */
  providerMetadata: Record<string, unknown> | undefined;
  parentSpan?: ToolMappingParentSpan;
}): Promise<Record<string, unknown> | undefined> {
  const part = findCommittedToolInvocationPart(deps.messageList, deps.toolCallId);

  const processorMastra = (part?.providerMetadata as { mastra?: Record<string, unknown> } | undefined)?.mastra;
  const { mastra: previousMastra, ...otherNamespaces } = deps.providerMetadata ?? {};
  const { modelOutput: _previous, ...mastraWithoutModelOutput } = (previousMastra as Record<string, unknown>) ?? {};
  const withoutModelOutput: Record<string, unknown> = Object.keys(mastraWithoutModelOutput).length
    ? { ...otherNamespaces, mastra: mastraWithoutModelOutput }
    : otherNamespaces;

  if (processorMastra && 'modelOutput' in processorMastra) {
    const modelOutput = normalizeModelOutput(processorMastra.modelOutput);
    if (modelOutput == null) {
      // Cleared: the model reads the (processed) raw result. Drop the key from the
      // part too, since the commit merges metadata and would otherwise keep it.
      delete processorMastra.modelOutput;
      return Object.keys(withoutModelOutput).length ? withoutModelOutput : undefined;
    }
    return { ...withoutModelOutput, mastra: { ...mastraWithoutModelOutput, modelOutput } };
  }

  // Without a committed part, a processor can only have edited the result in place.
  const resultAfterProcessors = part ? part.toolInvocation.result : deps.resultBeforeProcessors;
  const resultChanged =
    resultAfterProcessors !== deps.resultBeforeProcessors ||
    (deps.resultSnapshotBeforeProcessors !== undefined &&
      snapshotToolResult(resultAfterProcessors) !== deps.resultSnapshotBeforeProcessors);
  if (!resultChanged || !deps.tool?.toModelOutput) {
    return deps.providerMetadata;
  }

  return computeModelOutputProviderMetadata({
    tool: deps.tool,
    toolName: deps.toolName,
    toolCallId: deps.toolCallId,
    result: resultAfterProcessors,
    existingProviderMetadata: Object.keys(withoutModelOutput).length ? withoutModelOutput : undefined,
    parentSpan: deps.parentSpan,
  });
}

function findCommittedToolInvocationPart(messageList: MessageList, toolCallId: string) {
  const messages = messageList.get.all.db();
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== 'assistant' || !msg.content?.parts) continue;
    for (const part of msg.content.parts) {
      if (
        part?.type === 'tool-invocation' &&
        part.toolInvocation?.toolCallId === toolCallId &&
        part.toolInvocation.state === 'result'
      ) {
        return part as typeof part & { toolInvocation: { result?: unknown } };
      }
    }
  }
  return undefined;
}

/** Resolved terminal state for one tool call, as recorded to the transcript. */
export type ToolResultCommitOutcome =
  | { kind: 'denied'; approval: { id: string; approved: false; reason?: string } }
  /** `result` on an error outcome carries a structured payload alongside the
   * error text — e.g. a failed sub-agent's partial result — so the model can
   * read what the delegate produced before it failed, not just the message. */
  | { kind: 'error'; errorText?: string; result?: unknown }
  | { kind: 'result'; result: unknown };

/**
 * Shared per-result transcript commit: record one resolved
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

  // Nullish, not truthy: a failure-hook may deliberately replace the error
  // text with an empty string, and that replacement must survive the commit.
  const errorText = outcome.kind === 'error' ? (outcome.errorText ?? 'Tool execution failed') : undefined;
  const updated = messageList.updateToolInvocation({
    type: 'tool-invocation' as const,
    toolInvocation: {
      ...(outcome.kind === 'error'
        ? {
            state: 'output-error' as const,
            errorText: errorText!,
            ...(outcome.result != null ? { result: outcome.result } : {}),
          }
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

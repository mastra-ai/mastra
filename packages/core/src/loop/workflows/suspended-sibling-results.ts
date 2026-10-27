import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MessageList } from '../../agent/message-list';
import type { IMastraLogger } from '../../logger';
import type { ProcessorRunner } from '../../processors/runner';
import type { ChunkType, ProviderMetadata } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { withToolPayloadTransformProviderMetadata } from '../../tools/payload-transform';
import { readScoped } from '../run-scope-access';
import type { RunScopeContext } from '../run-scope-access';
import { STEP_TOOLS_KEY, TOOL_PAYLOAD_TRANSFORM_KEY } from '../run-scope-keys';
import { readToolResultFromMessageList } from '../shared/read-tool-result';
import { commitToolResult, computeModelOutputProviderMetadata } from '../shared/steps/tool-result-commit-core';
import { applyToolPayloadTransformToChunk } from '../shared/tool-payload-transform';
import { deserializeToolError, getSubAgentErrorResult } from './errors';

/** The per-iteration foreach entry shape persisted at `suspendPayload.__workflow_meta.foreachOutput`. */
interface ForeachEntry {
  status?: string;
  output?: {
    toolCallId?: string;
    toolName?: string;
    args?: unknown;
    result?: unknown;
    error?: unknown;
    aborted?: boolean;
    providerExecuted?: boolean;
    providerMetadata?: Record<string, unknown>;
    approval?: { id: string; approved: boolean; reason?: string };
  };
}

/**
 * Commit the tool results of foreach iterations that COMPLETED before a
 * sibling call suspended the step (issue #26514).
 *
 * When several tool calls share a step and one suspends, the suspension kills
 * the tool-call foreach, so llmMappingStep — the only place that emits and
 * commits tool-result chunks — never runs for that step. Without this pass the
 * finished siblings' results exist only inside the suspend snapshot: no
 * tool-result chunk reaches the client, memory persists the invocation as
 * `state: 'call'`, and incomplete-call filtering removes it from every later
 * prompt. An auto-resume turn (a fresh stream) never reads the abandoned
 * snapshot, so the sibling's work silently vanished.
 *
 * This mirrors llmMappingStep's per-result handling for plain successful
 * results: toModelOutput providerMetadata, transcript payload transform,
 * processToolResult processors, and the MessageList commit. It deliberately
 * does NOT emit a tool-result chunk: when the run is resumed via
 * `resumeStream`, llmMappingStep re-processes the full foreach output and
 * emits the result on the resumed stream — emitting here too would stream it
 * twice (see pending-tool-result-flush.scenario.test.ts). The re-commit on
 * resume is idempotent (`updateToolInvocation` with identical data).
 *
 * Returns true when at least one result was committed, so the caller knows to
 * flush the message list to memory.
 */
export async function commitSuspendedSiblingToolResults(deps: {
  /** The suspended agentic-loop run result; its suspended steps carry `__workflow_meta.foreachOutput`. */
  executionSteps: Record<string, unknown> | undefined;
  messageList: MessageList;
  scopeCtx: RunScopeContext;
  tools: ToolSet | undefined;
  runId: string;
  logger?: IMastraLogger;
  requestContext?: unknown;
  /** Output-processor runner sharing the loop's processor states; tool results run through processToolResult. */
  processorRunner?: ProcessorRunner;
}): Promise<boolean> {
  const { messageList, scopeCtx } = deps;

  const completed: NonNullable<ForeachEntry['output']>[] = [];
  const errored: NonNullable<ForeachEntry['output']>[] = [];
  for (const stepResult of Object.values(deps.executionSteps ?? {})) {
    const result = stepResult as {
      status?: string;
      suspendPayload?: { __workflow_meta?: { foreachOutput?: unknown } };
    };
    if (result?.status !== 'suspended') continue;
    const foreachOutput = result.suspendPayload?.__workflow_meta?.foreachOutput;
    if (!Array.isArray(foreachOutput)) continue;
    for (const entry of foreachOutput as ForeachEntry[]) {
      const output = entry?.output;
      if (entry?.status !== 'success' || !output?.toolCallId || !output.toolName) continue;
      // Mirror llmMappingStep's exclusions: provider-executed results are
      // handled by llm-execution-step; aborted/denied calls carry no
      // committable result; errored calls are saved as `output-error` below.
      if (output.providerExecuted || output.aborted) continue;
      if (output.approval?.approved === false) continue;
      if (output.error !== undefined) {
        errored.push(output);
        continue;
      }
      if (output.result === undefined) continue;
      // Already committed (e.g. a prior cycle's llmMappingStep ran before a
      // later re-suspension) — committing again would be redundant.
      if (readToolResultFromMessageList(messageList, output.toolCallId) !== undefined) continue;
      completed.push(output);
    }
  }
  if (!completed.length && !errored.length) return false;

  const stepTools = readScoped(scopeCtx, STEP_TOOLS_KEY, 'stepTools') as ToolSet | undefined;
  let committedAny = false;

  // Same as llmMappingStep: the error arrives as a plain {name,message,stack}
  // after serialization, so reify it to keep the message readable.
  for (const toolCall of errored) {
    const reifiedError = deserializeToolError(toolCall.error);
    commitToolResult({
      messageList,
      outcome: { kind: 'error', errorText: reifiedError.message, result: getSubAgentErrorResult(reifiedError) },
      toolCallId: toolCall.toolCallId!,
      toolName: toolCall.toolName!,
      toolArgs: toolCall.args,
      providerMetadata: toolCall.providerMetadata as ProviderMetadata | undefined,
    });
    committedAny = true;
  }

  for (const toolCall of completed) {
    try {
      const tool = (stepTools?.[toolCall.toolName!] ?? deps.tools?.[toolCall.toolName!]) as
        | { toModelOutput?: (output: unknown) => unknown }
        | undefined;
      const providerMetadata = await computeModelOutputProviderMetadata({
        tool,
        toolName: toolCall.toolName!,
        toolCallId: toolCall.toolCallId,
        result: toolCall.result,
        existingProviderMetadata: toolCall.providerMetadata,
      });

      const chunk = (await applyToolPayloadTransformToChunk(
        {
          type: 'tool-result',
          runId: deps.runId,
          from: ChunkFrom.AGENT,
          payload: {
            args: toolCall.args,
            toolCallId: toolCall.toolCallId!,
            toolName: toolCall.toolName!,
            result: toolCall.result,
            providerMetadata: (providerMetadata ?? toolCall.providerMetadata) as ProviderMetadata | undefined,
          },
        } as ChunkType & { payload?: any },
        {
          policy: readScoped(scopeCtx, TOOL_PAYLOAD_TRANSFORM_KEY, 'toolPayloadTransform'),
          tools: [stepTools, deps.tools],
          logger: deps.logger,
          // Transform against the original tool-call args/providerMetadata, not
          // the emitted payload's (which may carry the merged `mastra.modelOutput`).
          transformInput: { args: toolCall.args, providerMetadata: toolCall.providerMetadata },
        },
      )) as ChunkType & { payload: { result: unknown }; metadata?: Record<string, unknown> };

      // Run processToolResult BEFORE the raw result reaches history, matching
      // llmMappingStep's guarantee. A tripwire here means a processor blocked
      // the result — skip the commit rather than persisting the raw value.
      if (deps.processorRunner) {
        try {
          await deps.processorRunner.runProcessToolResult({
            steps: [],
            messages: messageList.get.all.db(),
            messageList,
            stepNumber: 0,
            toolName: toolCall.toolName!,
            toolCallId: toolCall.toolCallId!,
            toolArgs: toolCall.args,
            result: toolCall.result,
            providerExecuted: toolCall.providerExecuted,
            requestContext: deps.requestContext as any,
            retryCount: 0,
          });
          const postProcessorResult = readToolResultFromMessageList(messageList, toolCall.toolCallId!);
          if (postProcessorResult !== undefined && postProcessorResult !== chunk.payload.result) {
            chunk.payload.result = postProcessorResult;
          }
        } catch (error) {
          deps.logger?.warn('Tool result processor blocked a sibling result during suspension', {
            toolCallId: toolCall.toolCallId,
            error,
          });
          continue;
        }
      }

      commitToolResult({
        messageList,
        outcome: { kind: 'result', result: chunk.payload.result },
        toolCallId: toolCall.toolCallId!,
        toolName: toolCall.toolName!,
        toolArgs: toolCall.args,
        approval: toolCall.approval,
        providerMetadata: withToolPayloadTransformProviderMetadata(
          providerMetadata as ProviderMetadata | undefined,
          chunk.metadata,
        ) as ProviderMetadata | undefined,
      });
      committedAny = true;
    } catch (error) {
      // Best-effort recovery path: a failure to commit one sibling must not
      // turn the suspension into a stream error (the suspend snapshot still
      // holds the data for an explicit resumeStream).
      deps.logger?.warn('Failed to commit a completed sibling tool result during suspension', {
        toolCallId: toolCall.toolCallId,
        error,
      });
    }
  }

  return committedAny;
}

import { randomUUID } from 'node:crypto';
import type { MessageList } from '../../../agent/message-list';
import type { IMastraLogger } from '../../../logger';
import type { ProviderMetadata } from '../../../stream/types';
import { normalizeModelOutput } from '../normalize-model-output';

/** Completion payload delivered by the background-task manager's onResult hook. */
export interface BackgroundToolResultParams {
  status: string;
  result?: unknown;
  error?: { message?: string };
  toolCallId: string;
  toolName: string;
  runId: string;
  startedAt?: Date;
  completedAt?: Date;
  taskId?: string;
}

/**
 * Shared background-task result injector (PHASE3 Step 4): when a background
 * tool finishes, replace the "Background task started..." placeholder in the
 * transcript with the real result (or failure), recompute the model-facing
 * output, and flush to memory. Engines call this from their per-task onResult
 * hook; transport-specific chunk emission stays engine-side (onChunk).
 *
 * Adjudications:
 * - `toModelOutput` recompute + `mastra.modelOutput` overwrite: previously
 *   main-only. The dispatch turn stored `mastra.modelOutput` derived from the
 *   placeholder (or, on durable, no mapping at all), and `llmPrompt()` prefers
 *   that field over `toolInvocation.result` when building the tool message.
 *   Every path below overwrites `mastra.modelOutput`, including the ones that
 *   produce nothing: a tool with no `toModelOutput`, a mapping that returns
 *   nullish, and a mapping that throws. A null `modelOutput` is the
 *   established "no mapping, use the raw result" signal `MessageList` keys
 *   off by value.
 * - Transcript payload transforms remain an engine-supplied hook: the main
 *   loop reads its transform policy from run scope, which is not yet plumbed
 *   into the durable registry (tracked as a parity item, not adjudicated
 *   here). Without the hook, raw args/result are recorded — durable's
 *   existing behavior.
 */
export async function applyBackgroundToolResult(deps: {
  params: BackgroundToolResultParams;
  /** The run currently executing the tool-call step (not params.runId, which
   * is the run that originally dispatched the task). */
  currentRunId: string;
  /** Whether this leg of the run is itself a resume; gates the fallback
   * tool-call append so a same-run replay re-records the invocation. */
  hasResumeData: boolean;
  /** Tool args with `_background` removed. */
  args: unknown;
  messageList: MessageList;
  /** Approval decision for an approved approval-gated tool, preserved so it
   * round-trips on recall, matching the sync path. */
  approvalGrant?: Record<string, unknown>;
  baseProviderMetadata: ProviderMetadata | undefined;
  /** Optional transcript payload transforms (main loop only for now). */
  transformForTranscript?: (result: unknown) => Promise<{
    transcriptArgs: unknown;
    transcriptResult: unknown;
    providerMetadata: ProviderMetadata | undefined;
  }>;
  toModelOutput?: (output: unknown) => unknown;
  generateId?: () => string;
  logger?: IMastraLogger;
  /** Engine-specific memory flush (save-queue wiring differs per engine). */
  flush: () => Promise<void>;
}): Promise<void> {
  const { params, messageList } = deps;
  const failed = params.status === 'failed';
  const result = failed ? `Background task failed: ${params.error?.message ?? 'Unknown error'}` : params.result;

  const transformed = deps.transformForTranscript
    ? await deps.transformForTranscript(result)
    : { transcriptArgs: deps.args, transcriptResult: result, providerMetadata: deps.baseProviderMetadata };

  // Recompute the model-facing output from the *real* result. Mirrors the
  // synchronous path's toModelOutput mapping.
  let modelOutput: unknown = null;
  if (!failed && deps.toModelOutput && result != null) {
    try {
      modelOutput = normalizeModelOutput(await deps.toModelOutput(result)) ?? null;
    } catch (mappingError) {
      // Non-fatal: the real result is still written to `toolInvocation.result`
      // below and the model reads that instead. Surface it loudly because the
      // tool asked for a mapping and did not get one.
      deps.logger?.warn?.(
        `toModelOutput failed for background tool "${params.toolName}" — falling back to the raw result`,
        { toolCallId: params.toolCallId, error: mappingError },
      );
      modelOutput = null;
    }
  }
  const providerMetadata = {
    ...transformed.providerMetadata,
    mastra: { ...(transformed.providerMetadata as any)?.mastra, modelOutput },
  } as ProviderMetadata;

  const updated = messageList.updateToolInvocation(
    {
      type: 'tool-invocation',
      toolInvocation: {
        // A failed background task is recorded as `output-error` with the
        // message in `errorText`; a successful one keeps `state: 'result'`.
        ...(failed
          ? { state: 'output-error' as const, errorText: result as string }
          : { state: 'result' as const, result }),
        toolCallId: params.toolCallId,
        toolName: params.toolName,
        args: deps.args,
        ...(deps.approvalGrant ?? {}),
      },
      providerMetadata,
    },
    {
      mode: 'stream',
      backgroundTasks: {
        [params.toolCallId]: {
          startedAt: params.startedAt,
          completedAt: params.completedAt,
          taskId: params.taskId,
        },
      },
    },
  );

  // Fallback: no matching tool-invocation was found in the current message
  // list (can happen if the initial run's message list was cleared, e.g.
  // because the task completed after the process restarted and hooks were
  // reattached without the original call). Append a standalone tool message
  // so memory still records the result, even if it means a duplicate entry
  // for that toolCallId.
  if (!updated) {
    if (params.runId !== deps.currentRunId || deps.hasResumeData) {
      messageList.add(
        [
          {
            role: 'tool' as const,
            type: 'tool-call',
            id: deps.generateId?.() ?? randomUUID(),
            createdAt: new Date(),
            content: [
              {
                type: 'tool-call' as const,
                toolCallId: params.toolCallId,
                toolName: params.toolName,
                args: transformed.transcriptArgs,
              },
            ],
          },
        ],
        'response',
      );
    }
    messageList.add(
      [
        {
          role: 'tool' as const,
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: params.toolCallId,
              toolName: params.toolName,
              result: transformed.transcriptResult,
              isError: failed,
            },
          ],
        },
      ],
      'response',
    );
  }

  await deps.flush();
}

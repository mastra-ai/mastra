import type { IsTaskCompleteRunResult, MastraDBMessage } from '../../../agent';
import type { IsTaskCompleteConfig } from '../../../agent/agent.types';
import type { MessageList } from '../../../agent/message-list';
import type { IMastraLogger } from '../../../logger';
import { ChunkFrom } from '../../../stream/types';
import type { StreamCompletionContext } from '../../network/validation';
import { formatStreamCompletionFeedback, runStreamCompletionScorers } from '../../network/validation';

export type TaskCompletionOutcome = { evaluated: false } | { evaluated: true; complete: boolean };

const isWorkingMemoryToolName = (name?: string) =>
  name === 'updateWorkingMemory' || name === 'setWorkingMemory' || name === 'update-working-memory';

/**
 * Shared is-task-complete behavior (PHASE3 Step 3): decide whether this
 * iteration should be graded, run the completion scorers, invoke the
 * `onComplete` callback, append course-correction feedback to the transcript
 * when the check fails, and emit the `is-task-complete` chunk. Callers own
 * how the verdict projects back onto their state shape (flipping
 * `isContinued`, serializing the message list, main's
 * `isTaskCompleteCheckFailed` flag).
 *
 * Grading is skipped when: no scorers are configured; the LLM hasn't
 * signaled it's done (don't interrupt mid-tool loops — `llmSignaledDone` is
 * engine-computed because the engines treat a missing step result
 * differently); the iteration errored (`reason === 'error'`, #21897 — a
 * failing scorer must not flip `isContinued` back on and re-issue the
 * failing request until maxSteps; previously durable-only, ledger L9, now
 * shared); a background task result was just injected (the LLM hasn't
 * processed it yet); or the iteration only updated working memory
 * (housekeeping, not task progress).
 *
 * Error policy is per-engine (`errorPolicy`, required so every call site's
 * choice is explicit):
 * - `'fatal'` (default in-process engine): scorer throws, `onComplete`
 *   throws, and chunk-emission failures propagate to the caller and fail
 *   the run — the released in-process contract. The engine has no
 *   redelivery, so a throw surfaces exactly once; swallowing it would hide
 *   real bugs in user scorer/callback code and break error handling users
 *   wrote against the shipped behavior. A failing `emitChunk` means the
 *   consumer's stream is broken — surface it rather than running against a
 *   dead stream.
 * - `'best-effort'` (durable/evented engines): failures are logged and
 *   grading is skipped. A scorer throw fails the durable *step*, and
 *   at-least-once redelivery re-runs the step — re-invoking the throwing
 *   scorer against the same state, potentially forever. Log-and-skip is
 *   the only stable policy under redelivery (ledger L4). Post-verdict
 *   publish failure must not fail a step whose verdict is already settled
 *   and persisted.
 *
 * The errored-iteration skip (`reason === 'error'` above) is unconditional
 * on BOTH policies — it is a bug fix (#21897), not an engine policy: a
 * failing scorer must not flip `isContinued` back on and re-issue the
 * failing request until maxSteps.
 */
export async function evaluateTaskCompletion(deps: {
  policy: IsTaskCompleteConfig | undefined;
  /** Per-engine failure policy for scorer / onComplete / chunk-emission errors (see docblock). */
  errorPolicy: 'fatal' | 'best-effort';
  /** 1-based iteration number used for maxIterations bookkeeping + the chunk payload. */
  iteration: number;
  maxIterations: number | undefined;
  llmSignaledDone: boolean;
  stepReason: string | undefined;
  backgroundTaskPending: boolean | undefined;
  toolCalls: Array<{ toolName?: string; args?: unknown }>;
  toolResults: Array<{ toolName?: string; result?: unknown }>;
  currentText: string;
  /**
   * Live (main) or rehydrated-from-state (durable) transcript; feedback is
   * appended here. Lazy so the durable engine only deserializes when the
   * iteration is actually graded (all skip-guards run first).
   */
  messageList: () => MessageList;
  runId: string;
  agentId?: string;
  agentName?: string;
  threadId?: string;
  resourceId?: string;
  customContext?: Record<string, unknown>;
  generateId?: () => string | undefined;
  emitChunk: (chunk: unknown) => void | Promise<void>;
  logger?: IMastraLogger;
}): Promise<TaskCompletionOutcome> {
  const { policy } = deps;

  if (!policy?.scorers || policy.scorers.length === 0) {
    return { evaluated: false };
  }
  if (!deps.llmSignaledDone) {
    return { evaluated: false };
  }
  if (deps.stepReason === 'error') {
    return { evaluated: false };
  }
  if (deps.backgroundTaskPending) {
    return { evaluated: false };
  }
  if (deps.toolCalls.length > 0 && deps.toolCalls.every(tc => isWorkingMemoryToolName(tc.toolName))) {
    return { evaluated: false };
  }

  const messageList = deps.messageList();

  // Get the original user message for context
  const firstUserMessage = messageList.get.input.db()[0];
  let originalTask = 'Unknown task';
  if (firstUserMessage) {
    if (typeof firstUserMessage.content === 'string') {
      originalTask = firstUserMessage.content;
    } else if (firstUserMessage.content?.parts?.[0]?.type === 'text') {
      originalTask = firstUserMessage.content.parts[0].text;
    }
  }

  const ctx: StreamCompletionContext = {
    iteration: deps.iteration,
    maxIterations: deps.maxIterations,
    originalTask,
    currentText: deps.currentText || '',
    toolCalls: deps.toolCalls.map(tc => ({
      name: tc.toolName || '',
      args: (tc.args as Record<string, unknown>) ?? {},
    })),
    messages: messageList.get.all.db(),
    toolResults: deps.toolResults.map(tr => ({
      name: tr.toolName || '',
      result: (tr.result as Record<string, unknown>) ?? {},
    })),
    agentId: deps.agentId || '',
    agentName: deps.agentName || '',
    runId: deps.runId,
    threadId: deps.threadId,
    resourceId: deps.resourceId,
    customContext: deps.customContext,
  };

  let result: IsTaskCompleteRunResult | undefined;
  try {
    result = await runStreamCompletionScorers(policy.scorers, ctx, {
      strategy: policy.strategy,
      parallel: policy.parallel,
      timeout: policy.timeout,
    });
  } catch (error) {
    // D2a — 'fatal' (default engine): a throwing user scorer fails the run,
    // as released. 'best-effort' (durable): log-and-skip — redelivery would
    // re-invoke the throwing scorer against the same state forever.
    if (deps.errorPolicy === 'fatal') {
      throw error;
    }
    deps.logger?.warn('isTaskComplete scoring failed; skipping completion check', { error });
    return { evaluated: false };
  }
  if (!result) {
    return { evaluated: false };
  }

  if (policy.onComplete) {
    try {
      await policy.onComplete(result);
    } catch (error) {
      // D2b — 'fatal' (default engine): a throwing user callback is user
      // code signaling failure; the released contract surfaced it.
      // 'best-effort' (durable): log-and-keep-verdict under redelivery.
      if (deps.errorPolicy === 'fatal') {
        throw error;
      }
      deps.logger?.warn('isTaskComplete onComplete callback failed', { error });
    }
  }

  const maxIterationReached = deps.maxIterations ? deps.iteration >= deps.maxIterations : false;

  // Append the feedback as an assistant message so the next LLM iteration can
  // course-correct. Skipped when the check passes: the loop ends, so the
  // report would only leak into the resolved final text and thread memory.
  if (!result.complete) {
    const feedback = formatStreamCompletionFeedback(result, maxIterationReached);
    messageList.add(
      {
        id: deps.generateId?.(),
        createdAt: new Date(),
        type: 'text',
        role: 'assistant',
        content: {
          parts: [{ type: 'text', text: feedback }],
          metadata: {
            mode: 'stream',
            completionResult: {
              passed: result.complete,
              suppressFeedback: !!policy.suppressFeedback,
            },
          },
          format: 2,
        },
      } as MastraDBMessage,
      'response',
    );
  }

  try {
    await Promise.resolve(
      deps.emitChunk({
        type: 'is-task-complete',
        runId: deps.runId,
        from: ChunkFrom.AGENT,
        payload: {
          iteration: deps.iteration,
          passed: result.complete,
          results: result.scorers,
          duration: result.totalDuration,
          timedOut: result.timedOut,
          reason: result.completionReason,
          maxIterationReached,
          suppressFeedback: !!policy.suppressFeedback,
        },
      }),
    );
  } catch (error) {
    // D2c — 'fatal' (default engine): a failing enqueue means the consumer's
    // stream is broken; the released contract surfaced that instead of
    // continuing against a dead stream. 'best-effort' (durable): the pubsub
    // transport may be closed — the verdict is already settled and
    // persisted, so a post-verdict publish failure must not fail the step.
    if (deps.errorPolicy === 'fatal') {
      throw error;
    }
  }

  return { evaluated: true, complete: result.complete };
}

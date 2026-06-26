import { ReadableStream } from 'node:stream/web';
import type { TracingContext } from '@mastra/core/observability';
import type { Workflow } from '@mastra/core/workflows';
import type { VoiceReplyGenerator, VoiceTurnContext } from './bridge';

export interface WorkflowReplyGeneratorOptions {
  /** The Mastra workflow that generates each turn's reply. Runs once per turn (no suspend/resume). */
  workflow: Workflow;
  /**
   * Maps a turn into the workflow's `inputData`. Required — input schemas are caller-defined.
   * A common shape passes the full transcript so the workflow is stateless between turns, e.g.
   * `ctx => ({ history: chatContextToMessages(ctx.chatCtx) })`.
   */
  workflowInput: (ctx: VoiceTurnContext) => unknown | Promise<unknown>;
  /**
   * Only stream text from this step (by id). Defaults to every step that writes text to its
   * `writer`. Set when multiple steps write and only one produces the spoken reply.
   */
  replyStep?: string;
  /**
   * Fallback when the workflow streams no text via `writer`: derive the spoken reply from the
   * final run result. Without this, a non-streaming workflow stays silent. Streaming via the
   * step `writer` is preferred — it gives the caller low time-to-first-token.
   */
  resultText?: (result: unknown) => string | undefined | void;
}

/**
 * Unwraps the text carried by a `workflow-step-output` chunk's `payload.output`. A step that
 * pipes `agent.stream().textStream` into its `writer` produces raw strings; a step built from an
 * agent (`createStep(agent)`) produces full `text-delta` chunks. Returns the text for both, or
 * `undefined` for any other shape.
 */
export function unwrapStepText(output: unknown): string | undefined {
  if (typeof output === 'string') return output;
  if (output && typeof output === 'object' && (output as { type?: unknown }).type === 'text-delta') {
    const text = (output as { payload?: { text?: unknown } }).payload?.text;
    return typeof text === 'string' ? text : undefined;
  }
  return undefined;
}

/**
 * A {@link VoiceReplyGenerator} backed by a Mastra workflow. Per turn it starts a fresh run to
 * completion (LiveKit owns the turn boundary, so there is no suspend/resume and no conversation
 * state carried between turns) and streams the text its steps write to their `writer`.
 *
 * A workflow's own stream emits structured step events, not token deltas — text only surfaces
 * when a step pipes it into the injected `writer`, arriving as `workflow-step-output` chunks.
 * Make the reply-producing step do `await agent.stream(...).textStream.pipeTo(writer)` (and pass
 * the step's `abortSignal` through) so barge-in stops generation promptly.
 */
export function createWorkflowReplyGenerator(options: WorkflowReplyGeneratorOptions): VoiceReplyGenerator {
  const { workflow, workflowInput, replyStep, resultText } = options;
  return async ctx => {
    const inputData = await workflowInput(ctx);
    const run = await workflow.createRun();

    const streamArgs: { inputData: unknown; tracingContext?: TracingContext } = { inputData };
    if (ctx.tracingContext) streamArgs.tracingContext = ctx.tracingContext;
    const output = run.stream(streamArgs);

    let cancelled = false;
    return new ReadableStream<string>({
      start: async controller => {
        let streamedAny = false;
        try {
          for await (const chunk of output.fullStream) {
            if (cancelled) break;
            if (chunk.type !== 'workflow-step-output') continue;
            const payload = chunk.payload as { output?: unknown; stepName?: unknown };
            if (replyStep && payload.stepName !== replyStep) continue;
            const text = unwrapStepText(payload.output);
            if (text) {
              streamedAny = true;
              controller.enqueue(text);
            }
          }
          if (!cancelled && !streamedAny && resultText) {
            const finalText = resultText(await output.result);
            if (finalText) controller.enqueue(finalText);
          }
          if (!cancelled) controller.close();
        } catch (error) {
          // Barge-in cancels the run; that's not a failure.
          if (cancelled) return;
          controller.error(error);
        }
      },
      cancel: () => {
        cancelled = true;
        void run.cancel();
      },
    });
  };
}

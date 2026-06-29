import { ReadableStream } from 'node:stream/web';
import type { WritableStream } from 'node:stream/web';
import type { TracingContext } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/request-context';
import type { Workflow } from '@mastra/core/workflows';
import type {
  VoiceReplyGenerator,
  VoiceToolCall,
  VoiceTurnCompleteContext,
  VoiceTurnCompleteHook,
  VoiceTurnContext,
} from './bridge';

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
  /**
   * Speak a short phrase while a tool call runs. Fires only for tool calls the reply step surfaces
   * to its `writer` — use {@link pipeAgentReplyToWriter} (or pipe the agent's `fullStream`) so
   * `tool-call` chunks reach the stream. See {@link MastraVoiceAgentOptions.toolFeedback}.
   */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
  /**
   * Fired off the audio path after the reply streams, fire-and-forget. Carries the produced reply
   * text and any tool calls the workflow surfaced. See {@link MastraVoiceAgentOptions.onTurnComplete}.
   */
  onTurnComplete?: VoiceTurnCompleteHook;
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
 * Unwraps a tool call carried by a `workflow-step-output` chunk's `payload.output`. A step that
 * pipes the agent's `fullStream` (rather than just `textStream`) into its `writer` surfaces
 * `tool-call` chunks; this returns the {@link VoiceToolCall} for those, or `undefined` otherwise.
 */
export function unwrapStepToolCall(output: unknown): VoiceToolCall | undefined {
  if (!output || typeof output !== 'object' || (output as { type?: unknown }).type !== 'tool-call') return undefined;
  const payload = (output as { payload?: { toolCallId?: unknown; toolName?: unknown; args?: unknown } }).payload;
  if (payload && typeof payload.toolCallId === 'string' && typeof payload.toolName === 'string') {
    return { toolCallId: payload.toolCallId, toolName: payload.toolName, args: payload.args };
  }
  return undefined;
}

/** The minimal shape of a Mastra agent stream consumed by {@link pipeAgentReplyToWriter}. */
export interface AgentReplyStreamLike {
  fullStream: AsyncIterable<unknown>;
}

/**
 * Streams a Mastra agent's reply into a workflow step's `writer` for the LiveKit workflow
 * entrypoint — the recommended way to drive a turn's reply from a step.
 *
 * It forwards the agent's text deltas (so text-to-speech starts before the full reply is ready)
 * AND its `tool-call` chunks (so {@link WorkflowReplyGeneratorOptions.toolFeedback} fires and
 * {@link WorkflowReplyGeneratorOptions.onTurnComplete}'s `result.toolCalls` is populated). This is
 * the difference from piping only `agent.stream().textStream`, which silently drops tool calls.
 * Other chunk types (reasoning, tool results, lifecycle) are not forwarded, keeping the spoken
 * stream clean. Returns the accumulated reply text for the step to return.
 *
 * Pass the step's `abortSignal` to `agent.stream(...)` so barge-in stops generation promptly.
 *
 * ```ts
 * const generateResponse = createStep({
 *   // ...
 *   execute: async ({ inputData, mastra, writer, abortSignal }) => {
 *     const stream = await mastra.getAgent('callCenter').stream(inputData.turn, { abortSignal });
 *     const reply = await pipeAgentReplyToWriter(stream, writer);
 *     return { reply };
 *   },
 * });
 * ```
 */
export function pipeAgentReplyToWriter(
  agentStream: AgentReplyStreamLike,
  writer: WritableStream<unknown>,
): Promise<string> {
  let text = '';
  // Re-emit only the chunks the voice path cares about, then pipe through the step writer — which
  // reuses pipeTo's proven backpressure + close handling rather than driving the writer by hand.
  const forwarded = new ReadableStream<unknown>({
    start: async controller => {
      for await (const chunk of agentStream.fullStream) {
        const type = (chunk as { type?: unknown })?.type;
        if (type === 'text-delta') {
          const delta = (chunk as { payload?: { text?: unknown } }).payload?.text;
          if (typeof delta === 'string' && delta) {
            text += delta;
            controller.enqueue(chunk);
          }
        } else if (type === 'tool-call') {
          controller.enqueue(chunk);
        }
      }
      controller.close();
    },
  });
  return forwarded.pipeTo(writer).then(() => text);
}

/**
 * A {@link VoiceReplyGenerator} backed by a Mastra workflow. Per turn it starts a fresh run to
 * completion (LiveKit owns the turn boundary, so there is no suspend/resume and no conversation
 * state carried between turns) and streams the text its steps write to their `writer`.
 *
 * A workflow's own stream emits structured step events, not token deltas — text only surfaces
 * when a step pipes it into the injected `writer`, arriving as `workflow-step-output` chunks. The
 * simplest correct reply step calls {@link pipeAgentReplyToWriter}, which forwards both text and
 * tool calls (and passes the step's `abortSignal` through `agent.stream` so barge-in stops
 * generation promptly). Piping only `agent.stream(...).textStream.pipeTo(writer)` works for text
 * but silently drops tool calls, so {@link WorkflowReplyGeneratorOptions.toolFeedback} and
 * {@link WorkflowReplyGeneratorOptions.onTurnComplete}'s `result.toolCalls` stay empty.
 */
export function createWorkflowReplyGenerator(options: WorkflowReplyGeneratorOptions): VoiceReplyGenerator {
  const { workflow, workflowInput, replyStep, resultText, toolFeedback, onTurnComplete } = options;
  return async ctx => {
    const inputData = await workflowInput(ctx);
    const run = await workflow.createRun();

    const streamArgs: { inputData: unknown; tracingContext?: TracingContext; requestContext?: RequestContext } = {
      inputData,
    };
    if (ctx.tracingContext) streamArgs.tracingContext = ctx.tracingContext;
    // Forward the per-session request context so workflow steps see it, mirroring the agent path.
    if (ctx.requestContext) streamArgs.requestContext = ctx.requestContext;
    const output = run.stream(streamArgs);

    let cancelled = false;
    // Accumulated as the turn streams so the post-turn hook can see what was actually produced.
    let replyText = '';
    const toolCalls: VoiceToolCall[] = [];

    // Fire-and-forget after the reply has streamed: off the audio path and not awaited, so it
    // never delays the next turn. Errors are logged, not thrown. Mirrors createAgentReplyGenerator.
    const emitTurnComplete = (interrupted: boolean) => {
      if (!onTurnComplete) return;
      const completeCtx: VoiceTurnCompleteContext = { ...ctx, result: { text: replyText, toolCalls, interrupted } };
      Promise.resolve()
        .then(() => onTurnComplete(completeCtx))
        .catch(error => {
          console.warn('@mastra/livekit: onTurnComplete hook threw', error);
        });
    };

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
              replyText += text;
              controller.enqueue(text);
              continue;
            }
            // A tool call only surfaces when the step pipes the agent's fullStream; when it does,
            // mirror the agent path — record it and speak any toolFeedback filler.
            const toolCall = unwrapStepToolCall(payload.output);
            if (toolCall) {
              toolCalls.push(toolCall);
              if (toolFeedback) {
                const filler = toolFeedback(toolCall);
                if (filler) controller.enqueue(filler.endsWith(' ') ? filler : `${filler} `);
              }
            }
          }
          if (!cancelled && !streamedAny && resultText) {
            const finalText = resultText(await output.result);
            if (finalText) {
              replyText += finalText;
              controller.enqueue(finalText);
            }
          }
          if (!cancelled) controller.close();
          // Success, or a clean barge-in break out of the loop: the turn is done either way.
          emitTurnComplete(cancelled);
        } catch (error) {
          // Barge-in cancels the run; that's not a failure — the turn still completed
          // (interrupted), so the hook still fires for memory reconciliation.
          if (cancelled) {
            emitTurnComplete(true);
            return;
          }
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

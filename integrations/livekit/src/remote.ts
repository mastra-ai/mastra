import { ReadableStream } from 'node:stream/web';
import { APIConnectionError, APIError, APIStatusError, APITimeoutError } from '@livekit/agents';
import { RequestContext } from '@mastra/core/request-context';
import { mapTurnUsage } from './bridge';
import type {
  VoiceReplyGenerator,
  VoiceToolCall,
  VoiceTurnCompleteContext,
  VoiceTurnCompleteHook,
  VoiceTurnUsage,
} from './bridge';

const DEFAULT_API_PREFIX = '/api';
/** Connect + first-token budget when not overridden. Plugin mode passes `connOptions.timeoutMs`. See D9. */
export const DEFAULT_REMOTE_TIMEOUT_MS = 10_000;
/** Standalone initial-connection retry attempts. Plugin mode forces this to 0 (base class owns retries). See D8. */
export const DEFAULT_REMOTE_RETRIES = 2;

/** Thrown (as a plain, non-retryable error) when the server emits a chunk that needs client action. */
const HITL_UNSUPPORTED_MESSAGE =
  '@mastra/livekit: the agent requested tool approval or suspended a tool call; human-in-the-loop ' +
  'flows (approve-tool-call / resume-stream) are not supported on the voice path. Remove requireApproval ' +
  'or suspend from the tools this agent uses on voice calls.';

/**
 * Options for the remote Mastra transport. Shape mirrors the in-process `AgentReplyGeneratorOptions`
 * so `MastraLLM` can accept either source interchangeably.
 */
export interface RemoteMastraAgentOptions {
  /** Base URL of the remote Mastra server, e.g. `https://my-app.mastra.cloud`. */
  baseUrl: string;
  /** Agent key in the Mastra config's `agents`. */
  agentId: string;
  /** Path prefix for the Mastra API. Defaults to `'/api'`. */
  apiPrefix?: string;
  /** Static headers, or a (possibly async) resolver invoked per turn — e.g. to mint a fresh token. */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
  /** Injectable `fetch` for tests/proxies. Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
  /**
   * Connect + first-token timeout in ms. Plugin mode default: LiveKit's `connOptions.timeoutMs` (10s).
   * Standalone default: {@link DEFAULT_REMOTE_TIMEOUT_MS}. See D9.
   */
  timeoutMs?: number;
  /**
   * Initial-connection retry attempts (before the first chunk only). Standalone default:
   * {@link DEFAULT_REMOTE_RETRIES}. In plugin mode the LiveKit base class owns retries and this is
   * forced to 0. See D8.
   */
  retries?: number;
  /** Extra fields merged into each stream request body (advanced). */
  body?: Record<string, unknown>;
}

/** {@link RemoteMastraAgentOptions} plus the per-turn observer hooks the generator threads through. */
export interface RemoteAgentReplyGeneratorOptions extends RemoteMastraAgentOptions {
  /** Speak a short phrase while a tool runs. See {@link MastraVoiceAgentOptions.toolFeedback}. */
  toolFeedback?: (toolCall: VoiceToolCall) => string | undefined | void;
  /** Notified as each tool-call chunk arrives, mid-stream. See {@link MastraVoiceAgentOptions.onToolCall}. */
  onToolCall?: (toolCall: VoiceToolCall) => void;
  /** Fired off the audio path after the reply streams. See {@link MastraVoiceAgentOptions.onTurnComplete}. */
  onTurnComplete?: VoiceTurnCompleteHook;
}

type RawChunk = { type?: string; payload?: Record<string, unknown> };

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveHeaders(headers: RemoteMastraAgentOptions['headers']): Promise<Record<string, string>> {
  if (!headers) return {};
  if (typeof headers === 'function') return (await headers()) ?? {};
  return headers;
}

function serializeRequestContext(
  requestContext: RequestContext | Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!requestContext) return undefined;
  // Mirror client-js `parseClientRequestContext`.
  if (requestContext instanceof RequestContext) return Object.fromEntries(requestContext.entries());
  return requestContext;
}

async function safeReadBody(response: Response): Promise<object | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === 'object' ? (parsed as object) : { message: String(parsed) };
    } catch {
      return { message: text };
    }
  } catch {
    return null;
  }
}

/**
 * Reads a Mastra SSE stream and yields each event's parsed JSON. Framing matches the server's
 * `processMastraStream` (buffer, split on `\n\n`, strip `data: `, stop on `[DONE]`); undecodable
 * `data:` lines are skipped. Aborting `signal` cancels the underlying reader.
 */
export async function* readMastraSSE(
  body: globalThis.ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<RawChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const onAbort = () => void reader.cancel().catch(() => {});
  if (signal.aborted) {
    void reader.cancel().catch(() => {});
    return;
  }
  signal.addEventListener('abort', onAbort, { once: true });
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      for (const event of events) {
        if (!event.startsWith('data:')) continue;
        const data = event.slice(event.startsWith('data: ') ? 6 : 5).trim();
        if (data === '[DONE]') return;
        if (!data) continue;
        let json: unknown;
        try {
          json = JSON.parse(data);
        } catch {
          continue; // tolerate a stray non-JSON line
        }
        if (json && typeof json === 'object') yield json as RawChunk;
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    try {
      reader.releaseLock();
    } catch {
      // A read may still be pending when the fetch was aborted; the stream is torn down anyway.
    }
  }
}

/**
 * A {@link VoiceReplyGenerator} that runs the Mastra agent loop on a **remote** Mastra server over
 * HTTP/SSE. Shaped exactly like the in-process `createAgentReplyGenerator`: it consumes the same
 * chunk vocabulary, drives the same `toolFeedback` / `onToolCall` / `onTurnComplete` seams, and
 * cancelling the returned stream (LiveKit does this on barge-in) tears down the HTTP request so the
 * server aborts generation.
 *
 * Usable standalone via the worker's `generate:` hatch (a minimum-viable remote worker mode), and as
 * the transport `MastraLLM` wraps. Errors are thrown as LiveKit `APIError` subclasses so the plugin's
 * base-class retry loop and `FallbackAdapter` behave (D8); a connect + first-token watchdog prevents
 * indefinite dead air (D9).
 */
export function createRemoteAgentReplyGenerator(options: RemoteAgentReplyGeneratorOptions): VoiceReplyGenerator {
  const {
    baseUrl,
    agentId,
    apiPrefix = DEFAULT_API_PREFIX,
    headers,
    fetch: fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_REMOTE_TIMEOUT_MS,
    retries = DEFAULT_REMOTE_RETRIES,
    body: extraBody,
    toolFeedback,
    onToolCall,
    onTurnComplete,
  } = options;

  if (!fetchImpl) {
    throw new Error('@mastra/livekit: no fetch implementation available; pass `fetch` or run on Node ≥ 22.');
  }
  const url = `${trimTrailingSlash(baseUrl)}${apiPrefix}/agents/${agentId}/stream`;

  return ctx => {
    if (ctx.messages.length === 0) return null;

    // Reassigned per retry attempt (see the loop below) so a watchdog abort on one attempt can't
    // poison the next; `cancel()` always aborts whichever attempt is currently in flight.
    let currentAbortController: AbortController | undefined;
    let cancelled = false;
    // Accumulated as the turn streams so the post-turn hook sees what was actually produced.
    let replyText = '';
    const toolCalls: VoiceToolCall[] = [];
    let usage: VoiceTurnUsage | undefined;

    const emitTurnComplete = (interrupted: boolean) => {
      if (!onTurnComplete) return;
      const completeCtx: VoiceTurnCompleteContext = {
        ...ctx,
        result: { text: replyText, toolCalls, interrupted, usage },
      };
      Promise.resolve()
        .then(() => onTurnComplete(completeCtx))
        .catch(error => {
          console.warn('@mastra/livekit: onTurnComplete hook threw', error);
        });
    };

    const requestBody: Record<string, unknown> = {
      messages: ctx.messages,
      // The server schema requires a resource when memory is present; default it to the thread id,
      // matching the worker's own thread bootstrap.
      memory: ctx.memory
        ? { thread: ctx.memory.thread, resource: ctx.memory.resource ?? ctx.memory.thread }
        : undefined,
      requestContext: serializeRequestContext(ctx.requestContext),
      ...extraBody,
    };

    return new ReadableStream<string>({
      start: async controller => {
        // `retryable` is the LiveKit contract flag: true only before the first chunk is emitted, so a
        // voice turn is never replayed half-heard. It also gates the standalone connect-retry.
        let retryable = true;
        try {
          for (let attempt = 0; ; attempt++) {
            // A fresh controller per attempt: reusing one across retries meant a watchdog abort on an
            // earlier attempt left every subsequent attempt's fetch already-aborted before it started.
            const abortController = new AbortController();
            currentAbortController = abortController;
            let timedOut = false;
            let watchdog: ReturnType<typeof setTimeout> | undefined;
            const clearWatchdog = () => {
              if (watchdog) {
                clearTimeout(watchdog);
                watchdog = undefined;
              }
            };
            try {
              watchdog = setTimeout(() => {
                timedOut = true;
                abortController.abort();
              }, timeoutMs);
              (watchdog as { unref?: () => void }).unref?.();

              const resolvedHeaders = await resolveHeaders(headers);
              if (cancelled) {
                clearWatchdog();
                break;
              }
              const response = await fetchImpl(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'text/event-stream', ...resolvedHeaders },
                body: JSON.stringify(requestBody),
                signal: abortController.signal,
              });
              if (!response.ok) {
                const errorBody = await safeReadBody(response);
                throw new APIStatusError({
                  message: `@mastra/livekit: Mastra agent stream request failed with status ${response.status}`,
                  options: { statusCode: response.status, body: errorBody, retryable },
                });
              }
              if (!response.body) {
                throw new APIConnectionError({
                  message: '@mastra/livekit: Mastra agent stream returned an empty response body',
                  options: { retryable },
                });
              }

              for await (const chunk of readMastraSSE(
                response.body as unknown as globalThis.ReadableStream<Uint8Array>,
                abortController.signal,
              )) {
                if (cancelled) break;
                // First chunk: the server has committed to this generation — forbid any further
                // retry so the turn can't be replayed mid-stream. The watchdog is NOT cleared here:
                // lifecycle metadata (step-start, text-start, ...) isn't proof the model is
                // producing anything, and disarming on it would turn a post-metadata stall into
                // indefinite dead air. It disarms on the first sign of model output below.
                retryable = false;
                const payload = chunk.payload ?? {};
                switch (chunk.type) {
                  case 'text-delta': {
                    const text = payload.text;
                    if (typeof text === 'string' && text) {
                      clearWatchdog();
                      replyText += text;
                      controller.enqueue(text);
                    }
                    break;
                  }
                  case 'tool-call': {
                    // A tool call is first-token progress too — the model committed to a tool run,
                    // which may legitimately outlast the connect budget before any text streams.
                    clearWatchdog();
                    const toolCall: VoiceToolCall = {
                      toolCallId: String(payload.toolCallId ?? ''),
                      toolName: String(payload.toolName ?? ''),
                      args: payload.args,
                    };
                    toolCalls.push(toolCall);
                    // Observer hooks are customer code: a throw must not tear down an otherwise
                    // healthy reply stream (same isolation as onTurnComplete).
                    try {
                      onToolCall?.(toolCall);
                    } catch (error) {
                      console.warn('@mastra/livekit: onToolCall hook threw', error);
                    }
                    if (toolFeedback) {
                      let filler: string | undefined | void;
                      try {
                        filler = toolFeedback(toolCall);
                      } catch (error) {
                        console.warn('@mastra/livekit: toolFeedback hook threw', error);
                      }
                      if (filler) controller.enqueue(filler.endsWith(' ') ? filler : `${filler} `);
                    }
                    break;
                  }
                  case 'finish': {
                    clearWatchdog();
                    const output = payload.output as { usage?: unknown } | undefined;
                    const turnUsage = mapTurnUsage(output?.usage);
                    if (turnUsage) {
                      usage = turnUsage;
                      try {
                        ctx.onUsage?.(turnUsage);
                      } catch (error) {
                        console.warn('@mastra/livekit: onUsage hook threw', error);
                      }
                    }
                    break;
                  }
                  case 'tool-call-approval':
                  case 'tool-call-suspended':
                    throw new Error(HITL_UNSUPPORTED_MESSAGE);
                  case 'error': {
                    const error = payload.error;
                    throw error instanceof Error ? error : new Error(String(error));
                  }
                  default:
                    break; // ignore everything else (text-start, step-start, tool-result, ...)
                }
              }
              clearWatchdog();
              break; // success, or a clean barge-in break out of the SSE loop
            } catch (error) {
              clearWatchdog();
              if (cancelled) break; // barge-in: not a failure, emit interrupted below

              // Classify into the LiveKit error vocabulary. Application errors thrown after streaming
              // began (an `error` chunk, a HITL chunk) are not connection failures — propagate as-is.
              let typed: APIError;
              if (timedOut) {
                typed = new APITimeoutError({ options: { retryable } });
              } else if (error instanceof APIError) {
                typed = error;
              } else if (retryable) {
                typed = new APIConnectionError({ message: toMessage(error), options: { retryable } });
              } else {
                throw error;
              }
              if (typed.retryable && attempt < retries) continue;
              throw typed;
            }
          }
          if (!cancelled) controller.close();
          // Success or clean barge-in: the turn is done either way.
          emitTurnComplete(cancelled);
        } catch (error) {
          // Barge-in never reaches here (handled above); a real failure errors the stream and does
          // not fire onTurnComplete — same contract as the in-process generator.
          if (cancelled) {
            emitTurnComplete(true);
            return;
          }
          controller.error(error);
        }
      },
      cancel: () => {
        cancelled = true;
        currentAbortController?.abort();
      },
    });
  };
}

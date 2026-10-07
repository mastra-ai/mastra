/**
 * Parity Harness
 *
 * Runs one scripted scenario on a plain `Agent`, a `createDurableAgent`
 * wrapper and a `createEventedAgent` wrapper, then asserts that what a caller
 * can observe matches across engines. Plain is the reference; durable and
 * evented are each compared to it.
 *
 * What we compare, per turn (and why):
 * - `text`           → user-visible final text
 * - `finishReason`   → terminal state
 * - `usage`          → token accounting, including the raw provider object (must round-trip through the workflow)
 * - `toolCalls`      → tool routing (id, name, args), independent of order
 * - `toolResults`    → tool outputs, independent of order
 * - `stepCount`      → loop-iteration count (catches stopWhen drift)
 * - `chunks`         → `from:type` sequence of `fullStream` (`from:type:toolName` for tool chunks)
 * - `chunkTypes`     → each chunk's `type`, in order, for exact matching (`chunksOfType`)
 * - `chunkPayloads`  → every chunk's payload, normalised (see below), so tool args,
 *                      tool results, tool errors, approvals/suspensions, tripwires,
 *                      reasoning, sources, objects and step boundaries are compared
 * - `streamedText`   → concatenated `text-delta` payloads
 * - `finishChunk`    → payload keys, reason, usage and normalised payload contents
 * - `fullOutput`     → `getFullOutput()` text, finishReason, usage, keys and the
 *                      parsed object when the run produced one
 * - `error`          → a failed run reduced to `{ name, message }`; a recorded
 *                      error is an observation like any other, so two engines
 *                      that fail the same way still compare equal
 * - `generate`       → present only on a turn driven by `generate()`, which has
 *                      no chunks to compare
 * Plus, across the whole run:
 * - `requests`       → every request sent to the model, with per-message
 *                      `createdAt` timestamps stripped
 *
 * What we deliberately do NOT compare:
 * - `runId` / message ids / timestamps      → expected to differ
 * - `response.id` / response.modelId        → set per-call, may differ
 * - `traceId` / span ids                    → see `tracing_parity` task
 * - `request` on the output                 → not a user contract
 *
 * Those are stripped everywhere they appear, including inside chunk payloads:
 * `normalizePayload` removes volatile keys recursively (see
 * `VOLATILE_PAYLOAD_KEYS`) and drops values a transport cannot carry.
 *
 * Single turn:
 *
 *     await expectEngineParity({
 *       model: { tapes: [textOnlyTape('Hi')] },
 *       buildAgent: ({ model }) => new Agent({ id: 'x', name: 'X', instructions: '...', model }),
 *       input: 'Say hi',
 *       options: { maxSteps: 2 },
 *     });
 *
 * Multi turn, with per-engine assertions on the returned results:
 *
 *     const results = await expectEngineParity({
 *       model: { respond: request => textOnlyTape(`answer to: ${lastUserText(request)}`) },
 *       buildAgent: ({ model }) => new Agent({ ..., model, memory: new MockMemory() }),
 *       run: async h => {
 *         await h.turn('First question', options);
 *         await h.turn('Second question', options);
 *       },
 *     });
 *     for (const r of Object.values(results)) expect(r.requests).toHaveLength(2);
 *
 * A `generate()` turn is driven through the handle too. It produces no chunks,
 * so it is compared through the output the caller receives, and the request the
 * model got is what both engines must have sent identically:
 *
 *     run: async h => {
 *       await h.generate('Summarise the thread');
 *     },
 *
 * A turn that suspends or awaits approval is driven to completion in the same
 * turn: `options.resume` names the continuation, and the helper calls the
 * matching API (`resumeStream` / `approveToolCall` / `declineToolCall`) with the
 * run id and tool call id it took from the suspension chunk. The continuation's
 * chunks are merged into the same turn, so `chunks`, `chunkPayloads` and the
 * resumed output are compared as one unit. A suspension always needs a
 * continuation — a turn left suspended never finishes.
 *
 *     await expectEngineParity({
 *       model: { tapes: [toolCallTape('ask', {}), textOnlyTape('Done.')] },
 *       buildAgent: ({ model }) => new Agent({ ..., model, memory: new MockMemory(), tools: { ask } }),
 *       input: 'Start',
 *       // `{ resumeData }` for a suspendSchema tool, `{ approve: true }` for
 *       // `requireToolApproval`, `{ decline: true }` to decline. An array does
 *       // several continuations in order.
 *       options: { maxSteps: 3, resume: { resumeData: { approved: true } } },
 *     });
 *
 * Documented engine differences are declared, never silently ignored:
 *
 *     differences: {
 *       durable: { reason: 'COR-1234: durable drops X', ignore: ['stepCount'] },
 *       evented: { reason: '...', expect: plain => ({ ...plain, turns: [...] }) },
 *     }
 *
 * A declared difference that no longer reproduces fails the test, so fixed
 * bugs force their override to be removed. Differences every scenario hits
 * (see `KNOWN_CHUNK_DIFFERENCES` and `KNOWN_TURN_DIFFERENCES`) are declared
 * once here, under the same rule.
 */
import { isDeepStrictEqual } from 'node:util';
import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import type { BackgroundTaskManagerConfig } from '../../../background-tasks/types';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import type { MastraCompositeStore } from '../../../storage/base';
import type { MastraModelOutput } from '../../../stream/base/output';
import type { Agent } from '../../agent';
import type { AgentExecutionOptions } from '../../agent.types';
import type { MessageListInput } from '../../message-list/types';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import type { DurableAgent, DurableAgentStreamOptions } from '../durable-agent';

// ---------------------------------------------------------------------------
// Snapshot shape — what we compare for parity
// ---------------------------------------------------------------------------

/**
 * A run that failed instead of finishing, reduced to what is stable across
 * machines: `stack` embeds the absolute checkout path, so it is never recorded.
 */
export interface ParityRunError {
  name: string;
  message: string;
}

/** Reduces a thrown value to the shape `ParitySnapshot.error` compares. */
function describeRunError(thrown: unknown): ParityRunError {
  if (thrown instanceof Error) return { name: thrown.name, message: thrown.message };
  return { name: 'Error', message: String(thrown) };
}

export interface ParitySnapshot {
  text: string;
  finishReason: string | undefined;
  usage: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
    /** The provider's raw usage object; deterministic with the mock model, so it is compared. */
    raw: unknown;
  };
  /** Sorted by `toolCallId` then `toolName` for order-independent comparison. */
  toolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }>;
  /** Sorted to match `toolCalls`. */
  toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }>;
  stepCount: number;
  /** `${from}:${type}` for every chunk on `fullStream`, in order, with `:${toolName}` appended when the payload has one. */
  chunks: string[];
  /** Each chunk's `type`, in the same order as `chunks`, for exact type matching (use with `chunksOfType`). */
  chunkTypes: string[];
  /**
   * Each chunk's payload, in the same order as `chunks`, normalised by
   * `normalizePayload`. `object` and `object-result` chunks record their parsed
   * value here as `{ object }`, because those chunks carry it outside `payload`.
   */
  chunkPayloads: unknown[];
  /** Concatenated `text-delta` payloads, as a streaming consumer would render them. */
  streamedText: string;
  /** Sorted defined payload keys, reason, usage and normalised contents of the last `finish` chunk. */
  finishChunk: { payloadKeys: string[]; reason: unknown; usage: unknown; payload: unknown };
  /** `getFullOutput()` as a non-streaming consumer reads it. */
  fullOutput: {
    text: string | undefined;
    finishReason: string | undefined;
    usage: unknown;
    keys: string[];
    /** The parsed structured output, when the run ran with one. */
    object: unknown;
  };
  /**
   * Whether the turn ran a continuation after suspending. Scenario bookkeeping
   * rather than consumer output, but it is derived from the chunk sequence both
   * sides already compare, and COR-1398 is scoped to these turns.
   */
  resumed: boolean;
  /**
   * Set on a turn driven by `generate()` rather than `stream()`. A generate
   * call produces no chunks, so the turn is compared through its full output,
   * and the scenario guard counts it as an observation of its own.
   */
  generate?: true;
  /**
   * Set when the run failed instead of finishing: `getFullOutput()` rejected,
   * the stream rejected while it was drained, or `stream()` rejected before it
   * produced one. The turn keeps whatever chunks preceded the failure, so a
   * failed run is compared across engines rather than aborting the scenario.
   */
  error?: ParityRunError;
}

/**
 * Keys whose values are expected to differ between engines or between runs, so
 * they are stripped from chunk payloads before comparison. Everything else in a
 * payload (tool args, tool results, approval/suspend payloads, tripwire
 * reasons, reasoning text, step contents, ...) is compared.
 *
 * Caveat: this matches by key name at any depth, so a tool result that happens
 * to contain a key called `timestamp` or `id` loses it too.
 */
export const VOLATILE_PAYLOAD_KEYS = new Set([
  'runId',
  'traceId',
  'spanId',
  'parentSpanId',
  'messageId',
  'responseId',
  'id',
  'modelId',
  'createdAt',
  'updatedAt',
  'timestamp',
  'startedAt',
  'endedAt',
  'request',
  'abortSignal',
  // A failed run's payload carries the error's stack, which embeds the absolute
  // checkout path and so differs on every machine.
  'stack',
]);

/**
 * Recursively strips volatile keys in `VOLATILE_PAYLOAD_KEYS` and values no
 * transport can carry, so two engines' chunk payloads compare on what a
 * consumer actually receives. Only true cycles (an object containing itself)
 * become `'[circular]'`; an object shared twice is serialised twice.
 */
export function normalizePayload(value: unknown, ancestors: readonly object[] = []): unknown {
  if (value === null) return null;
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return Buffer.from(value).toString('base64');
  if (ancestors.includes(value)) return '[circular]';
  const nested = [...ancestors, value];

  if (Array.isArray(value)) return value.map(entry => normalizePayload(entry, nested) ?? null);
  if (value instanceof Map) return normalizePayload(Object.fromEntries(value), nested);
  if (value instanceof Set) return normalizePayload([...value], nested);

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (VOLATILE_PAYLOAD_KEYS.has(key)) continue;
    const normalized = normalizePayload(entry, nested);
    // An absent key and a `undefined` value are the same thing to a consumer.
    if (normalized !== undefined) out[key] = normalized;
  }
  return out;
}

function sortByCallId<T extends { toolCallId: string; toolName: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    if (a.toolCallId !== b.toolCallId) return a.toolCallId < b.toolCallId ? -1 : 1;
    return a.toolName < b.toolName ? -1 : a.toolName > b.toolName ? 1 : 0;
  });
}

/** Chunks collected while draining every stream one turn produced. */
interface TurnChunks {
  chunks: string[];
  chunkTypes: string[];
  chunkPayloads: unknown[];
  streamedText: string;
  finishPayload: any;
  /** See `ParitySnapshot.resumed`. */
  resumed: boolean;
  /**
   * The stream the turn's output fields are read from: the last one to run.
   * Absent when the `stream()` call itself rejected.
   */
  lastOutput?: MastraModelOutput<any>;
  /** See `ParitySnapshot.error`. */
  error?: ParityRunError;
  /** See `ParitySnapshot.generate`. */
  generate?: true;
}

/**
 * `from`/`type`/`payload` are shared by every chunk `fullStream` emits.
 * Structured-output chunks additionally carry the parsed value on `object`.
 */
type StreamChunk = { from?: string; type: string; payload?: any; object?: unknown };

/**
 * Drains one stream into `acc`, returning the suspended tool call's id when the
 * turn stopped at a suspension.
 *
 * A suspending turn ends at its suspension chunk on every engine: durable and
 * evented keep the stream open until the run is resumed, so reading on would
 * never finish, and plain is stopped at the same point so the engines are
 * compared over the same span. Whatever a `resume` produced is drained into the
 * same turn, which is why draining is separate from building the snapshot.
 *
 * A stream that rejects mid-iteration stops the drain and is recorded on the
 * turn, so a failed run is still an observation.
 */
async function drainInto(acc: TurnChunks, output: MastraModelOutput<any>): Promise<string | undefined> {
  let suspendedToolCallId: string | undefined;
  try {
    for await (const chunk of output.fullStream as AsyncIterable<StreamChunk>) {
      // Tool chunks carry their tool name so a swapped tool order shows up here;
      // toolCallIds are compared through `toolCalls`/`toolResults`.
      const toolName = chunk.payload?.toolName;
      acc.chunks.push(toolName ? `${chunk.from}:${chunk.type}:${toolName}` : `${chunk.from}:${chunk.type}`);
      acc.chunkTypes.push(chunk.type);
      // `object` and `object-result` chunks carry the parsed value at the top
      // level rather than in `payload`, so it is folded into the recorded payload
      // — otherwise the value a consumer receives is never compared.
      if (chunk.type === 'object' || chunk.type === 'object-result') {
        const payload = normalizePayload(chunk.payload);
        acc.chunkPayloads.push({
          ...(typeof payload === 'object' && payload !== null ? payload : {}),
          object: normalizePayload(chunk.object),
        });
      } else {
        acc.chunkPayloads.push(normalizePayload(chunk.payload));
      }
      if (chunk.type === 'text-delta') acc.streamedText += chunk.payload?.text ?? '';
      if (chunk.type === 'finish') acc.finishPayload = chunk.payload ?? {};
      if (chunk.type === 'tool-call-suspended' || chunk.type === 'tool-call-approval') {
        suspendedToolCallId = chunk.payload?.toolCallId;
        break;
      }
    }
  } catch (thrown) {
    acc.error ??= describeRunError(thrown);
  }
  return suspendedToolCallId;
}

export async function snapshotFromOutput(output: MastraModelOutput<any>): Promise<ParitySnapshot> {
  const acc = emptyTurnChunks(output);
  await drainInto(acc, output);
  return snapshotFromDrainedTurn(acc);
}

function emptyTurnChunks(output?: MastraModelOutput<any>): TurnChunks {
  return {
    chunks: [],
    chunkTypes: [],
    chunkPayloads: [],
    streamedText: '',
    finishPayload: undefined,
    resumed: false,
    lastOutput: output,
  };
}

/**
 * A failed run can leave an individual output read rejecting (`text`, `usage`,
 * …). That rejection is not an observation of its own, so it reads as absent:
 * the failure itself is recorded once, on `ParitySnapshot.error`.
 */
async function readSettled<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/** Builds a turn's snapshot from the chunks its streams produced. */
async function snapshotFromDrainedTurn(acc: TurnChunks): Promise<ParitySnapshot> {
  const output = acc.lastOutput;
  let error = acc.error;

  let full: Awaited<ReturnType<MastraModelOutput<any>['getFullOutput']>> | undefined;
  if (output) {
    try {
      full = await output.getFullOutput();
    } catch (thrown) {
      // The run failed after it streamed: whatever it produced still stands.
      error ??= describeRunError(thrown);
    }
  }

  // A failed run's reads can reject too, because the failure rejects every
  // pending promise. That rejection is not an observation of its own — it is the
  // failure already recorded on `error` — so on a failed turn a read reads as
  // absent, while a turn that did not fail keeps surfacing its rejection.
  const read = <T>(readOutput: () => Promise<T>): Promise<T | undefined> => {
    if (!output) return Promise.resolve(undefined);
    return error ? readSettled(readOutput) : readOutput();
  };
  const [text, finishReason, usage, toolCalls, toolResults, steps] = await Promise.all([
    read(() => output!.text),
    read(() => output!.finishReason),
    read(() => output!.usage),
    read(() => output!.toolCalls),
    read(() => output!.toolResults),
    read(() => output!.steps),
  ]);

  return assembleSnapshot(acc, { text, finishReason, usage, toolCalls, toolResults, steps, full, error });
}

/**
 * A `generate()` turn. A generate call returns its full output directly, so
 * there is no stream to drain and every read is already settled.
 */
function snapshotFromGenerateResult(acc: TurnChunks, result: unknown): ParitySnapshot {
  const full = result as Awaited<ReturnType<MastraModelOutput<any>['getFullOutput']>> | undefined;
  return assembleSnapshot(acc, {
    text: full?.text,
    finishReason: full?.finishReason,
    usage: full?.usage,
    toolCalls: full?.toolCalls,
    toolResults: full?.toolResults,
    steps: full?.steps,
    full,
    error: acc.error,
  });
}

/** Everything a snapshot is assembled from, however the turn was driven. */
interface TurnReads {
  text: string | undefined;
  finishReason: string | undefined;
  usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number; raw?: unknown } | undefined;
  toolCalls: any[] | undefined;
  toolResults: any[] | undefined;
  steps: unknown[] | undefined;
  /** The run's full output, as a non-streaming consumer reads it; absent when the run failed. */
  full: Awaited<ReturnType<MastraModelOutput<any>['getFullOutput']>> | undefined;
  error: ParityRunError | undefined;
}

function assembleSnapshot(acc: TurnChunks, reads: TurnReads): ParitySnapshot {
  const { chunks, chunkTypes, chunkPayloads, streamedText, finishPayload, resumed, generate } = acc;
  const { text, finishReason, usage, toolCalls, toolResults, steps, full, error } = reads;

  return {
    text: text ?? '',
    finishReason: finishReason as string | undefined,
    usage: {
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      totalTokens: usage?.totalTokens,
      // Deterministic with the mock model, so compare it rather than dropping it.
      raw: (usage as { raw?: unknown } | undefined)?.raw,
    },
    toolCalls: sortByCallId(
      (toolCalls ?? []).map((c: any) => ({
        toolCallId: c.toolCallId ?? c.payload?.toolCallId,
        toolName: c.toolName ?? c.payload?.toolName,
        args: c.args ?? c.input ?? c.payload?.args,
      })),
    ),
    toolResults: sortByCallId(
      (toolResults ?? []).map((r: any) => ({
        toolCallId: r.toolCallId ?? r.payload?.toolCallId,
        toolName: r.toolName ?? r.payload?.toolName,
        result: r.result ?? r.output ?? r.payload?.result,
      })),
    ),
    stepCount: steps?.length ?? 0,
    chunks,
    chunkTypes,
    chunkPayloads,
    streamedText,
    finishChunk: {
      // Keys holding `undefined` are not observable over any serialized transport.
      payloadKeys: Object.keys(finishPayload ?? {})
        .filter(k => finishPayload[k] !== undefined)
        .sort(),
      reason: finishPayload?.stepResult?.reason ?? finishPayload?.finishReason,
      usage: finishPayload?.usage ?? finishPayload?.output?.usage,
      payload: normalizePayload(finishPayload),
    },
    fullOutput: {
      text: full?.text,
      finishReason: full?.finishReason as string | undefined,
      usage: full?.usage,
      // A run whose `getFullOutput()` rejected has no full output to read.
      keys: full ? Object.keys(full).sort() : [],
      // The object the run parsed, when it ran with structured output.
      object: full?.object,
    },
    resumed,
    // Omitted rather than set to `undefined`, so a turn that did not fail
    // serialises exactly as it did before this field existed.
    ...(error ? { error } : {}),
    // Likewise omitted on a streamed turn.
    ...(generate ? { generate } : {}),
  };
}

/**
 * How many chunks of a given `type` a turn streamed. Matches the type exactly,
 * so a tool named `finish` does not count as a finish chunk.
 */
export function chunksOfType(turn: ParitySnapshot, type: string): number {
  return turn.chunkTypes.filter(t => t === type).length;
}

// ---------------------------------------------------------------------------
// Request-recording mock model
// ---------------------------------------------------------------------------

export type ModelTape = ReadonlyArray<Readonly<Record<string, unknown>>>;

/** A model call's options as the engine sent them, minus the abort signal. */
export type CapturedRequest = Omit<LanguageModelV2CallOptions, 'abortSignal'>;

export type ModelScript =
  /** One tape per model call; once exhausted, the last tape repeats. */
  | { tapes: ReadonlyArray<ModelTape> }
  /** Builds each call's tape from the request (e.g. echo the last user message). */
  | { respond: (request: CapturedRequest, callIndex: number) => ModelTape };

export interface RecordingModel {
  model: LanguageModelV2;
  /** One entry per model call, in call order. */
  requests: CapturedRequest[];
}

/**
 * Folds a stream tape into the result a `doGenerate` call returns. The tape
 * describes what a streaming consumer sees; this is the same call as a
 * non-streaming consumer sees it, which is what `generate()` reads.
 */
function tapeToGenerateResult(tape: ModelTape): Awaited<ReturnType<LanguageModelV2['doGenerate']>> {
  const text = tape
    .filter(part => part.type === 'text-delta')
    .map(part => String(part.delta ?? ''))
    .join('');
  const toolCalls = tape
    .filter(part => part.type === 'tool-call')
    .map(part => ({
      type: 'tool-call' as const,
      toolCallId: String(part.toolCallId),
      toolName: String(part.toolName),
      input: String(part.input ?? '{}'),
    }));
  const finish = tape.find(part => part.type === 'finish');

  return {
    content: [...(text ? [{ type: 'text' as const, text }] : []), ...toolCalls],
    finishReason: (finish?.finishReason ?? 'stop') as Awaited<
      ReturnType<LanguageModelV2['doGenerate']>
    >['finishReason'],
    usage: (finish?.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 }) as Awaited<
      ReturnType<LanguageModelV2['doGenerate']>
    >['usage'],
    warnings: [],
  };
}

/** Creates a fresh mock model that records every request it receives. */
export function createRecordingModel(script: ModelScript): RecordingModel {
  const requests: CapturedRequest[] = [];
  const record = (options: LanguageModelV2CallOptions): { request: CapturedRequest; tape: ModelTape } => {
    const { abortSignal: _abortSignal, ...rest } = options;
    const request = structuredClone(rest);
    const callIndex = requests.length;
    requests.push(request);
    const tape =
      'respond' in script
        ? script.respond(request, callIndex)
        : script.tapes[Math.min(callIndex, script.tapes.length - 1)]!;
    return { request, tape };
  };

  const model = new MockLanguageModelV2({
    doStream: async (options: LanguageModelV2CallOptions) => {
      const { tape } = record(options);
      return {
        stream: convertArrayToReadableStream(tape as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
    // Plain's `generate()` calls `doGenerate`; the wrapped engines reach the
    // same scripted outcome through the workflow. Both record the request the
    // same way, so `requests` compares across engines either way.
    doGenerate: async (options: LanguageModelV2CallOptions) => {
      const { tape } = record(options);
      return tapeToGenerateResult(tape);
    },
  }) as unknown as LanguageModelV2;

  return { model, requests };
}

/** Text of the last user message in a captured request's prompt. */
export function lastUserText(request: CapturedRequest): string {
  const lastUser = [...request.prompt].reverse().find(m => m.role === 'user');
  if (!lastUser || typeof lastUser.content === 'string') return '';
  return lastUser.content.map(part => (part.type === 'text' ? part.text : '')).join('');
}

/**
 * Strips values that legitimately differ between engines or runs: the
 * `providerOptions.mastra.createdAt` stamp Mastra puts on each prompt message
 * and part, and `includeRawChunks: false` (plain sends `false`, durable and
 * evented leave it unset). Core treats both the same: `loop.ts` passes
 * `includeRawChunks: !!includeRawChunks` to the model, and
 * `llm-execution-step.ts` / `stream/base/output.ts` only emit `raw` chunks when
 * that flag is truthy. `true` is still compared. Nothing else, and nowhere
 * else, is touched.
 */
export function normalizeRequest(request: CapturedRequest): unknown {
  const withoutCreatedAt = <T extends { providerOptions?: unknown }>(node: T): T => {
    const providerOptions = node.providerOptions as Record<string, any> | undefined;
    if (!providerOptions?.mastra || !('createdAt' in providerOptions.mastra)) return node;
    const { createdAt: _createdAt, ...mastra } = providerOptions.mastra;
    return { ...node, providerOptions: { ...providerOptions, mastra } };
  };
  const { includeRawChunks, ...rest } = request;
  return {
    ...(includeRawChunks ? request : rest),
    prompt: request.prompt.map(message => {
      const normalized = withoutCreatedAt(message);
      return Array.isArray(normalized.content)
        ? { ...normalized, content: (normalized.content as Array<{ providerOptions?: unknown }>).map(withoutCreatedAt) }
        : normalized;
    }),
  };
}

// ---------------------------------------------------------------------------
// Canned tapes — reusable building blocks for parity scenarios
// ---------------------------------------------------------------------------

export function textOnlyTape(
  text: string,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number } = {
    inputTokens: 10,
    outputTokens: 20,
    totalTokens: 30,
  },
): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'parity-id-0', modelId: 'parity-model', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage },
  ];
}

export function toolCallTape(
  toolName: string,
  args: Record<string, unknown>,
  toolCallId = 'parity-call-1',
  usage: { inputTokens: number; outputTokens: number; totalTokens: number } = {
    inputTokens: 15,
    outputTokens: 10,
    totalTokens: 25,
  },
): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'parity-id-tool', modelId: 'parity-model', timestamp: new Date(0) },
    { type: 'tool-call', toolCallId, toolName, input: JSON.stringify(args), providerExecuted: false },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ];
}

// ---------------------------------------------------------------------------
// expectEngineParity — the main entry point for parity tests
// ---------------------------------------------------------------------------

export type ParityEngine = 'plain' | 'durable' | 'evented';
export const PARITY_ENGINES: readonly ParityEngine[] = ['plain', 'durable', 'evented'];

/**
 * Stream options every engine types identically. `onStepFinish` and
 * `structuredOutput` are typed differently on plain and durable agents, so
 * scenarios that need them must build engine-specific options.
 */
export type ParityStreamOptions = Omit<
  DurableAgentStreamOptions<any>,
  '_skipBgTaskWait' | 'structuredOutput' | 'onStepFinish'
> &
  Pick<AgentExecutionOptions<any>, 'maxSteps' | 'toolChoice' | 'activeTools'>;

/** What one engine produced for a whole scenario; this is what gets compared. */
export interface EngineObservation {
  turns: ParitySnapshot[];
  requests: CapturedRequest[];
}

export type ParityField = keyof ParitySnapshot | 'requests';

export interface EngineDifference {
  /** Why this engine differs (ticket id + cause). Required. */
  reason: string;
  /** Fields not compared for this engine. Each must actually differ from plain. */
  ignore?: ParityField[];
  /** This engine's expected observation, derived from plain's. */
  expect?: (plain: EngineObservation) => EngineObservation;
}

export interface EngineHandle {
  engine: ParityEngine;
  /** The plain Agent this engine wraps (or runs, for `plain`). */
  agent: Agent<string, any, any>;
  /** Streams one turn on this engine, drains it and records its snapshot. */
  turn: (messages: MessageListInput, options?: EngineTurnOptions) => Promise<ParitySnapshot>;
  /**
   * Runs one `generate()` turn on this engine and records its snapshot. A
   * generate call has no chunks, so the turn is compared through its full
   * output; a rejected call is recorded on `error`, like a failed stream.
   */
  generate: (messages: MessageListInput, options?: ParityStreamOptions) => Promise<ParitySnapshot>;
}

/**
 * How to continue a turn that suspended, applied in the order given. The
 * suspended tool call to continue is read from the suspension chunk, so it is
 * never passed here. A turn streams straight to its suspension chunk first:
 * one `resume` then produces a second stream, and both are recorded as the same
 * turn because the turn is one input from the caller's point of view.
 */
export type TurnResume =
  /** `agent.resumeStream(resumeData, …)` — the resumed tool returns `resumeData`. */
  | { resumeData: unknown }
  /** `agent.approveToolCall(…)` — approval, equivalent to `resumeData: { approved: true }`. */
  | { approve: true }
  /** `agent.declineToolCall(…)`. */
  | { decline: true };

/** `ParityStreamOptions` plus the helper-only `resume` continuations. */
export type EngineTurnOptions = ParityStreamOptions & { resume?: TurnResume | readonly TurnResume[] };

export interface EngineParityScenario {
  /** Scripted model. A fresh recording model is built for every engine. */
  model: ModelScript;
  /** Builds a fresh Agent for one engine. Must use the provided `model`. */
  buildAgent: (ctx: { engine: ParityEngine; model: LanguageModelV2 }) => Agent<string, any, any>;
  /** Single-turn input. Ignored when `run` is given. */
  input?: MessageListInput;
  /** Single-turn stream options. Ignored when `run` is given. */
  options?: EngineTurnOptions;
  /** Drives the scenario on one engine. Defaults to one turn of `input`/`options`. */
  run?: (handle: EngineHandle) => Promise<void>;
  /** Engines to run. Defaults to all three; must include `plain` and one other. */
  engines?: readonly ParityEngine[];
  /** Documented differences from plain, per engine. */
  differences?: Partial<Record<Exclude<ParityEngine, 'plain'>, EngineDifference>>;
  /** Storage for the evented engine's Mastra host. Defaults to a fresh `InMemoryStore`. */
  createStorage?: () => MastraCompositeStore;
  /**
   * Extra host options. A background-task scenario needs the host to enable
   * them (`backgroundTasks`) and its workers running, which the helper then
   * does before the run. Without both, a deferred tool call degrades silently
   * to a foreground run, so the scenario would pass without ever dispatching
   * anything.
   */
  host?: { backgroundTasks?: BackgroundTaskManagerConfig };
}

export interface EngineRunResult extends EngineObservation {
  engine: ParityEngine;
  agent: Agent<string, any, any>;
}

export type EngineParityResults = Partial<Record<ParityEngine, EngineRunResult>>;

/**
 * Marks an error as harness misuse rather than a run failure. `turn()` records
 * a failed run and compares it, but a scenario that breaks the harness contract
 * (a resume with nothing to resume, a turn left suspended) must still surface.
 */
const MISUSE = Symbol('parityMisuse');

function parityMisuse(message: string): Error {
  const error = new Error(`expectEngineParity: ${message}`);
  (error as Error & { [MISUSE]?: true })[MISUSE] = true;
  return error;
}

function isParityMisuse(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { [MISUSE]?: true })[MISUSE] === true;
}

/**
 * Runs the scenario on every engine and asserts durable and evented match
 * plain, apart from declared differences. Returns each engine's observation
 * for scenario-specific assertions.
 */
export async function expectEngineParity(scenario: EngineParityScenario): Promise<EngineParityResults> {
  const requested = scenario.engines ?? PARITY_ENGINES;
  const compared = [...new Set(requested)].filter((e): e is Exclude<ParityEngine, 'plain'> => e !== 'plain');
  if (!requested.includes('plain') || compared.length === 0 || new Set(requested).size !== requested.length) {
    throw new Error('expectEngineParity: engines must list "plain" and at least one other engine, each once');
  }
  if (!scenario.run && scenario.input === undefined) {
    throw new Error('expectEngineParity: provide `input` or `run`');
  }

  // Plain first, so it's the reference regardless of the order given.
  const results: EngineParityResults = { plain: await runOnEngine('plain', scenario) };
  const plain = results.plain!;
  // Equal empty observations would compare as parity. A turn that recorded an
  // error is an observation of its own — a run that failed on every engine the
  // same way is parity, and that is what the failed-run cases assert. So is a
  // generate turn, which produces no chunks by design.
  if (plain.turns.length === 0 || plain.turns.every(t => t.chunks.length === 0 && !t.error && !t.generate)) {
    throw new Error('expectEngineParity: the scenario produced no turns or no stream chunks on plain');
  }
  for (const engine of compared) results[engine] = await runOnEngine(engine, scenario);

  const failures: string[] = [];
  for (const engine of compared) failures.push(...checkEngine(engine, plain, results[engine]!, scenario));
  if (failures.length > 0) throw new Error(`Engine parity failed:\n\n${failures.join('\n\n')}`);

  return results;
}

async function runOnEngine(engine: ParityEngine, scenario: EngineParityScenario): Promise<EngineRunResult> {
  const { model, requests } = createRecordingModel(scenario.model);
  const agent = scenario.buildAgent({ engine, model });

  let wrapper: DurableAgent<string, any, any> | undefined;
  if (engine === 'durable') {
    wrapper = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
  } else if (engine === 'evented') {
    wrapper = createEventedAgent({ agent });
  }

  // Every engine runs on a host, as it would in a real app: a suspended run is
  // only resumable when the run's snapshot reached storage, and a deferred
  // background task is only dispatched when the host manages them and its
  // workers are running. Both need the host the engines actually share.
  const host = new Mastra({
    agents: { [agent.id]: wrapper ?? agent },
    storage: scenario.createStorage?.() ?? new InMemoryStore(),
    logger: false,
    ...scenario.host,
  });
  // Workers are a host concern, not an agent one: the run only sees a bound
  // manager once they are up.
  if (scenario.host?.backgroundTasks?.enabled) await host.startWorkers();

  const turns: ParitySnapshot[] = [];
  const cleanups: Array<() => void | Promise<void>> = [];
  const handle: EngineHandle = {
    engine,
    agent,
    turn: async (messages, options) => {
      const { resume, ...streamOptions } = options ?? {};
      const continuations: readonly TurnResume[] =
        resume === undefined ? [] : Array.isArray(resume) ? resume : [resume as TurnResume];
      // Vitest stubs randomUUID per test, so give every run its own id.
      const runId = streamOptions.runId ?? `parity-${engine}-${turns.length}`;
      // `wrapper` is a DurableAgent whose overridden option types are narrower
      // than Agent's, so only the shared resume surface is typed here.
      const target: Pick<Agent<string, any, any>, 'resumeStream' | 'approveToolCall' | 'declineToolCall'> = wrapper ??
      agent;
      const acc = emptyTurnChunks();
      // The stream whose output the snapshot reads; a continuation replaces it.
      let streamed: MastraModelOutput<any> | undefined;

      try {
        if (wrapper) {
          const result = await wrapper.stream(messages, { ...streamOptions, runId });
          cleanups.push(result.cleanup);
          streamed = result.output;
        } else {
          streamed = await agent.stream(messages, { ...streamOptions, runId });
        }
        let suspendedToolCallId = await drainInto(acc, streamed);

        for (const continuation of continuations) {
          if (!suspendedToolCallId) {
            throw parityMisuse('turn() was given a `resume`, but the turn did not suspend');
          }
          const resumeOptions = { ...streamOptions, runId, toolCallId: suspendedToolCallId };
          if ('resumeData' in continuation) {
            streamed = await target.resumeStream(continuation.resumeData, resumeOptions);
          } else if ('approve' in continuation) {
            streamed = await target.approveToolCall(resumeOptions);
          } else {
            streamed = await target.declineToolCall(resumeOptions);
          }
          suspendedToolCallId = await drainInto(acc, streamed);
          acc.resumed = true;
        }

        // A turn that is still suspended leaves its output stream open until a
        // resume, so reading the output here would hang until the test times out.
        // The missing continuation is the real problem, so report that instead.
        if (suspendedToolCallId) {
          throw parityMisuse(
            `turn ${turns.length} on ${engine} ended suspended on tool call ` +
              `'${suspendedToolCallId}'; add a \`resume\` continuation`,
          );
        }
      } catch (error) {
        // The run failed — a `stream()` or continuation call rejected, or the
        // stream rejected mid-drain. That is an observation to compare, not a
        // reason to abort the scenario, so it is recorded on the turn.
        if (isParityMisuse(error)) throw error;
        acc.error ??= describeRunError(error);
      }

      acc.lastOutput = streamed;
      const snapshot = await snapshotFromDrainedTurn(acc);
      turns.push(snapshot);
      return snapshot;
    },
    generate: async (messages, options) => {
      // Vitest stubs randomUUID per test, so give every run its own id.
      const runId = options?.runId ?? `parity-${engine}-${turns.length}`;
      const acc = emptyTurnChunks();
      acc.generate = true;

      let result: unknown;
      try {
        result = wrapper
          ? await wrapper.generate(messages, { ...options, runId })
          : await agent.generate(messages, { ...options, runId });
      } catch (error) {
        // A rejected generate() is an observation to compare, like a failed run.
        acc.error ??= describeRunError(error);
      }

      const snapshot = snapshotFromGenerateResult(acc, result);
      turns.push(snapshot);
      return snapshot;
    },
  };

  let scenarioFailed = false;
  try {
    if (wrapper && engine === 'evented') {
      // Without atomic storage the evented agent silently runs on the default
      // engine, which would make "evented == plain" a durable-vs-plain check.
      // Checked inside the try so a failed check still shuts the host down.
      const engineType = (wrapper.getWorkflow() as { engineType?: string }).engineType;
      if (engineType !== 'evented') {
        throw new Error(`expectEngineParity: evented agent resolved to the '${engineType}' engine, not 'evented'`);
      }
    }
    if (scenario.run) await scenario.run(handle);
    else await handle.turn(scenario.input!, scenario.options);
  } catch (error) {
    scenarioFailed = true;
    throw error;
  } finally {
    // Every cleanup runs even if one throws; a scenario error takes precedence.
    const errors: unknown[] = [];
    for (const cleanup of cleanups) {
      try {
        await cleanup();
      } catch (error) {
        errors.push(error);
      }
    }
    // Stop the host so many scenarios in one file don't pile up, including the
    // workers a background-task scenario started. Done last, after the runs'
    // own cleanups.
    try {
      await host.shutdown();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length > 0 && !scenarioFailed) throw errors[0];
  }

  return { engine, agent, turns, requests };
}

/**
 * Documented chunk-payload differences between plain and the wrapped engines.
 *
 * Durable and evented re-emit the loop's chunks after round-tripping them
 * through workflow step state, so some payloads are slimmed, some gain workflow
 * bookkeeping and some lose fields the loop set. Each divergence is a real
 * product difference tracked by a ticket, so it is declared here once instead of
 * being repeated in every case's `differences`.
 *
 * A declaration removes only the named paths, from BOTH sides, before comparing:
 * everything else in those payloads is still compared, and nothing is added to
 * `VOLATILE_PAYLOAD_KEYS`. `staleKnownDifferences` fails as soon as a declared
 * path matches on both sides, a wrapped engine starts emitting a declared
 * missing key, or the declared difference stops reproducing at all.
 *
 * Differences in a turn's assembled output rather than in a chunk are declared
 * in `KNOWN_TURN_DIFFERENCES` below, under the same rules.
 */
interface KnownChunkDifference {
  /** Ticket tracking the divergence. */
  ticket: string;
  /** Why the wrapped engines legitimately differ here. */
  reason: string;
  /** Chunk `type` in the `fullStream` sequence. */
  chunkType: string;
  /** Dot paths inside that chunk's payload, removed from both sides before comparing. */
  paths: readonly string[];
  /**
   * Declared paths the wrapped engines omit entirely, so they are also left out
   * of the finish chunk's compared key list. Only the `finish` entry has them.
   */
  missingKeys?: readonly string[];
}

const KNOWN_CHUNK_DIFFERENCES: readonly KnownChunkDifference[] = [
  {
    ticket: 'COR-1390',
    reason:
      'Durable and evented omit the finish envelope keys plain emits, and structure `output`/`stepResult` differently ' +
      '(plain keeps `steps[].content`/`response`; they emit slimmer steps plus `warnings`/`totalUsage`).',
    chunkType: 'finish',
    // Which of these plain emits depends on the scenario (`response` and
    // `messageId` only appear with memory), so the check below only requires
    // plain to emit some of them and a wrapped engine to emit none.
    missingKeys: ['messageId', 'messages', 'metadata', 'processorRetryCount', 'response'],
    paths: ['messageId', 'messages', 'metadata', 'processorRetryCount', 'response', 'output', 'stepResult'],
  },
  {
    ticket: 'COR-1390',
    reason: 'Durable and evented add the workflow step id to the step-start chunk payload.',
    chunkType: 'step-start',
    paths: ['stepId'],
  },
  {
    ticket: 'COR-1390',
    reason:
      'Durable and evented re-emit the loop step-finish payload as the serialised workflow step envelope: extra ' +
      '`type`/`_durableStepContent`, empty `messages`, `metadata` without model metadata, a slim `output` and no ' +
      '`processorRetryCount`.',
    chunkType: 'step-finish',
    paths: [
      'type',
      '_durableStepContent',
      'processorRetryCount',
      'metadata.modelMetadata',
      'messages.all',
      'messages.user',
      'messages.nonUser',
      'output.text',
      'output.steps',
      'output.toolCalls',
    ],
  },
];

/**
 * Documented differences in a turn's assembled output rather than in one chunk.
 *
 * Same rule as `KNOWN_CHUNK_DIFFERENCES`: each entry names the turns and the
 * exact shape it was filed for, so a different value in the same field is still
 * a failure, and `staleKnownDifferences` fails once the difference stops
 * reproducing.
 */
interface KnownTurnDifference {
  /** Ticket tracking the divergence. */
  ticket: string;
  /** Why the wrapped engines legitimately differ here. */
  reason: string;
  /** The `ParitySnapshot` field the wrapped engines differ in. */
  field: keyof ParitySnapshot;
  /** Turns the divergence applies to. */
  appliesTo: (turn: ParitySnapshot) => boolean;
  /** The shape that was filed; any other value in that field still fails. */
  matches: (wrapped: unknown, plain: unknown) => boolean;
}

const KNOWN_TURN_DIFFERENCES: readonly KnownTurnDifference[] = [
  {
    ticket: 'COR-1398',
    reason:
      'Durable and evented rebuild their output from the resumed chunks only, so after a resume they keep the ' +
      '`toolResults` entry for the tool call that suspended but not the matching `toolCalls` entry.',
    field: 'toolCalls',
    appliesTo: turn => turn.resumed,
    matches: (wrapped, plain) => isEmptyValue(wrapped) && !isEmptyValue(plain),
  },
];

function declaredMissingKeysFor(chunkType: string): string[] {
  return KNOWN_CHUNK_DIFFERENCES.filter(d => d.chunkType === chunkType).flatMap(d => [...(d.missingKeys ?? [])]);
}

/** Indexes of every chunk of one type in a turn, in order. */
function indexesOfType(turn: ParitySnapshot, chunkType: string): number[] {
  return turn.chunkTypes.flatMap((type, index) => (type === chunkType ? [index] : []));
}

/** Whether a value carries no content, so two of them differ in nothing. */
function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function getAtPath(target: unknown, path: string): unknown {
  let node: unknown = target;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function deleteAtPath(target: unknown, path: string): void {
  const parts = path.split('.');
  let node: unknown = target;
  for (const part of parts.slice(0, -1)) {
    if (node === null || typeof node !== 'object') return;
    node = (node as Record<string, unknown>)[part];
  }
  if (node !== null && typeof node === 'object') delete (node as Record<string, unknown>)[parts[parts.length - 1]!];
}

/** A copy of a chunk payload with the declared differences removed. */
function withoutDeclaredPayloadDifferences(chunkType: string, payload: unknown): unknown {
  const declarations = KNOWN_CHUNK_DIFFERENCES.filter(d => d.chunkType === chunkType);
  if (declarations.length === 0) return payload;
  const copy = structuredClone(payload);
  for (const declared of declarations) {
    for (const path of declared.paths) deleteAtPath(copy, path);
  }
  return copy;
}

/**
 * Aligns the output-level declared differences with the reference, so a wrapped
 * engine's field is not compared. Applied to the wrapped side only, because the
 * declared shape names what the wrapped engine does.
 */
function withoutKnownTurnDifferences(reference: ParitySnapshot | undefined, turn: ParitySnapshot): ParitySnapshot {
  if (!reference) return turn;
  let stripped = turn;
  for (const declared of KNOWN_TURN_DIFFERENCES) {
    if (!declared.appliesTo(turn) || !declared.appliesTo(reference)) continue;
    if (!declared.matches(turn[declared.field], reference[declared.field])) continue;
    stripped = { ...stripped, [declared.field]: reference[declared.field] };
  }
  return stripped;
}

/**
 * Removes the declared differences from an observation. `side` says whose
 * observation this is: chunk-level declarations apply to both sides equally,
 * while output-level ones only ever describe the wrapped side.
 */
function withoutKnownEngineDifferences(
  reference: EngineObservation,
  observation: EngineObservation,
  side: 'plain' | 'wrapped',
): EngineObservation {
  return {
    ...observation,
    turns: observation.turns.map((turn, index) => {
      const stripped: ParitySnapshot = {
        ...turn,
        chunkPayloads: turn.chunkPayloads.map((payload, i) =>
          withoutDeclaredPayloadDifferences(turn.chunkTypes[i] ?? '', payload),
        ),
        // The finish chunk is compared twice: as `finishChunk` and in `chunkPayloads`.
        finishChunk: {
          ...turn.finishChunk,
          payloadKeys: turn.finishChunk.payloadKeys.filter(k => !declaredMissingKeysFor('finish').includes(k)),
          payload: withoutDeclaredPayloadDifferences('finish', turn.finishChunk.payload),
        },
      };
      return side === 'wrapped' ? withoutKnownTurnDifferences(reference.turns[index], stripped) : stripped;
    }),
  };
}

/**
 * Failures when a declared chunk difference no longer reproduces. Chunks are
 * paired by index within their type, which is enough because the `chunks` field
 * already reports a sequence mismatch.
 */
export function staleKnownDifferences(engine: string, plain: EngineObservation, actual: EngineObservation): string[] {
  const failures: string[] = [];
  for (const declared of KNOWN_CHUNK_DIFFERENCES) {
    const plainHasChunks = plain.turns.some(turn => indexesOfType(turn, declared.chunkType).length > 0);
    let sawDifference = false;
    let plainEmitsMissingKey = false;

    plain.turns.forEach((turn, i) => {
      const wrapped = actual.turns[i];
      if (!wrapped) return;
      const wrappedIndexes = indexesOfType(wrapped, declared.chunkType);
      indexesOfType(turn, declared.chunkType).forEach((plainIndex, n) => {
        const wrappedIndex = wrappedIndexes[n];
        if (wrappedIndex === undefined) return;
        const plainPayload = turn.chunkPayloads[plainIndex];
        const wrappedPayload = wrapped.chunkPayloads[wrappedIndex];

        for (const path of declared.paths) {
          const plainValue = getAtPath(plainPayload, path);
          const wrappedValue = getAtPath(wrappedPayload, path);
          // Two empty values are no difference to declare, and none to fix:
          // e.g. a message list the run never filled in on either engine.
          if (isDeepStrictEqual(plainValue, wrappedValue) && (isEmptyValue(plainValue) || isEmptyValue(wrappedValue))) {
            continue;
          }
          if (isDeepStrictEqual(plainValue, wrappedValue)) {
            failures.push(
              `${engine}: turns[${i}] ${declared.chunkType} payload '${path}' no longer differs from plain; ` +
                `remove it from KNOWN_CHUNK_DIFFERENCES (${declared.ticket})`,
            );
          } else {
            sawDifference = true;
          }
        }
        for (const key of declared.missingKeys ?? []) {
          if (key in (plainPayload as Record<string, unknown>)) plainEmitsMissingKey = true;
          if (key in (wrappedPayload as Record<string, unknown>)) {
            failures.push(
              `${engine}: turns[${i}] ${declared.chunkType} payload now includes '${key}'; ` +
                `remove it from KNOWN_CHUNK_DIFFERENCES (${declared.ticket})`,
            );
          }
        }
      });
    });

    if (plainHasChunks && !sawDifference) {
      failures.push(
        `${engine}: the declared ${declared.chunkType} chunk difference no longer reproduces; ` +
          `remove it from KNOWN_CHUNK_DIFFERENCES (${declared.ticket})`,
      );
    }
    if (declared.missingKeys && plainHasChunks && !plainEmitsMissingKey) {
      failures.push(
        `${engine}: plain's ${declared.chunkType} payload no longer includes any of ` +
          `${declared.missingKeys.join(', ')}; update KNOWN_CHUNK_DIFFERENCES (${declared.ticket})`,
      );
    }
  }

  for (const declared of KNOWN_TURN_DIFFERENCES) {
    const reproduced = plain.turns.some((turn, i) => {
      if (!declared.appliesTo(turn)) return false;
      const wrapped = actual.turns[i];
      return !!wrapped && declared.matches(wrapped[declared.field], turn[declared.field]);
    });
    if (!reproduced && plain.turns.some(declared.appliesTo)) {
      failures.push(
        `${engine}: the declared ${declared.field} difference no longer reproduces; ` +
          `remove it from KNOWN_TURN_DIFFERENCES (${declared.ticket})`,
      );
    }
  }
  return failures;
}

function checkEngine(
  engine: Exclude<ParityEngine, 'plain'>,
  reference: EngineObservation,
  actual: EngineObservation,
  scenario: EngineParityScenario,
): string[] {
  const stale = staleKnownDifferences(engine, reference, actual);
  if (stale.length > 0) return stale;

  const plain = withoutKnownEngineDifferences(reference, reference, 'plain');
  const observed = withoutKnownEngineDifferences(reference, actual, 'wrapped');
  const difference = scenario.differences?.[engine];
  const raw = compareObservations(plain, observed, new Set());

  if (!difference) return raw.map(m => `${engine} differs from plain at ${m.path}:\n${m.message}`);

  if (!difference.reason?.trim()) return [`${engine}: declared difference has no reason`];

  // A declared difference must still reproduce, piece by piece, or it hides a fixed bug.
  const failures: string[] = [];
  const stillDiffers = new Set(raw.map(m => m.path));
  if (raw.length === 0) {
    failures.push(`${engine}: declared difference no longer reproduces; remove it (reason: ${difference.reason})`);
  }
  const ignore = new Set(difference.ignore ?? []);
  for (const field of ignore) {
    if (!raw.some(m => m.field === field)) {
      failures.push(`${engine}: ignored field '${field}' matches plain; remove it (reason: ${difference.reason})`);
    }
  }

  const expected = difference.expect
    ? difference.expect(structuredClone({ turns: plain.turns, requests: plain.requests }))
    : plain;
  for (const m of compareObservations(plain, expected, ignore)) {
    if (!stillDiffers.has(m.path)) {
      failures.push(
        `${engine}: declared expectation at ${m.path} no longer differs from plain; remove it (reason: ${difference.reason})`,
      );
    }
  }
  for (const m of compareObservations(expected, observed, ignore)) {
    failures.push(
      `${engine} differs from its declared expectation at ${m.path} (reason: ${difference.reason}):\n${m.message}`,
    );
  }
  return failures;
}

function show(value: unknown): string {
  if (value === undefined) return 'undefined';
  const json = JSON.stringify(value);
  return json.length > 300 ? `${json.slice(0, 300)}…` : json;
}

/** Every leaf path where `actual` and `expected` differ . */
function diffLeaves(
  actual: unknown,
  expected: unknown,
  path: string,
): Array<{ path: string; actual: unknown; expected: unknown }> {
  const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof Uint8Array);
  if (Array.isArray(actual) && Array.isArray(expected)) {
    const out = [];
    if (actual.length !== expected.length) {
      out.push({ path: `${path}.length`, actual: actual.length, expected: expected.length });
    }
    for (let i = 0; i < Math.min(actual.length, expected.length); i++) {
      out.push(...diffLeaves(actual[i], expected[i], `${path}[${i}]`));
    }
    return out;
  }
  if (isObject(actual) && isObject(expected) && !Array.isArray(actual) && !Array.isArray(expected)) {
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    return [...keys].sort().flatMap(key => diffLeaves(actual[key], expected[key], `${path}.${key}`));
  }
  return isDeepStrictEqual(actual, expected) ? [] : [{ path, actual, expected }];
}

interface Mismatch {
  field: ParityField | 'turns';
  path: string;
  message: string;
}

function compareObservations(
  expected: EngineObservation,
  actual: EngineObservation,
  ignore: ReadonlySet<ParityField>,
): Mismatch[] {
  const mismatches: Mismatch[] = [];
  const check = (field: Mismatch['field'], path: string, a: unknown, e: unknown) => {
    for (const leaf of diffLeaves(a, e, path)) {
      mismatches.push({
        field,
        path: leaf.path,
        message: `  expected: ${show(leaf.expected)}\n  actual:   ${show(leaf.actual)}`,
      });
    }
  };

  check('turns', 'turns.length', actual.turns.length, expected.turns.length);
  const turnCount = Math.min(actual.turns.length, expected.turns.length);
  for (let i = 0; i < turnCount; i++) {
    // Union of both sides' fields, so an `expect` that drops a field still compares it.
    const fields = new Set([...Object.keys(actual.turns[i]!), ...Object.keys(expected.turns[i]!)]);
    for (const field of [...fields].sort() as Array<keyof ParitySnapshot>) {
      if (ignore.has(field)) continue;
      check(field, `turns[${i}].${field}`, actual.turns[i]![field], expected.turns[i]![field]);
    }
  }
  if (!ignore.has('requests')) {
    check('requests', 'requests', actual.requests.map(normalizeRequest), expected.requests.map(normalizeRequest));
  }
  return mismatches;
}

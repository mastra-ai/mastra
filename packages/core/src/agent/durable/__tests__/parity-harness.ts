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
 * - `usage`          → token accounting (must round-trip through the workflow)
 * - `toolCalls`      → tool routing (id, name, args), independent of order
 * - `toolResults`    → tool outputs, independent of order
 * - `stepCount`      → loop-iteration count (catches stopWhen drift)
 * - `chunks`         → `from:type` sequence of `fullStream`
 * - `streamedText`   → concatenated `text-delta` payloads
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
 * Documented engine differences are declared, never silently ignored:
 *
 *     differences: {
 *       durable: { reason: 'COR-1234: durable drops X', ignore: ['stepCount'] },
 *       evented: { reason: '...', expect: plain => ({ ...plain, turns: [...] }) },
 *     }
 *
 * A declared difference that no longer reproduces fails the test, so fixed
 * bugs force their override to be removed.
 */
import { isDeepStrictEqual } from 'node:util';
import type { LanguageModelV2, LanguageModelV2CallOptions } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
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

export interface ParitySnapshot {
  text: string;
  finishReason: string | undefined;
  usage: {
    inputTokens: number | undefined;
    outputTokens: number | undefined;
    totalTokens: number | undefined;
  };
  /** Sorted by `toolCallId` then `toolName` for order-independent comparison. */
  toolCalls: Array<{ toolCallId: string; toolName: string; args: unknown }>;
  /** Sorted to match `toolCalls`. */
  toolResults: Array<{ toolCallId: string; toolName: string; result: unknown }>;
  stepCount: number;
  /** `${from}:${type}` for every chunk on `fullStream`, in order. */
  chunks: string[];
  /** Concatenated `text-delta` payloads, as a streaming consumer would render them. */
  streamedText: string;
}

function sortByCallId<T extends { toolCallId: string; toolName: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    if (a.toolCallId !== b.toolCallId) return a.toolCallId < b.toolCallId ? -1 : 1;
    return a.toolName < b.toolName ? -1 : a.toolName > b.toolName ? 1 : 0;
  });
}

export async function snapshotFromOutput(output: MastraModelOutput<any>): Promise<ParitySnapshot> {
  // Reading fullStream to the end drains the output, so its promises resolve.
  const chunks: string[] = [];
  let streamedText = '';
  for await (const chunk of output.fullStream as AsyncIterable<{ from?: string; type: string; payload?: any }>) {
    chunks.push(`${chunk.from}:${chunk.type}`);
    if (chunk.type === 'text-delta') streamedText += chunk.payload?.text ?? '';
  }

  const [text, finishReason, usage, toolCalls, toolResults, steps] = await Promise.all([
    output.text,
    output.finishReason,
    output.usage,
    output.toolCalls,
    output.toolResults,
    output.steps,
  ]);

  return {
    text: text ?? '',
    finishReason: finishReason as string | undefined,
    usage: {
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      totalTokens: usage?.totalTokens,
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
    streamedText,
  };
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
  }) as unknown as LanguageModelV2;

  return { model, requests };
}

/** Text of the last user message in a captured request's prompt. */
export function lastUserText(request: CapturedRequest): string {
  const lastUser = [...request.prompt].reverse().find(m => m.role === 'user');
  if (!lastUser || typeof lastUser.content === 'string') return '';
  return lastUser.content.map(part => (part.type === 'text' ? part.text : '')).join('');
}

/** Strips values that legitimately differ between engines or runs. */
function normalizeRequest(request: CapturedRequest): unknown {
  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== 'object' || value instanceof Uint8Array || value instanceof Date) return value;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'providerOptions' && child && typeof child === 'object' && 'mastra' in child) {
        const { mastra, ...others } = child as Record<string, unknown>;
        const { createdAt: _createdAt, ...mastraRest } = (mastra ?? {}) as Record<string, unknown>;
        out[key] = strip({ ...others, mastra: mastraRest });
      } else {
        out[key] = strip(child);
      }
    }
    return out;
  };
  // Plain sends `includeRawChunks: false`, durable/evented leave it undefined;
  // providers treat both as off. `true` is still compared.
  const { includeRawChunks, ...rest } = request;
  return strip(includeRawChunks ? request : rest);
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
  turn: (messages: MessageListInput, options?: ParityStreamOptions) => Promise<ParitySnapshot>;
}

export interface EngineParityScenario {
  /** Scripted model. A fresh recording model is built for every engine. */
  model: ModelScript;
  /** Builds a fresh Agent for one engine. Must use the provided `model`. */
  buildAgent: (ctx: { engine: ParityEngine; model: LanguageModelV2 }) => Agent<string, any, any>;
  /** Single-turn input. Ignored when `run` is given. */
  input?: MessageListInput;
  /** Single-turn stream options. Ignored when `run` is given. */
  options?: ParityStreamOptions;
  /** Drives the scenario on one engine. Defaults to one turn of `input`/`options`. */
  run?: (handle: EngineHandle) => Promise<void>;
  /** Engines to run. Defaults to all three; must include `plain`. */
  engines?: readonly ParityEngine[];
  /** Fields not compared on any engine, e.g. a value that's random by design. */
  ignore?: ParityField[];
  /** Documented differences from plain, per engine. */
  differences?: Partial<Record<Exclude<ParityEngine, 'plain'>, EngineDifference>>;
  /** Storage for the evented engine's Mastra host. Defaults to a fresh `InMemoryStore`. */
  createStorage?: () => MastraCompositeStore;
}

export interface EngineRunResult extends EngineObservation {
  engine: ParityEngine;
  agent: Agent<string, any, any>;
}

export type EngineParityResults = Partial<Record<ParityEngine, EngineRunResult>>;

/**
 * Runs the scenario on every engine and asserts durable and evented match
 * plain, apart from declared differences. Returns each engine's observation
 * for scenario-specific assertions.
 */
export async function expectEngineParity(scenario: EngineParityScenario): Promise<EngineParityResults> {
  const engines = scenario.engines ?? PARITY_ENGINES;
  if (!engines.includes('plain')) throw new Error('expectEngineParity: engines must include "plain"');
  if (!scenario.run && scenario.input === undefined) {
    throw new Error('expectEngineParity: provide `input` or `run`');
  }

  const results: EngineParityResults = {};
  // Plain first, so it's the reference regardless of the order given.
  for (const engine of ['plain', ...engines.filter(e => e !== 'plain')] as ParityEngine[]) {
    results[engine] = await runOnEngine(engine, scenario);
  }

  const plain = results.plain!;
  const failures: string[] = [];
  for (const engine of engines) {
    if (engine === 'plain') continue;
    failures.push(...checkEngine(engine, plain, results[engine]!, scenario));
  }
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
    new Mastra({
      agents: { [agent.id]: wrapper },
      storage: scenario.createStorage?.() ?? new InMemoryStore(),
      logger: false,
    });
    // Without atomic storage the evented agent silently runs on the default
    // engine, which would make "evented == plain" a durable-vs-plain check.
    const engineType = (wrapper.getWorkflow() as { engineType?: string }).engineType;
    if (engineType !== 'evented') {
      throw new Error(`expectEngineParity: evented agent resolved to the '${engineType}' engine, not 'evented'`);
    }
  }

  const turns: ParitySnapshot[] = [];
  const cleanups: Array<() => void> = [];
  const handle: EngineHandle = {
    engine,
    agent,
    turn: async (messages, options) => {
      // Vitest stubs randomUUID per test, so give every run its own id.
      const runOptions = { ...options, runId: options?.runId ?? `parity-${engine}-${turns.length}` };
      let output: MastraModelOutput<any>;
      if (wrapper) {
        const result = await wrapper.stream(messages, runOptions);
        cleanups.push(result.cleanup);
        output = result.output;
      } else {
        output = await agent.stream(messages, runOptions);
      }
      const snapshot = await snapshotFromOutput(output);
      turns.push(snapshot);
      return snapshot;
    },
  };

  try {
    if (scenario.run) await scenario.run(handle);
    else await handle.turn(scenario.input!, scenario.options);
  } finally {
    for (const cleanup of cleanups) cleanup();
  }

  return { engine, agent, turns, requests };
}

function checkEngine(
  engine: Exclude<ParityEngine, 'plain'>,
  plain: EngineObservation,
  actual: EngineObservation,
  scenario: EngineParityScenario,
): string[] {
  const difference = scenario.differences?.[engine];
  const sharedIgnore = new Set(scenario.ignore ?? []);
  const raw = compareObservations(plain, actual, sharedIgnore);

  if (!difference) return raw.map(m => `${engine} differs from plain at ${m.path}:\n${m.message}`);

  if (!difference.reason?.trim()) return [`${engine}: declared difference has no reason`];

  // A declared difference must still reproduce, or it hides a fixed bug.
  const failures: string[] = [];
  if (raw.length === 0) {
    failures.push(`${engine}: declared difference no longer reproduces; remove it (reason: ${difference.reason})`);
  }
  for (const field of difference.ignore ?? []) {
    if (!raw.some(m => m.field === field)) {
      failures.push(`${engine}: ignored field '${field}' matches plain; remove it (reason: ${difference.reason})`);
    }
  }

  const expected = difference.expect
    ? difference.expect(structuredClone({ turns: plain.turns, requests: plain.requests }))
    : plain;
  const ignore = new Set([...sharedIgnore, ...(difference.ignore ?? [])]);
  for (const m of compareObservations(expected, actual, ignore)) {
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
    for (const field of Object.keys(expected.turns[i]!) as Array<keyof ParitySnapshot>) {
      if (ignore.has(field)) continue;
      check(field, `turns[${i}].${field}`, actual.turns[i]![field], expected.turns[i]![field]);
    }
  }
  if (!ignore.has('requests')) {
    check('requests', 'requests', actual.requests.map(normalizeRequest), expected.requests.map(normalizeRequest));
  }
  return mismatches;
}

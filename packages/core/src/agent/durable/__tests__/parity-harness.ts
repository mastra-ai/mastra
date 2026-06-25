/**
 * Parity Harness
 *
 * Helpers for running the same scenario through a plain `Agent` and a
 * `DurableAgent` and asserting that the **observable** outputs match. The
 * "observable" surface is intentionally narrow: things a user calling
 * `agent.stream(...)` can read off the returned `MastraModelOutput`.
 *
 * What we compare (and why):
 * - `text`           → user-visible final text
 * - `finishReason`   → terminal state
 * - `usage`          → token accounting (must round-trip through workflow)
 * - `toolCalls`      → tool routing (id, name, args) — independent of order
 * - `toolResults`    → tool outputs — independent of order
 * - `steps.length`   → loop-iteration count (catches stopWhen drift)
 *
 * What we deliberately do NOT compare:
 * - `runId` / message ids / timestamps      → expected to differ
 * - `response.id` / response.modelId        → set per-call, may differ
 * - `traceId` / span ids                    → see `tracing_parity` task
 * - `request`                               → not a user contract
 *
 * Most parity tests should be written as:
 *
 *     const fixture = makeMockModelFactory(...);
 *     await expectAgentParity({
 *       buildAgent: () => new Agent({ id: 'x', name: 'X', instructions: '...', model: fixture(), tools }),
 *       buildDurableAgent: agent => createDurableAgent({ agent, pubsub: new EventEmitterPubSub() }),
 *       stream: a => a.stream('user prompt', { ...options }),
 *     });
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { expect } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { MastraModelOutput } from '../../../stream/base/output';
import type { Agent } from '../../agent';
import type { AgentExecutionOptions } from '../../agent.types';
import { createDurableAgent } from '../create-durable-agent';
import type { DurableAgent, DurableAgentStreamOptions, DurableAgentStreamResult } from '../durable-agent';

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
}

function sortByCallId<T extends { toolCallId: string; toolName: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    if (a.toolCallId !== b.toolCallId) return a.toolCallId < b.toolCallId ? -1 : 1;
    return a.toolName < b.toolName ? -1 : a.toolName > b.toolName ? 1 : 0;
  });
}

export async function snapshotFromOutput(output: MastraModelOutput<any>): Promise<ParitySnapshot> {
  // Drain the stream so all promises resolve.
  await output.consumeStream();

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
        toolCallId: c.toolCallId,
        toolName: c.toolName,
        args: c.args ?? c.input,
      })),
    ),
    toolResults: sortByCallId(
      (toolResults ?? []).map((r: any) => ({
        toolCallId: r.toolCallId,
        toolName: r.toolName,
        result: r.result ?? r.output,
      })),
    ),
    stepCount: steps?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// expectAgentParity — the main entry point for parity tests
// ---------------------------------------------------------------------------

export interface ParityScenario<OUTPUT = any> {
  /** Build a fresh Agent. Called once per side; **must** return a fresh mock model. */
  buildAgent: () => Agent<string, any, OUTPUT>;
  /**
   * Wrap the agent with durable execution. Defaults to
   * `createDurableAgent({ agent, pubsub: new EventEmitterPubSub() })`.
   */
  buildDurableAgent?: (agent: Agent<string, any, OUTPUT>) => DurableAgent<string, any, OUTPUT>;
  /** Drive a stream on the plain Agent. */
  streamAgent: (agent: Agent<string, any, OUTPUT>) => Promise<MastraModelOutput<OUTPUT>> | MastraModelOutput<OUTPUT>;
  /** Drive a stream on the DurableAgent. */
  streamDurable: (
    agent: DurableAgent<string, any, OUTPUT>,
  ) => Promise<DurableAgentStreamResult<OUTPUT>> | DurableAgentStreamResult<OUTPUT>;
  /**
   * Optional per-field tolerance. For example, `{ stepCount: false }` lets a
   * test opt out of step count comparison (useful for non-deterministic cases).
   * Defaults to comparing all fields.
   */
  ignore?: Partial<Record<keyof ParitySnapshot, boolean>>;
}

export async function expectAgentParity<OUTPUT = any>(scenario: ParityScenario<OUTPUT>) {
  // --- Agent side
  const agentForPlain = scenario.buildAgent();
  const plainResult = await scenario.streamAgent(agentForPlain);
  const plainSnap = await snapshotFromOutput(plainResult);

  // --- DurableAgent side (fresh agent + fresh mock model)
  const agentForDurable = scenario.buildAgent();
  const buildDurable: (a: Agent<string, any, any>) => DurableAgent<string, any, any> =
    scenario.buildDurableAgent ?? defaultBuildDurable;
  const durable = buildDurable(agentForDurable);
  const durableResult = await scenario.streamDurable(durable as DurableAgent<string, any, OUTPUT>);
  const durableSnap = await snapshotFromOutput(durableResult.output);

  // --- Compare
  const ignore = scenario.ignore ?? {};
  const filtered = (snap: ParitySnapshot): Partial<ParitySnapshot> => {
    const out: any = {};
    for (const key of Object.keys(snap) as Array<keyof ParitySnapshot>) {
      if (!ignore[key]) out[key] = snap[key];
    }
    return out;
  };

  expect(filtered(durableSnap), 'DurableAgent should match Agent observable output').toEqual(filtered(plainSnap));

  // Always run cleanup
  durableResult.cleanup?.();

  return { plain: plainSnap, durable: durableSnap };
}

function defaultBuildDurable(agent: Agent<string, any, any>): DurableAgent<string, any, any> {
  return createDurableAgent({ agent, pubsub: new EventEmitterPubSub() }) as DurableAgent<string, any, any>;
}

// ---------------------------------------------------------------------------
// Mock model factories
//
// `createMockModelFactory` returns a **factory** (not a model). Call it once
// per Agent build so the call counter resets between Agent and DurableAgent
// runs — otherwise the second run sees a stale `callCount` and emits the
// wrong tape.
// ---------------------------------------------------------------------------

export type ModelTape = ReadonlyArray<Readonly<Record<string, unknown>>>;

export interface MockModelOptions {
  /**
   * Sequence of stream "tapes" — one per LLM call. After all tapes are
   * consumed, subsequent calls reuse the last tape (matching common test
   * patterns).
   */
  tapes: ReadonlyArray<ModelTape>;
  /** Optional hook called with the prompt for each LLM call. */
  onCall?: (prompt: unknown, callIndex: number) => void;
}

export function createMockModelFactory(opts: MockModelOptions): () => LanguageModelV2 {
  return () => {
    let callCount = 0;
    return new MockLanguageModelV2({
      doStream: async (options: any) => {
        const index = Math.min(callCount, opts.tapes.length - 1);
        opts.onCall?.(options.prompt, callCount);
        callCount++;
        return {
          stream: convertArrayToReadableStream(opts.tapes[index] as any),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    }) as unknown as LanguageModelV2;
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
// Convenience: build identical stream options for both sides
// ---------------------------------------------------------------------------

export type SharedStreamOptions<OUTPUT = any> = Omit<
  DurableAgentStreamOptions<OUTPUT>,
  // Properties that don't exist on Agent's options or differ in shape
  '_skipBgTaskWait'
> &
  Pick<AgentExecutionOptions<OUTPUT>, 'maxSteps' | 'toolChoice' | 'activeTools'>;

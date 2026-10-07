/**
 * Ported from validation harness case T34 (tool-metadata).
 *
 * The tool `echo` returns `{ n, secret: 'raw' }`. Three variants:
 *
 *   provider-metadata  the model attaches `providerMetadata` to its tool call;
 *                      the tool-call chunk must carry it unchanged
 *   to-model-output    `tool.toModelOutput` rewrites the copy of the output the
 *                      model sees; the public result stays raw
 *   transform          a tool-level `transform.transcript.output` rewrites the
 *                      transcript copy while the public tool result stays raw.
 *                      Which copy (persisted transcript / model prompt) carries
 *                      the rewrite is recorded by the harness and compared
 *                      across engines, but not promised, so only the raw public
 *                      result is asserted.
 *
 * `provider-metadata` and `to-model-output` diverge from plain on the wrapped
 * engines, so each declares its difference against COR-1390: the `tool-result`
 * chunk payload keeps `providerMetadata` on plain
 * (`{ cor1252: { tag: 't34' } }` / `{ mastra: { modelOutput: ... } }`) and drops
 * the key on durable and evented. The tool-call chunk carries the same metadata
 * on all three engines.
 *
 * Harness exclusions, not asserted here:
 *   - the agent-level transform policy (PR-only in the harness; it only records
 *     an observation and never asserts it).
 *   - the `display` target (Studio; covered by the harness S-cases).
 *
 * `expectEngineParity` provides the harness's engine comparison; the harness's
 * own "run settled" check (two model calls, one finish, no error) is asserted
 * per engine.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import {
  type CapturedRequest,
  type EngineDifference,
  type EngineParityResults,
  type EngineRunResult,
  type ModelTape,
  type ParityEngine,
  type ParitySnapshot,
  chunksOfType,
  expectEngineParity,
  textOnlyTape,
} from './parity-harness';

const ENGINES: readonly ParityEngine[] = ['plain', 'durable', 'evented'];
const THREAD = 'thread-t34';
const RESOURCE = 'resource-t34';
const TURN_OPTIONS = {
  maxSteps: 3,
  memory: { thread: THREAD, resource: RESOURCE },
} as const;

const VARIANTS = ['transform', 'provider-metadata', 'to-model-output'] as const;
type Variant = (typeof VARIANTS)[number];

/** What the model attaches to its tool-call part in the `provider-metadata` variant. */
const T34_PROVIDER_METADATA = { cor1252: { tag: 't34' } };

interface VariantSpec {
  /** Metadata the model attaches to its tool-call part. */
  callMetadata?: Record<string, unknown>;
  /** Rewrites the copy of the output the model sees. */
  toModelOutput?: (output: unknown) => unknown;
  /** Adds the tool-level transcript transform. */
  transcriptTransform?: boolean;
  /** What plain puts on the `tool-result` chunk; durable and evented drop it (COR-1390). */
  resultMetadata?: Record<string, unknown>;
}

const SPECS: Record<Variant, VariantSpec> = {
  transform: { transcriptTransform: true },
  'provider-metadata': { callMetadata: T34_PROVIDER_METADATA, resultMetadata: T34_PROVIDER_METADATA },
  'to-model-output': {
    toModelOutput: output => ({ type: 'text', value: `mapped:${(output as { n: number }).n}` }),
    resultMetadata: { mastra: { modelOutput: { type: 'text', value: 'mapped:1' } } },
  },
};

const VARIANT_TITLES: Record<Variant, string> = {
  transform: 'a tool-level transcript transform keeps the public result raw',
  'provider-metadata': "the model's tool-call providerMetadata reaches the tool-call chunk",
  'to-model-output': 'toModelOutput rewrites only the copy the model sees',
};

/**
 * COR-1390: durable and evented drop `providerMetadata` from the `tool-result`
 * chunk payload. The tool-call chunk carries the same metadata on all three
 * engines, so only the result chunk is declared here.
 */
const RESULT_METADATA_DIFFERENCE: EngineDifference = {
  reason:
    'COR-1390: the `providerMetadata` plain puts on the `tool-result` chunk payload is dropped on durable and ' +
    'evented; the tool-call chunk carries the same metadata on all three engines.',
  expect: plain => ({
    ...plain,
    turns: plain.turns.map(turn => {
      const index = turn.chunkTypes.indexOf('tool-result');
      if (index === -1) return turn;
      const chunkPayloads = [...turn.chunkPayloads];
      const payload = { ...(chunkPayloads[index] as Record<string, unknown>) };
      delete payload.providerMetadata;
      chunkPayloads[index] = payload;
      return { ...turn, chunkPayloads };
    }),
  }),
};

function toolResultCount(request: CapturedRequest): number {
  return request.prompt
    .filter(message => message.role === 'tool')
    .flatMap(message => (Array.isArray(message.content) ? message.content : []))
    .filter(part => part.type === 'tool-result').length;
}

/** The outputs the model saw on a captured request, like the harness's `toModel`. */
function toolOutputsSeenByModel(request: CapturedRequest | undefined): unknown[] {
  if (!request) return [];
  return request.prompt
    .filter(message => message.role === 'tool')
    .flatMap(message => (Array.isArray(message.content) ? message.content : []))
    .filter(part => part.type === 'tool-result')
    .map(part => (part as { output?: unknown }).output);
}

/** A chunk payload from a turn, by chunk type. */
function payloadOfType(turn: ParitySnapshot, type: string): Record<string, unknown> {
  const index = turn.chunkTypes.indexOf(type);
  return (turn.chunkPayloads[index] ?? {}) as Record<string, unknown>;
}

function toolCallTape(spec: VariantSpec): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'parity-id-tool', modelId: 'parity-model', timestamp: new Date(0) },
    {
      type: 'tool-call',
      toolCallId: 'parity-call-1',
      toolName: 'echo',
      input: JSON.stringify({ n: 1 }),
      providerExecuted: false,
      ...(spec.callMetadata ? { providerMetadata: spec.callMetadata } : {}),
    },
    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
  ];
}

/** The tool-level transcript rewrite: redacts the transcript copy but not the public result. */
function transcriptOutput(context: { output?: unknown }): { n: number; secret: string } {
  const { n } = context.output as { n: number };
  return { n, secret: 'transcript-redacted' };
}

function echoTool(spec: VariantSpec) {
  return createTool({
    id: 'echo',
    description: 'T34 echo',
    inputSchema: z.object({ n: z.number() }),
    execute: async (input: { n: number }) => ({ n: input?.n ?? 1, secret: 'raw' as const }),
    toModelOutput: spec.toModelOutput,
    transform: spec.transcriptTransform ? { transcript: { output: transcriptOutput } } : undefined,
  });
}

/** The observation for one engine, which `expectEngineParity` always records. */
function observationOf(results: EngineParityResults, engine: ParityEngine): EngineRunResult {
  const observation = results[engine];
  if (!observation) throw new Error(`no observation recorded for engine '${engine}'`);
  return observation;
}

function runT34(variant: Variant) {
  const spec = SPECS[variant];
  return expectEngineParity({
    engines: ENGINES,
    // The declared difference only exists for the variants that put metadata on the result.
    ...(spec.resultMetadata
      ? { differences: { durable: RESULT_METADATA_DIFFERENCE, evented: RESULT_METADATA_DIFFERENCE } }
      : {}),
    model: {
      respond: request => (toolResultCount(request) === 0 ? toolCallTape(spec) : textOnlyTape('done')),
    },
    buildAgent: ({ model }) =>
      new Agent({
        id: `t34-agent-${variant}`,
        name: 'T34 Agent',
        instructions: 'Follow the script.',
        model,
        memory: new MockMemory(),
        tools: { echo: echoTool(spec) },
      }),
    run: async handle => {
      const turn = await handle.turn('Go.', TURN_OPTIONS);

      // Harness "run settled" check: two model calls, one finish, no error.
      expect(chunksOfType(turn, 'finish')).toBe(1);
      expect(chunksOfType(turn, 'error')).toBe(0);
      expect(chunksOfType(turn, 'tool-call')).toBe(1);
    },
  });
}

describe('T34 tool metadata (plain, durable, evented)', () => {
  for (const variant of VARIANTS) {
    it(`${variant}: ${VARIANT_TITLES[variant]}`, async () => {
      const results = await runT34(variant);
      const spec = SPECS[variant];

      for (const engine of ENGINES) {
        const observation = observationOf(results, engine);
        const turn = observation.turns[0]!;
        // The harness's check: two model calls.
        expect(observation.requests).toHaveLength(2);

        if (variant === 'provider-metadata') {
          // The harness's check: the tool-call chunk carries the model's metadata.
          expect(payloadOfType(turn, 'tool-call').providerMetadata).toEqual(T34_PROVIDER_METADATA);
        }
        if (variant === 'to-model-output') {
          // The harness's checks: the model saw the mapped output, the result stays raw.
          expect(JSON.stringify(toolOutputsSeenByModel(observation.requests[1]))).toContain('mapped:1');
          expect(turn.toolResults[0]?.result).toMatchObject({ secret: 'raw' });
        }
        if (variant === 'transform') {
          // The harness's check: the public result is the raw output.
          expect(turn.toolResults[0]?.result).toMatchObject({ secret: 'raw' });
        }

        // COR-1390: the difference declared above, pinned per engine.
        if (spec.resultMetadata) {
          const metadata = payloadOfType(turn, 'tool-result').providerMetadata;
          if (engine === 'plain') expect(metadata).toEqual(spec.resultMetadata);
          else expect(metadata).toBeUndefined();
        }
      }
    });
  }
});

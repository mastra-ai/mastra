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
 * `provider-metadata` and `to-model-output` retain their metadata on public
 * tool-result chunks across all three engines (regression coverage for COR-1390).
 *
 * Harness exclusions, not asserted here:
 *   - the agent-level transform policy (PR-only in the harness; it only records
 *     an observation and never asserts it).
 *   - the `display` target (Studio; covered by the harness S-cases).
 *
 * `expectParity` (parity mode) provides the harness's engine comparison; the harness's
 * own "run settled" check (two model calls, one finish, no error) is asserted
 * per engine.
 */
import { it, expect } from 'vitest';
import { z } from 'zod';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import {
  type CapturedRequest,
  type EngineParityResults,
  type EngineRunResult,
  type ModelTape,
  type ParityEngine,
  type ParitySnapshot,
  type ParityTarget,
  chunksOfType,
  describeParity,
  expectParity,
  textOnlyTape,
} from '../parity';
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
  /** Metadata carried by the public `tool-result` chunk on every engine. */
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

/**
 * The transcript copy an engine recorded for the tool result on a captured
 * request. `transcript.output` rewrites this copy; the public result the caller
 * sees stays raw.
 */
function transcriptOutputSeenByModel(request: CapturedRequest | undefined): unknown {
  if (!request) return undefined;
  const parts = request.prompt
    .filter(message => message.role === 'tool')
    .flatMap(message => (Array.isArray(message.content) ? message.content : []))
    .filter(part => part.type === 'tool-result');
  return parts
    .map(
      part =>
        (
          part as {
            providerOptions?: {
              mastra?: { toolPayloadTransform?: { transcript?: Record<string, { transformed?: unknown }> } };
            };
          }
        ).providerOptions?.mastra?.toolPayloadTransform?.transcript?.['output-available']?.transformed,
    )
    .find(value => value !== undefined);
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

/** The observation for one engine, which `expectParity` always records. */
function observationOf(results: EngineParityResults, engine: ParityEngine): EngineRunResult {
  const observation = results[engine];
  if (!observation) throw new Error(`no observation recorded for engine '${engine}'`);
  return observation;
}

function runT34(target: ParityTarget, variant: Variant) {
  const spec = SPECS[variant];
  return expectParity(target, {
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

describeParity('tool-metadata parity', target => {
  it.each([undefined, T34_PROVIDER_METADATA])(
    'keeps original call metadata in transform callbacks (%j)',
    async callMetadata => {
      const seen = new Map<ParityEngine, unknown[]>();
      const spec: VariantSpec = { ...SPECS['to-model-output'], callMetadata };
      const results = await expectParity(target, {
        model: { respond: request => (toolResultCount(request) === 0 ? toolCallTape(spec) : textOnlyTape('done')) },
        buildAgent: ({ engine, model }) => {
          const metadata: unknown[] = [];
          seen.set(engine, metadata);
          return new Agent({
            id: 't34-transform-metadata',
            name: 'T34 transform metadata',
            instructions: 'Follow the script.',
            model,
            memory: new MockMemory(),
            tools: {
              echo: createTool({
                id: 'echo',
                description: 'Echo the number.',
                inputSchema: z.object({ n: z.number() }),
                execute: async ({ n }) => ({ n, secret: 'raw' }),
                toModelOutput: spec.toModelOutput,
                transform: {
                  transcript: {
                    output: context => {
                      metadata.push(context.providerMetadata);
                      return context.output;
                    },
                  },
                },
              }),
            },
          });
        },
        input: 'Go.',
        options: TURN_OPTIONS,
      });
      for (const engine of ['plain', target] as const) {
        expect(seen.get(engine)?.length).toBeGreaterThan(0);
        expect(seen.get(engine)?.every(metadata => JSON.stringify(metadata) === JSON.stringify(callMetadata))).toBe(
          true,
        );
        expect(payloadOfType(observationOf(results, engine).turns[0]!, 'tool-result').providerMetadata).toEqual({
          ...callMetadata,
          ...spec.resultMetadata,
        });
      }
    },
  );

  for (const variant of VARIANTS) {
    it(`${variant}: ${VARIANT_TITLES[variant]}`, async () => {
      const results = await runT34(target, variant);
      const spec = SPECS[variant];

      for (const engine of ['plain', target] as const) {
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
          // The rewrite has to reach the transcript copy too — without this the
          // variant would still pass if no engine applied `transcript.output`.
          expect(transcriptOutputSeenByModel(observation.requests[1])).toEqual({ n: 1, secret: 'transcript-redacted' });
        }

        if (spec.resultMetadata) {
          expect(payloadOfType(turn, 'tool-result').providerMetadata).toEqual(spec.resultMetadata);
        }
      }
    });
  }
});

describeForAllEngines('tool-result provider metadata in public streams', engine => {
  const getMock = useLoopScenarioAimock();

  it('keeps model-facing output in metadata while exposing the raw tool result', async () => {
    const mapperInputs: unknown[] = [];
    const echo = createTool({
      id: 'echo',
      description: 'Echo a number',
      inputSchema: z.object({ n: z.number() }),
      execute: async ({ n }) => ({ n, secret: 'raw' }),
      toModelOutput: output => {
        mapperInputs.push(output);
        return { type: 'text' as const, value: 'mapped:1' };
      },
    });
    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Echo one.',
      tools: { echo },
      maxSteps: 3,
      collectChunks: true,
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', sequenceIndex: 0 },
          { toolCalls: [{ id: 'call_echo', name: 'echo', arguments: { n: 1 } }] },
        );
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: 'Done.' });
      },
    });

    expect(await output.text).toBe('Done.');
    expect(requests).toHaveLength(2);
    expect(mapperInputs.length).toBeGreaterThan(0);
    for (const input of mapperInputs) expect(input).toEqual({ n: 1, secret: 'raw' });
    const toolMessage = requests[1]!.body?.messages.find(message => message.role === 'tool');
    expect(JSON.stringify(toolMessage)).toContain('mapped:1');
    expect(JSON.stringify(toolMessage)).not.toContain('"secret"');
    const results = chunks?.filter(chunk => chunk.type === 'tool-result' && chunk.payload.toolCallId === 'call_echo');
    expect(results).toHaveLength(1);
    expect(results?.[0]?.payload.result).toEqual({ n: 1, secret: 'raw' });
    expect(results?.[0]?.payload.providerMetadata).toMatchObject({
      mastra: { modelOutput: { type: 'text', value: 'mapped:1' } },
    });
    const call = chunks?.find(chunk => chunk.type === 'tool-call' && chunk.payload.toolCallId === 'call_echo');
    expect(call?.payload.providerMetadata?.openai).toBeDefined();
    expect(results?.[0]?.payload.providerMetadata?.openai).toEqual(call?.payload.providerMetadata?.openai);
  });
});

/**
 * Ported from validation harness case T37 (error-surfaces), green variants only.
 *
 * The harness case has three variants; two are green on main:
 *   - model-4xx: the model fails before producing any output (an up-front,
 *     non-retryable provider error).
 *   - stream-cut: the model streams one text delta, then the stream errors.
 *
 * The third variant, `tool-timeout` (a tool that never returns, with
 * `modelSettings.timeout.totalMs`), is red on main and moves with COR-1376. It is
 * not ported here.
 *
 * Harness exclusions: error message wording, and retry timing (T27).
 *
 * `stream-cut` runs through `expectEngineParity`. COR-1417 made a failed run
 * recordable: the chunks that arrived before the failure are kept and compared,
 * and the failure itself is compared as `{ name, message }` (never `stack`, which
 * embeds a checkout-specific path), so the variant needs no declared difference.
 *
 * `model-4xx` cannot go through the helper. When the model call itself rejects,
 * every engine settles on the same `finish` payload `stepResult`, and the
 * helper's generic COR-1390 `finish` declaration stops reproducing on that shape,
 * so `staleKnownDifferences` fails the scenario before anything is compared. The
 * variant is therefore driven per engine, as it was before the helper could
 * record a failed run, and the engines are compared on the surfaces a consumer
 * sees. COR-1429 makes the stale check scenario-aware, which is what lets this
 * variant move onto `expectEngineParity`.
 */

import { describe, it, expect } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import type { DurableAgent } from '../durable-agent';
import {
  type EngineParityScenario,
  type EngineParityResults,
  type ModelScript,
  type ParityEngine,
  PARITY_ENGINES,
  createRecordingModel,
  expectEngineParity,
} from './parity-harness';

const THREAD = 'thread-t37';
const RESOURCE = 'resource-t37';

/**
 * The model fails before producing any output: a fresh call throws, so nothing
 * is streamed and the caller sees the failure immediately.
 *
 * Driven per engine rather than through the helper — COR-1429 (see the header).
 */
const MODEL_4XX: ModelScript = {
  respond: () => {
    throw new Error('T37 model 400');
  },
};

/** The model streams one text delta, then the stream errors. */
const STREAM_CUT: ModelScript = {
  respond: () => [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'parity-id-0', modelId: 'parity-model', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: 'partial ' },
    { type: 'error', error: new Error('T37 stream cut') },
  ],
};

/** stream-cut: one turn of `input` on every engine. */
function scenario(model: ModelScript): EngineParityScenario {
  return {
    model,
    buildAgent: ({ model: recordingModel }) =>
      new Agent({
        id: 't37-agent',
        name: 'T37 Agent',
        instructions: 'Follow the script.',
        model: recordingModel,
        // The case asserts the first failure, not a retry sequence.
        maxRetries: 0,
        memory: new MockMemory(),
      }),
    input: 'Go.',
    options: { memory: { thread: THREAD, resource: RESOURCE } },
  };
}

/** Every engine's snapshot for the scenario's single turn. */
function turnsByEngine(results: EngineParityResults) {
  return PARITY_ENGINES.map(engine => {
    const turn = results[engine]?.turns[0];
    expect(turn, `${engine} produced a turn`).toBeDefined();
    return { engine, turn: turn! };
  });
}

// ---------------------------------------------------------------------------
// model-4xx: driven per engine (see the header and COR-1429)
// ---------------------------------------------------------------------------

/** One engine's public failure surfaces, plus what the stream looked like. */
interface FailureRecord {
  engine: ParityEngine;
  modelCalls: number;
  /** The promise rejected rather than streaming to completion. */
  rejected: string | null;
  /** An `error` chunk reached the stream. */
  errorChunk: boolean;
  onError: boolean;
  onFinish: boolean;
  finishReason: string | null;
  /** The failure as a consumer of the error chunk reads it. */
  errorName: string | null;
  errorMessage: string | null;
  /** Text that arrived before the failure. */
  streamedText: string;
  chunkTypes: string[];
}

/** One streamed chunk, read as the harness reads it. */
interface StreamedChunk {
  type: string;
  payload?: {
    text?: string;
    error?: { name?: string; message?: string };
    stepResult?: { reason?: string };
    finishReason?: string;
  };
}

/**
 * What a driven turn exposes: a wrapper returns `{ output, cleanup }`, while a
 * plain agent returns the output itself.
 */
interface DrivenTurn {
  fullStream: AsyncIterable<StreamedChunk>;
  output?: DrivenTurn;
  cleanup?: () => void;
}

async function driveFailure(engine: ParityEngine, script: ModelScript): Promise<FailureRecord> {
  const { model, requests } = createRecordingModel(script);
  // Typed wide so both wrappers stay assignable, as the parity helper does.
  const agent: Agent<any, any, any> = new Agent({
    id: 't37-agent',
    name: 'T37 Agent',
    instructions: 'Follow the script.',
    model,
    maxRetries: 0,
    memory: new MockMemory(),
  });

  let wrapper: DurableAgent<string, any, any> | undefined;
  if (engine === 'durable') {
    wrapper = createDurableAgent({ agent, pubsub: new EventEmitterPubSub() });
  } else if (engine === 'evented') {
    wrapper = createEventedAgent({ agent });
  }

  new Mastra({ agents: { [agent.id]: wrapper ?? agent }, storage: new InMemoryStore(), logger: false });

  if (wrapper && engine === 'evented') {
    // Without atomic storage the evented agent silently runs on the default
    // engine, which would quietly turn this into a durable-vs-plain comparison.
    const engineType = (wrapper.getWorkflow() as { engineType?: string }).engineType;
    expect(engineType).toBe('evented');
  }

  const record: FailureRecord = {
    engine,
    modelCalls: 0,
    rejected: null,
    errorChunk: false,
    onError: false,
    onFinish: false,
    finishReason: null,
    errorName: null,
    errorMessage: null,
    streamedText: '',
    chunkTypes: [],
  };

  try {
    const streamed = (await (wrapper ?? agent).stream('Go.', {
      memory: { thread: `${THREAD}-${engine}`, resource: `${RESOURCE}-${engine}` },
      onError: () => {
        record.onError = true;
      },
      onFinish: () => {
        record.onFinish = true;
      },
    })) as unknown as DrivenTurn;
    const output = wrapper ? (streamed.output ?? streamed) : streamed;

    try {
      for await (const chunk of output.fullStream) {
        record.chunkTypes.push(chunk.type);
        if (chunk.type === 'error') {
          record.errorChunk = true;
          record.errorName = chunk.payload?.error?.name ?? null;
          record.errorMessage = chunk.payload?.error?.message ?? null;
        }
        if (chunk.type === 'text-delta') record.streamedText += chunk.payload?.text ?? '';
        if (chunk.type === 'finish') {
          // Read as the harness does, so "not a clean completion" stays meaningful.
          record.finishReason = chunk.payload?.stepResult?.reason ?? chunk.payload?.finishReason ?? null;
        }
      }
    } catch (error) {
      record.rejected = String((error as { message?: string })?.message ?? error);
    }

    if (wrapper) streamed.cleanup?.();
  } catch (error) {
    record.rejected = String((error as { message?: string })?.message ?? error);
  }

  record.modelCalls = requests.length;
  return record;
}

/** The harness's two promises: the failure surfaced, and it did not look clean. */
function expectHarnessPromises(record: FailureRecord) {
  expect(record.errorChunk || record.onError || record.rejected !== null).toBe(true);
  expect(record.onFinish && record.finishReason === 'stop' && !record.errorChunk).toBe(false);
}

/** Everything a caller can observe, minus which engine produced it. */
function surfaceOf(record: FailureRecord): Omit<FailureRecord, 'engine'> {
  const { engine: _engine, ...surface } = record;
  return surface;
}

/** Engine parity here means: same public surfaces, same chunk sequence. */
function expectSameSurfaces(records: FailureRecord[]) {
  expect(records.map(record => record.engine)).toEqual([...PARITY_ENGINES]);
  const [reference, ...rest] = records;
  for (const record of rest) {
    expect(surfaceOf(record)).toEqual(surfaceOf(reference!));
  }
}

describe('T37 error surfaces (plain, durable, evented)', () => {
  it('model-4xx: an up-front model failure surfaces the same way on every engine', async () => {
    const records = await Promise.all(PARITY_ENGINES.map(engine => driveFailure(engine, MODEL_4XX)));

    for (const record of records) {
      expectHarnessPromises(record);
      // The model failed before any output reached the stream.
      expect(record.chunkTypes).toEqual(['start', 'step-start', 'error', 'step-finish', 'finish']);
      expect(record.finishReason).toBe('error');
      expect(record.streamedText).toBe('');
      expect({ name: record.errorName, message: record.errorMessage }).toEqual({
        name: 'Error',
        message: 'T37 model 400',
      });
      expect(record.modelCalls).toBe(1);
    }

    expectSameSurfaces(records);
  });

  it('stream-cut: the partial text survives and the failure surfaces the same way on every engine', async () => {
    const results = await expectEngineParity(scenario(STREAM_CUT));

    for (const { engine, turn } of turnsByEngine(results)) {
      // The delta that arrived before the failure is kept, and the failure is
      // recorded rather than raised.
      expect(turn.chunks, `${engine} chunks`).toEqual([
        'AGENT:start',
        'AGENT:step-start',
        'AGENT:text-start',
        'AGENT:text-delta',
        'AGENT:error',
        'AGENT:step-finish',
        'AGENT:finish',
      ]);
      expect(turn.streamedText, `${engine} streamedText`).toBe('partial ');
      expect(turn.text, `${engine} text`).toBe('partial ');
      expect(turn.finishReason, `${engine} finishReason`).toBe('error');
      expect(turn.error, `${engine} error`).toStrictEqual({ name: 'Error', message: 'T37 stream cut' });
      expect(results[engine]?.requests.length, `${engine} model calls`).toBe(1);
    }
  });
});

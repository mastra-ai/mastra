/**
 * Ported from validation harness case T45 (output-processors).
 *
 * One probe processor is installed as `outputProcessors` and the script model records what happened
 * to the stream and to memory. Model-free: `stepScript(1)` — one `step` tool call then
 * `finished 1 steps` — with `maxSteps: 3`.
 *
 * Ported variants: `mutate`, `tripwire`, `data` and `throws`. `data` was green first try; `tripwire`
 * needed the harness's own `steps` counter (the `step` tool's commit log, not the parity snapshot's
 * `toolResults`); `mutate` needs the COR-1414 declaration below.
 *
 * `throws` (fail CLOSED per #25826 / COR-1315): a processor that throws on every text delta and in
 * `processOutputResult` never lets the unprocessed text reach the stream and surfaces the failure on
 * every engine, so the case's own checks are asserted against each engine directly
 * (`runT45ThrowsDirect`). The helper cannot drive it: its built-in declaration for the `error` chunk
 * (COR-1390 — plain forwards the live `Error` where durable and evented forward the serialised error
 * alone) does not reproduce for a failure raised by an output processor, because neither engine adds
 * the `type` key the declaration names, and `checkEngine` reports a stale declaration before any
 * scenario-level declaration is considered (COR-1429 covers letting a scenario run past a built-in
 * difference that does not apply). Memory diverges too (COR-1414): plain persists no assistant message
 * where durable and evented persist the tool-invocation part plus an error part, pinned per engine so
 * the assertion goes stale when the fix lands.
 *
 * Not ported, escalated rather than weakened:
 *
 * - `tool-result` and `retry` (COR-1343, GH #22980) are recorded FAIL on durable and evented at every
 *   pin: `processOutputStream` sees the `tool-result` chunk twice and the `processOutputStep`
 *   `{ retry: true }` abort ends the run in a tripwire instead of calling the model again. A known
 *   open bug is not something this port may pin as expected behaviour.
 *
 * `mutate` (COR-1414): the harness's KNOWN note records the divergence — "the plain Agent persists
 * the processOutputStream-mutated text ('FINISHED 1 STEPS'); durable/evented persist the original
 * deltas and only the processOutputResult mutation ('[out:out-a]') reaches memory" — and its own
 * engine pairing FAILs on `memoryUppercased` for both wrapped engines. At HEAD the parity helper sees
 * one more face of it: plain's final text is `FINISHED 1 STEPS [out:out-a]` (the `processOutputResult`
 * mutation reaches the public and full output) while durable and evented end at `FINISHED 1 STEPS`,
 * even though the tag does land on their persisted assistant message. That `text`/`fullOutput.text`
 * difference is declared with COR-1414 rather than ignored, and the wrapped contract is pinned at its
 * current values so the assertions go stale once the mutation reaches memory and the output
 * everywhere.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { OutputProcessor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import type {
  CapturedRequest,
  EngineDifference,
  EngineTurnOptions,
  ModelScript,
  ParityEngine,
  ParitySnapshot,
} from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

type Mode = 'mutate' | 'tripwire' | 'data';
/** `throws` is driven directly (see below), so it is not one of `PLAIN_CONTRACTS`' recorded variants. */
type ProbeMode = Mode | 'throws';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const THREAD = 't45-thread';
const RESOURCE = 't45-resource';
const MAX_STEPS = 3;
const STEPS = 1;
const OUTPUT_ID = 'out-a';
const FINAL_TEXT = 'finished 1 steps';

/** Recorded `plain-none-*` contracts at the audit pin; identical on durable and evented. */
const PLAIN_CONTRACTS: Record<Mode, Record<string, unknown>> = {
  mutate: {
    streamedMutated: true,
    memoryMutated: true,
    memoryUppercased: true,
    lastType: 'finish',
    finishes: 1,
    errors: 0,
    tripwire: false,
    thrown: null,
    modelCalls: 2,
    steps: 1,
  },
  tripwire: {
    streamedMutated: false,
    memoryMutated: false,
    memoryUppercased: false,
    lastType: 'tripwire',
    finishes: 0,
    errors: 1,
    tripwire: true,
    thrown: null,
    modelCalls: 2,
    steps: 1,
  },
  data: {
    streamedMutated: false,
    memoryMutated: false,
    memoryUppercased: false,
    lastType: 'finish',
    finishes: 1,
    errors: 0,
    tripwire: false,
    thrown: null,
    modelCalls: 2,
    steps: 1,
  },
};

/**
 * The `throws` shape, measured on every engine at the audit pin (all three identical): the throwing
 * `processOutputStream` swallows the unprocessed text, the run surfaces one `error` chunk and still
 * reaches `step-finish`/`finish`. Pinned literally so the checks go stale if any engine moves.
 */
const THROWS_CHUNK_TYPES = [
  'start',
  'step-start',
  'tool-call',
  'tool-result',
  'step-finish',
  'step-start',
  'text-start',
  'error',
  'step-finish',
  'finish',
];

const THROWS_CONTRACT: Record<string, unknown> = {
  streamedMutated: false,
  memoryMutated: false,
  memoryUppercased: false,
  lastType: 'finish',
  finishes: 1,
  errors: 1,
  tripwire: false,
  thrown: null,
  modelCalls: 2,
  steps: 1,
};

/**
 * The assistant messages each engine persisted on the `throws` shape (COR-1414). The harness contract
 * hides this: `memoryMutated`/`memoryUppercased` are false everywhere. Plain fails the run before any
 * step output is saved, so it persists nothing; durable and evented persist the tool-invocation part
 * and then an `error` part. Pinned per engine so the assertion goes stale once COR-1414 makes the
 * saved messages match.
 */
const THROWS_MEMORY: Record<ParityEngine, { messages: number; partTypes: string[] }> = {
  plain: { messages: 0, partTypes: [] },
  durable: { messages: 2, partTypes: ['tool-invocation', 'error'] },
  evented: { messages: 2, partTypes: ['tool-invocation', 'error'] },
};

/** Harness `errorChunks`: `error`, `abort` and `tripwire` chunks all count as a surfaced failure. */
function errorChunks(turn: ParitySnapshot): number {
  return ['error', 'abort', 'tripwire'].reduce((total, type) => total + chunksOfType(turn, type), 0);
}

/**
 * COR-1414: `processOutputResult`'s mutation of the final assistant text reaches the public and full
 * output on plain only. Durable and evented persist the tag on the assistant message (the harness
 * `memoryMutated` contract) but their `fullOutput.text` — and the snapshot `text` derived from it —
 * stays at the un-tagged `processOutputStream` text. Pinned to wrapped's current value so this
 * declaration goes stale the moment the mutation reaches the output everywhere.
 */
const MUTATE_FINAL_TEXT: EngineDifference = {
  reason:
    'COR-1414: the processOutputResult mutation of the final assistant text reaches the public and full output on plain but not on durable or evented.',
  expect: plain => ({
    ...plain,
    turns: plain.turns.map(turn => ({
      ...turn,
      text: 'FINISHED 1 STEPS',
      fullOutput: { ...turn.fullOutput, text: 'FINISHED 1 STEPS' },
    })),
  }),
};

/** `done` counts how many completed steps the prompt already carries (harness `toolResults(prompt)`). */
function completedSteps(request: CapturedRequest): number {
  return request.prompt.reduce((total, message) => {
    if (!Array.isArray(message.content)) return total;
    return total + message.content.filter(part => part.type === 'tool-result').length;
  }, 0);
}

interface HookRecord {
  hook: string;
  type?: string;
  hasWriter?: boolean;
}

interface ProbeHandles {
  /** Harness `state.toolLog` filtered to this processor. */
  log: HookRecord[];
}

function createOutputProbe(id: string, mode: ProbeMode, handles: ProbeHandles): OutputProcessor {
  const record = (hook: string, extra: Omit<HookRecord, 'hook'> = {}) => handles.log.push({ hook, ...extra });
  const act = (hook: string, abort: (reason?: string) => never) => {
    if (mode === 'tripwire') abort(`${id} tripwire at ${hook}`);
    // Harness probe `throw`: the same hook throws where `tripwire` aborts.
    if (mode === 'throws') throw new Error(`${id} threw at ${hook}`);
  };
  let emitted = false;

  return {
    id,
    name: id,
    processOutputStream: async ({ part, abort, writer }) => {
      // G8 (#19375): a non-transient data-* chunk emitted from an output processor must reach the
      // stream AND the persisted assistant message on every engine.
      if (mode === 'data' && part.type === 'text-delta' && !emitted) {
        emitted = true;
        record('writer.custom', { hasWriter: Boolean(writer) });
        await writer?.custom({ type: 'data-probe', data: { processor: id } });
      }
      if (['text-delta', 'text-end', 'tool-call', 'finish', 'step-finish'].includes(part.type)) {
        record('processOutputStream', { type: part.type });
      }
      if (part.type === 'text-delta') {
        act('processOutputStream', abort);
        // Harness probe `mutate`: upper-case every text delta on its way to the stream.
        if (mode === 'mutate') {
          return { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } };
        }
      }
      return part;
    },
    processOutputResult: ({ messages, abort }) => {
      record('processOutputResult');
      act('processOutputResult', abort);
      // Harness probe `mutate`: tag the final assistant text.
      if (mode === 'mutate') {
        const last = [...messages].reverse().find(message => message.role === 'assistant');
        const part = (last?.content?.parts ?? []).filter(entry => entry.type === 'text').at(-1) as
          | { text: string }
          | undefined;
        if (part) part.text = `${part.text} [out:${id}]`;
      }
      return messages;
    },
  };
}

async function runT45(mode: Mode) {
  const memories = new Map<ParityEngine, MockMemory>();
  const handleLogs = new Map<ParityEngine, ProbeHandles>();
  // harness `toolLog(state, 'step', 'commit')`: the step tool's own commit log, which survives a
  // tripwire that never reaches the parity snapshot's toolResults.
  const stepCommits = new Map<ParityEngine, number>();

  const script: ModelScript = {
    respond(request) {
      const done = completedSteps(request);
      if (done >= STEPS) return textOnlyTape(`finished ${done} steps`);
      return toolCallTape('step', { n: done + 1 }, `t45-step-${done + 1}`);
    },
  };

  const results = await expectEngineParity({
    model: script,
    buildAgent: ({ engine, model }) => {
      const memory = new MockMemory();
      memories.set(engine, memory);
      handleLogs.set(engine, { log: [] });
      stepCommits.set(engine, 0);
      return new Agent({
        id: 't45-agent',
        name: 'T45 Agent',
        instructions: 'Use the step tool until you have finished.',
        model,
        tools: {
          step: createTool({
            id: 'step',
            description: 'Record one completed step.',
            inputSchema: z.object({ n: z.number() }),
            execute: async ({ n }) => {
              stepCommits.set(engine, (stepCommits.get(engine) ?? 0) + 1);
              return { done: n };
            },
          }),
        },
        memory,
        outputProcessors: [createOutputProbe(OUTPUT_ID, mode, handleLogs.get(engine)!)],
      });
    },
    input: 'go',
    options: {
      maxSteps: MAX_STEPS,
      runId: `t45-run-${mode}`,
      memory: { thread: THREAD, resource: RESOURCE },
    } satisfies EngineTurnOptions,
    differences: mode === 'mutate' ? { durable: MUTATE_FINAL_TEXT, evented: MUTATE_FINAL_TEXT } : undefined,
  });

  return { results, memories, handleLogs, stepCommits };
}

interface ThrowCaseState {
  /** Chunk types the public stream yielded, in order. */
  chunkTypes: string[];
  /** The failure chunk's payload, when the stream carried one. */
  errorPayload: unknown;
  /** Text the stream streamed — the harness's `text`. */
  streamedText: string;
  /** `finish` chunks the stream yielded — the harness's `finishes`. */
  finishes: number;
  /** Failure chunks (`error`/`abort`/`tripwire`) — the harness's `errors`. */
  errors: number;
  /** Whether the stream carried a `tripwire` chunk. */
  tripwire: boolean;
  /** Set when the run rejected — the harness's `thrown`. */
  thrown?: string;
  /** Model calls the run made. */
  requests: number;
  /** `step` tool executions that completed. */
  steps: number;
  /** The persisted assistant messages, serialised. */
  assistant: string;
  /** How many assistant messages were persisted, and each message part's type in order. */
  assistantShape: { messages: number; partTypes: string[] };
}

/**
 * Drives one engine through the `throws` shape the way the parity helper does per engine (wrapper,
 * host, one streamed turn). A direct check is required because the helper's own built-in declaration
 * for the `error` chunk (COR-1390, plain forwards the live `Error` under `type: 'error'` where the
 * wrapped engines forward the serialised error alone) does not reproduce for a failure raised by an
 * output processor — neither engine adds that `type` key here — and `checkEngine` reports a stale
 * declaration before any scenario-level declaration is considered (COR-1429).
 */
async function runT45ThrowsDirect(engine: ParityEngine): Promise<ThrowCaseState> {
  const requests: CapturedRequest[] = [];
  const model = new MockLanguageModelV2({
    doStream: async (options: unknown) => {
      const request = options as unknown as CapturedRequest;
      requests.push(request);
      const done = completedSteps(request);
      return {
        stream: convertArrayToReadableStream(
          (done >= STEPS
            ? textOnlyTape(`finished ${done} steps`)
            : toolCallTape('step', { n: done + 1 }, `t45-step-${done + 1}`)) as never[],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
  const state: ThrowCaseState = {
    chunkTypes: [],
    errorPayload: undefined,
    streamedText: '',
    finishes: 0,
    errors: 0,
    tripwire: false,
    requests: 0,
    steps: 0,
    assistant: '',
    assistantShape: { messages: 0, partTypes: [] },
  };
  const memory = new MockMemory();
  const agent = new Agent({
    id: 't45-agent',
    name: 'T45 Agent',
    instructions: 'Use the step tool until you have finished.',
    model: model as LanguageModelV2,
    tools: {
      step: createTool({
        id: 'step',
        description: 'Record one completed step.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => {
          state.steps += 1;
          return { done: n };
        },
      }),
    },
    memory,
    outputProcessors: [createOutputProbe(OUTPUT_ID, 'throws', { log: [] })],
  });
  const pubsub = new EventEmitterPubSub();
  const runner =
    engine === 'plain'
      ? agent
      : engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : createEventedAgent({ agent });
  const host = new Mastra({
    agents: { 't45-agent': runner } as never,
    storage: new InMemoryStore(),
    logger: false,
  });

  const options = {
    maxSteps: MAX_STEPS,
    runId: `t45-run-throws-${engine}`,
    memory: { thread: THREAD, resource: RESOURCE },
  };

  let cleanup: (() => Promise<void>) | undefined;
  let output: { fullStream: AsyncIterable<{ type: string; payload?: unknown }> } | undefined;
  try {
    if (engine === 'plain') {
      output = (await agent.stream('go', options)) as never;
    } else {
      const result = await (
        runner as unknown as {
          stream: (input: string, options: unknown) => Promise<{ output: never; cleanup: () => Promise<void> }>;
        }
      ).stream('go', options);
      output = result.output;
      cleanup = result.cleanup;
    }
  } catch (error) {
    state.thrown = String((error as Error)?.message ?? error).slice(0, 200);
  }
  if (output) {
    try {
      for await (const chunk of output.fullStream) {
        state.chunkTypes.push(chunk.type);
        if (chunk.type === 'text-delta') {
          state.streamedText += String((chunk.payload as { text?: string } | undefined)?.text ?? '');
        }
        if (chunk.type === 'finish') state.finishes += 1;
        if (['error', 'abort', 'tripwire'].includes(chunk.type)) {
          state.errors += 1;
          state.errorPayload = chunk.payload;
        }
        if (chunk.type === 'tripwire') state.tripwire = true;
      }
    } catch (error) {
      state.thrown = state.thrown ?? String((error as Error)?.message ?? error).slice(0, 200);
    }
  }
  state.requests = requests.length;
  const { messages } = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
  const assistantMessages = messages.filter(message => message.role === 'assistant');
  state.assistant = JSON.stringify(assistantMessages);
  state.assistantShape = {
    messages: assistantMessages.length,
    partTypes: assistantMessages.flatMap(message => (message.content?.parts ?? []).map(part => part.type)),
  };
  if (cleanup) await cleanup();
  await host.shutdown();
  return state;
}

/** The harness's `done()` contract fields, read from a direct run's state. */
function throwsContract(state: ThrowCaseState): Record<string, unknown> {
  return {
    streamedMutated: state.streamedText.includes('FINISHED'),
    memoryMutated: state.assistant.includes(`[out:${OUTPUT_ID}]`),
    memoryUppercased: state.assistant.includes('FINISHED 1 STEPS'),
    lastType: state.chunkTypes.at(-1) ?? null,
    finishes: state.finishes,
    errors: state.errors,
    tripwire: state.tripwire,
    thrown: state.thrown ?? null,
    modelCalls: state.requests,
    steps: state.steps,
  };
}

describe('T45 output processors (plain, durable, evented)', () => {
  it('mutates the stream and the final assistant text', async () => {
    const { results, memories, handleLogs, stepCommits } = await runT45('mutate');
    const contracts = new Map<ParityEngine, Record<string, unknown>>();

    for (const engine of ENGINES) {
      const observation = results[engine]!;
      const turn = observation.turns[0];
      if (!turn) throw new Error(`T45 mutate: ${engine} produced no turn`);

      // harness: `stream text was mutated by processOutputStream`.
      expect(turn.streamedText, `${engine}: streamed text`).toContain('FINISHED 1 STEPS');
      // harness: `processOutputResult ran once`.
      expect(
        handleLogs.get(engine)!.log.filter(entry => entry.hook === 'processOutputResult'),
        `${engine}: processOutputResult runs`,
      ).toHaveLength(1);
      // harness: `run finished normally`.
      expect(chunksOfType(turn, 'finish'), `${engine}: finish chunks`).toBe(1);
      expect(errorChunks(turn), `${engine}: error chunks`).toBe(0);

      const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
      const assistant = JSON.stringify(messages.filter(message => message.role === 'assistant'));

      contracts.set(engine, {
        streamedMutated: turn.streamedText.includes('FINISHED'),
        memoryMutated: assistant.includes(`[out:${OUTPUT_ID}]`),
        memoryUppercased: assistant.includes('FINISHED 1 STEPS'),
        lastType: turn.chunkTypes.at(-1) ?? null,
        finishes: chunksOfType(turn, 'finish'),
        errors: errorChunks(turn),
        tripwire: chunksOfType(turn, 'tripwire') > 0,
        thrown: null,
        modelCalls: observation.requests.length,
        steps: stepCommits.get(engine),
      });
    }

    expect(contracts.get('plain'), 'plain contract').toEqual(PLAIN_CONTRACTS.mutate);
    // COR-1414: durable and evented persist the processOutputResult tag but not the
    // processOutputStream-upper-cased text, so their memory holds the original deltas. The harness's
    // own KNOWN note records exactly this split; the per-engine values are pinned so the assertion
    // goes stale once the mutation reaches memory everywhere.
    const wrappedContract = { ...PLAIN_CONTRACTS.mutate, memoryUppercased: false };
    for (const engine of ENGINES.slice(1)) {
      expect(contracts.get(engine), `${engine} contract`).toEqual(wrappedContract);
    }
  });

  it('surfaces a tripwire raised on the first text delta', async () => {
    const { results, memories, stepCommits } = await runT45('tripwire');
    const contracts = new Map<ParityEngine, Record<string, unknown>>();

    for (const engine of ENGINES) {
      const observation = results[engine]!;
      const turn = observation.turns[0];
      if (!turn) throw new Error(`T45 tripwire: ${engine} produced no turn`);

      // harness: `tripwire surfaced (tripwire chunk, error, or thrown)`.
      expect(chunksOfType(turn, 'tripwire'), `${engine}: tripwire chunks`).toBeGreaterThan(0);
      // harness: `original text did not reach the stream after the tripwire`.
      expect(turn.streamedText, `${engine}: text after the tripwire`).not.toContain(FINAL_TEXT);

      const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
      const assistant = JSON.stringify(messages.filter(message => message.role === 'assistant'));

      contracts.set(engine, {
        streamedMutated: turn.streamedText.includes('FINISHED'),
        memoryMutated: assistant.includes(`[out:${OUTPUT_ID}]`),
        memoryUppercased: assistant.includes('FINISHED 1 STEPS'),
        lastType: turn.chunkTypes.at(-1) ?? null,
        finishes: chunksOfType(turn, 'finish'),
        errors: errorChunks(turn),
        tripwire: chunksOfType(turn, 'tripwire') > 0,
        thrown: null,
        modelCalls: observation.requests.length,
        steps: stepCommits.get(engine),
      });
    }

    expect(contracts.get('plain'), 'plain contract').toEqual(PLAIN_CONTRACTS.tripwire);
    for (const engine of ENGINES.slice(1)) {
      expect(contracts.get(engine), `${engine} contract`).toEqual(contracts.get('plain'));
    }
  });

  it('emits a data-probe chunk from the processor writer', async () => {
    const { results, memories, handleLogs, stepCommits } = await runT45('data');
    const contracts = new Map<ParityEngine, Record<string, unknown>>();

    for (const engine of ENGINES) {
      const observation = results[engine]!;
      const turn = observation.turns[0];
      if (!turn) throw new Error(`T45 data: ${engine} produced no turn`);

      const writerHooks = handleLogs.get(engine)!.log.filter(entry => entry.hook === 'writer.custom');
      // harness: `processor received a writer`.
      expect(writerHooks, `${engine}: writer.custom runs`).toHaveLength(1);
      expect(writerHooks[0]!.hasWriter, `${engine}: processor received a writer`).toBe(true);
      // harness: `data-probe chunk reached the stream`.
      expect(chunksOfType(turn, 'data-probe'), `${engine}: data-probe chunks`).toBe(1);

      const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
      const assistant = JSON.stringify(messages.filter(message => message.role === 'assistant'));
      const persistedDataParts = messages
        .filter(message => message.role === 'assistant')
        .flatMap(message => message.content?.parts ?? [])
        .filter(part => part.type === 'data-probe');
      // harness: `data-probe part persisted on the assistant message`.
      expect(persistedDataParts, `${engine}: data-probe parts persisted`).toHaveLength(1);

      // harness: `run finished normally`.
      expect(chunksOfType(turn, 'finish'), `${engine}: finish chunks`).toBe(1);
      expect(errorChunks(turn), `${engine}: error chunks`).toBe(0);

      contracts.set(engine, {
        streamedMutated: turn.streamedText.includes('FINISHED'),
        memoryMutated: assistant.includes(`[out:${OUTPUT_ID}]`),
        memoryUppercased: assistant.includes('FINISHED 1 STEPS'),
        lastType: turn.chunkTypes.at(-1) ?? null,
        finishes: chunksOfType(turn, 'finish'),
        errors: errorChunks(turn),
        tripwire: chunksOfType(turn, 'tripwire') > 0,
        thrown: null,
        modelCalls: observation.requests.length,
        steps: stepCommits.get(engine),
      });
    }

    expect(contracts.get('plain'), 'plain contract').toEqual(PLAIN_CONTRACTS.data);
    for (const engine of ENGINES.slice(1)) {
      expect(contracts.get(engine), `${engine} contract`).toEqual(contracts.get('plain'));
    }
  });
  it('fails closed when a text delta throws', async () => {
    const states = new Map<ParityEngine, ThrowCaseState>();
    for (const engine of ENGINES) states.set(engine, await runT45ThrowsDirect(engine));

    for (const engine of ENGINES) {
      const state = states.get(engine)!;

      // harness: `fails closed: unprocessed text never streamed (#25826)`.
      expect(state.streamedText, `${engine}: streamed text`).not.toContain(FINAL_TEXT);
      // harness: `fails closed: the processor failure surfaced (error chunk or stream error)`.
      expect(state.errors > 0 || state.thrown !== undefined, `${engine}: failure surfaced`).toBe(true);

      // Every engine reaches the same chunk sequence and the same contract. The failure chunk's
      // payload diverges: plain holds the live `Error` while durable and evented hold a serialised
      // `{ name, message }` object, so only the shared content is asserted.
      expect(state.chunkTypes, `${engine}: chunk types`).toEqual(THROWS_CHUNK_TYPES);
      expect(Object.keys((state.errorPayload ?? {}) as object), `${engine}: failure chunk payload keys`).toEqual([
        'error',
      ]);
      const failure = (state.errorPayload as { error?: { name?: string; message?: string } }).error;
      expect(failure?.name, `${engine}: failure name`).toBe('Error');
      expect(failure?.message, `${engine}: failure message`).toBe(`${OUTPUT_ID} threw at processOutputStream`);
      expect(state.thrown, `${engine}: run rejection`).toBeUndefined();
      expect(throwsContract(state), `${engine} contract`).toEqual(THROWS_CONTRACT);
      // COR-1414: memory diverges — plain persists no assistant message, durable and evented persist
      // the tool-invocation part plus an error part. Pinned per engine so this goes red when the fix
      // lands.
      expect(state.assistantShape, `${engine}: persisted assistant messages`).toEqual(THROWS_MEMORY[engine]);
    }
  });
});

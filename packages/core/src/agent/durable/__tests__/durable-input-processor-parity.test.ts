/**
 * Ported from validation harness case T44 (input-processors) — in-tree home for case T44.
 *
 * One probe processor is installed as `inputProcessors` and the script model records what it
 * received, so the case can see whether an input mutation reached the model request and memory, and
 * whether a tripwire stopped the run before the model was called. Model-free: `stepScript(1)` — one
 * `step` tool call then `finished 1 steps` — with `maxSteps: 3`.
 *
 * Three shapes are ported:
 *   - `mutate`   — the mutation reaches the model request and the persisted user message.
 *   - `tripwire` — `processInput` aborts, no model call happens, and the stream carries the tripwire
 *     chunk. Plain emits the `tripwire` chunk alone while durable and evented emit `start` before it,
 *     declared below against COR-1390 (the widened chunk-sequence ticket); the tripwire chunk's own
 *     content is compared exactly.
 *   - `throws`   — `processInput` throws. All three engines fail closed: the run rejects
 *     `[Agent:script] - Input processor error` with no model call, finish chunk, completed step, or
 *     persisted mutation. This is the COR-1413 regression contract.
 *
 * The `throws` shape uses `runT44ThrowsDirect` to pin the rejection message and the absence of model,
 * stream, tool, and memory side effects explicitly. The resulting contract is identical across plain,
 * durable, and evented engines.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import type { InputProcessor } from '../../../processors';
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

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const THREAD = 't44-thread';
const RESOURCE = 't44-resource';
const MAX_STEPS = 3;
const STEPS = 1;
const MUTATION = '[in:in-a]';
const PROCESSOR_ID = 'in-a';

/**
 * COR-1390 — durable and evented emit an empty-payload `start` chunk before the tripwire chunk,
 * where plain emits the tripwire chunk alone; the tripwire chunk's own payload (`processorId` and
 * `reason`) is identical on all three engines. The `expect` reproduces the wrapped shape from
 * plain's, leaving every other field exactly compared. When the wrapped stream stops emitting the
 * extra `start` the difference no longer reproduces and the helper fails the test, which is the
 * signal to delete this declaration.
 */
const TRIPWIRE_SHAPE: EngineDifference = {
  reason:
    'COR-1390: durable and evented emit a `start` chunk with an empty payload before the tripwire chunk; plain emits the tripwire chunk alone.',
  expect: plain => ({
    ...plain,
    turns: plain.turns.map(turn => {
      const index = turn.chunkTypes.indexOf('tripwire');
      return {
        ...turn,
        chunks: insertAt(turn.chunks, index, 'AGENT:start'),
        chunkTypes: insertAt(turn.chunkTypes, index, 'start'),
        chunkPayloads: insertAt(turn.chunkPayloads, index, {}),
      };
    }),
  }),
};

/** Recorded contract for the input-mutation shape; the harness pairs the cells against plain. */
const MUTATE_CONTRACT: Record<string, unknown> = {
  modelCalls: 2,
  mutationInRequest: true,
  mutationInMemory: true,
  finishes: 1,
  errors: 0,
  tripwire: false,
  thrown: null,
  steps: 1,
  text: 'finished 1 steps',
};

/** Recorded contract for the tripwire shape: the run stops in `processInput`, before any model call. */
const TRIPWIRE_CONTRACT: Record<string, unknown> = {
  modelCalls: 0,
  mutationInRequest: false,
  mutationInMemory: false,
  finishes: 0,
  errors: 1,
  tripwire: true,
  thrown: null,
  steps: 0,
  text: null,
};

function insertAt<T>(list: T[], index: number, value: T): T[] {
  return [...list.slice(0, index), value, ...list.slice(index)];
}

/** Harness `errorChunks`: `error`, `abort` and `tripwire` chunks all count as a surfaced failure. */
function errorChunks(turn: ParitySnapshot): number {
  return ['error', 'abort', 'tripwire'].reduce((total, type) => total + chunksOfType(turn, type), 0);
}

/** Harness `toolLog(state, 'step', 'commit').length`: the `step` calls that ran to completion. */
function committedSteps(turn: ParitySnapshot): number {
  return turn.toolResults.filter(result => result.toolName === 'step').length;
}

/** `done` counts how many completed steps the prompt already carries (harness `toolResults(prompt)`). */
function completedSteps(request: CapturedRequest): number {
  return request.prompt.reduce((total, message) => {
    if (!Array.isArray(message.content)) return total;
    return total + message.content.filter(part => part.type === 'tool-result').length;
  }, 0);
}

type Mode = 'mutate' | 'tripwire' | 'throw';

/** Mutates the last user text, trips the wire, or throws, exactly where the harness probe does. */
function createInputProbe(id: string, mode: Mode, onInput: () => void): InputProcessor {
  return {
    id,
    name: id,
    processInput: ({ messages, abort }) => {
      onInput();

      if (mode === 'tripwire') abort(`${id} tripwire at processInput`);
      // The harness probe's `act` runs before its mutation, so a throwing processor never mutates.
      if (mode === 'throw') throw new Error(`${id} threw at processInput`);

      const last = [...messages].reverse().find(message => message.role === 'user');
      const part = (last?.content?.parts ?? []).filter(part => part.type === 'text').at(-1);
      if (part && 'text' in part) part.text = `${String(part.text)} ${MUTATION}`;

      return messages;
    },
    // The harness probe logs this hook for the input side as well; it never changes the messages.
    processInputStep: () => undefined,
  };
}

async function runT44(mode: Mode) {
  const memories = new Map<ParityEngine, MockMemory>();
  const inputs = new Map<ParityEngine, number>();

  const script: ModelScript = {
    respond(request) {
      const done = completedSteps(request);
      if (done >= STEPS) return textOnlyTape(`finished ${done} steps`);
      return toolCallTape('step', { n: done + 1 }, `t44-step-${done + 1}`);
    },
  };

  const results = await expectEngineParity({
    model: script,
    ...(mode === 'tripwire' ? { differences: { durable: TRIPWIRE_SHAPE, evented: TRIPWIRE_SHAPE } } : {}),
    buildAgent: ({ engine, model }) => {
      const memory = new MockMemory();
      memories.set(engine, memory);
      inputs.set(engine, 0);
      return new Agent({
        id: 't44-agent',
        name: 'T44 Agent',
        instructions: 'Use the step tool until you have finished.',
        model,
        tools: {
          step: createTool({
            id: 'step',
            description: 'Record one completed step.',
            inputSchema: z.object({ n: z.number() }),
            execute: async ({ n }) => ({ done: n }),
          }),
        },
        memory,
        inputProcessors: [
          createInputProbe(PROCESSOR_ID, mode, () => inputs.set(engine, (inputs.get(engine) ?? 0) + 1)),
        ],
      });
    },
    input: 'hello there',
    options: {
      maxSteps: MAX_STEPS,
      runId: `t44-run-${mode}`,
      memory: { thread: `${THREAD}-${mode}`, resource: `${RESOURCE}-${mode}` },
    } satisfies EngineTurnOptions,
  });

  return { results, memories, inputs };
}

/** COR-1413: every engine rejects before the model, stream completion, or tool execution. */
const THROWS_CONTRACT: Record<string, unknown> = {
  modelCalls: 0,
  finishes: 0,
  errors: 0,
  tripwire: false,
  steps: 0,
  text: null,
  thrown: true,
};

const THROWS_CONTRACTS: Record<ParityEngine, Record<string, unknown>> = {
  plain: THROWS_CONTRACT,
  durable: THROWS_CONTRACT,
  evented: THROWS_CONTRACT,
};

/** What a direct run of the `throws` shape recorded on one engine. */
interface ThrowCaseState {
  /** Model calls the run made. */
  requests: number;
  /** Chunk types the public stream yielded, in order. */
  chunkTypes: string[];
  /** The failure chunk's payload, when the stream carried one. */
  failurePayload: unknown;
  /** Text the stream streamed — the harness's `text`. */
  streamedText: string;
  /** `finish` chunks the stream yielded — the harness's `finishes`. */
  finishes: number;
  /** `step` tool executions that completed — the harness's `steps`. */
  steps: number;
  /** Times `processInput` ran. */
  inputs: number;
  /** The first model request's user messages, serialised. */
  requestUser: string;
  /** The persisted user messages, serialised. */
  memoryUser: string;
  /** Set when the run rejected — the harness's `thrown`. */
  thrown?: string;
}

/**
 * Drives one engine through the `throws` shape so the test can pin rejection text and side effects
 * that sit outside the parity snapshot, including memory and completed tool executions.
 */
async function runT44ThrowsDirect(engine: ParityEngine): Promise<ThrowCaseState> {
  const requests: Array<{ prompt?: unknown }> = [];
  const model = new MockLanguageModelV2({
    doStream: async (options: unknown) => {
      requests.push(options as { prompt?: unknown });
      return {
        stream: convertArrayToReadableStream(
          (requests.length === 1
            ? toolCallTape('step', { n: 1 }, 't44-step-1')
            : textOnlyTape(`finished ${STEPS} steps`)) as never[],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
  const state: ThrowCaseState = {
    requests: 0,
    chunkTypes: [],
    failurePayload: undefined,
    streamedText: '',
    finishes: 0,
    steps: 0,
    inputs: 0,
    requestUser: '',
    memoryUser: '',
  };
  const memory = new MockMemory();
  const agent = new Agent({
    id: 't44-agent',
    name: 'T44 Agent',
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
    inputProcessors: [createInputProbe(PROCESSOR_ID, 'throw', () => (state.inputs += 1))],
  });
  const pubsub = new EventEmitterPubSub();
  const runner =
    engine === 'plain'
      ? agent
      : engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : createEventedAgent({ agent });
  const host = new Mastra({
    agents: { 't44-agent': runner } as never,
    storage: new InMemoryStore(),
    logger: false,
  });

  const thread = `${THREAD}-throw`;
  const resource = `${RESOURCE}-throw`;
  const options = {
    maxSteps: MAX_STEPS,
    runId: `t44-run-throw-${engine}`,
    memory: { thread, resource },
  };

  let cleanup: (() => Promise<void>) | undefined;
  let output: { fullStream: AsyncIterable<{ type: string; payload?: unknown }> } | undefined;
  try {
    if (engine === 'plain') {
      output = (await agent.stream('hello there', options)) as never;
    } else {
      const result = await (
        runner as unknown as {
          stream: (input: string, options: unknown) => Promise<{ output: never; cleanup: () => Promise<void> }>;
        }
      ).stream('hello there', options);
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
        if (['error', 'abort', 'tripwire'].includes(chunk.type)) state.failurePayload = chunk.payload;
      }
    } catch (error) {
      state.thrown = state.thrown ?? String((error as Error)?.message ?? error).slice(0, 200);
    }
  }
  state.requests = requests.length;
  state.requestUser = JSON.stringify(
    requests[0]?.prompt === undefined
      ? []
      : (requests[0].prompt as Array<{ role?: string }>).filter(m => m.role === 'user'),
  );
  // Teardown runs even if the recall throws, so this run's host cannot outlive the test.
  try {
    const { messages } = await memory.recall({ threadId: thread, resourceId: resource });
    state.memoryUser = JSON.stringify(messages.filter(message => message.role === 'user'));
  } finally {
    try {
      if (cleanup) await cleanup();
    } finally {
      await host.shutdown();
    }
  }
  return state;
}

/** The harness's `done()` contract fields, read from a direct run's state. */
function throwsContract(state: ThrowCaseState): Record<string, unknown> {
  return {
    modelCalls: state.requests,
    finishes: state.finishes,
    errors: state.chunkTypes.filter(type => ['error', 'abort', 'tripwire'].includes(type)).length,
    tripwire: state.chunkTypes.includes('tripwire'),
    steps: state.steps,
    text: state.streamedText || null,
    // The harness app's agent name prefixes the rejection (`[Agent:script]`), so only whether the run
    // rejected is stable across hosts; the wording is asserted separately below.
    thrown: state.thrown !== undefined,
  };
}

describe('T44 input processors (plain, durable, evented)', () => {
  it('lets an input mutation reach the model request and memory', async () => {
    const { results, memories, inputs } = await runT44('mutate');
    const contracts = new Map<ParityEngine, Record<string, unknown>>();

    for (const engine of ENGINES) {
      const observation = results[engine]!;
      const turn = observation.turns[0];
      const request = observation.requests[0];
      if (!turn) throw new Error(`T44 mutate: ${engine} produced no turn`);

      // harness: `run settled` + `processInput ran exactly once`.
      expect(inputs.get(engine), `${engine}: processInput runs`).toBe(1);

      const firstUser = JSON.stringify((request?.prompt ?? []).filter(message => message.role === 'user'));
      // harness: `mutation reached the model request`.
      expect(firstUser, `${engine}: mutation reached the model request`).toContain(MUTATION);

      // harness: `run finished normally`.
      expect(chunksOfType(turn, 'finish'), `${engine}: finish chunks`).toBe(1);
      expect(errorChunks(turn), `${engine}: error chunks`).toBe(0);
      expect(turn.streamedText, `${engine}: final text`).toBe('finished 1 steps');

      const { messages } = await memories
        .get(engine)!
        .recall({ threadId: `${THREAD}-mutate`, resourceId: `${RESOURCE}-mutate` });
      const memoryUser = JSON.stringify(messages.filter(message => message.role === 'user'));

      contracts.set(engine, {
        modelCalls: observation.requests.length,
        mutationInRequest: firstUser.includes(MUTATION),
        mutationInMemory: memoryUser.includes(MUTATION),
        finishes: chunksOfType(turn, 'finish'),
        errors: errorChunks(turn),
        tripwire: chunksOfType(turn, 'tripwire') > 0,
        thrown: null,
        steps: committedSteps(turn),
        text: turn.streamedText || null,
      });
    }

    expect(contracts.get('plain'), 'plain contract').toEqual(MUTATE_CONTRACT);
    for (const engine of ENGINES.slice(1)) {
      // The harness pairs every cell's contract against plain, so the wrapped engines reproduce it.
      expect(contracts.get(engine), `${engine} contract`).toEqual(contracts.get('plain'));
    }
  });

  it('stops the run in processInput when the input processor trips the wire', async () => {
    const { results, memories, inputs } = await runT44('tripwire');
    const contracts = new Map<ParityEngine, Record<string, unknown>>();

    for (const engine of ENGINES) {
      const observation = results[engine]!;
      const turn = observation.turns[0];
      if (!turn) throw new Error(`T44 tripwire: ${engine} produced no turn`);

      // harness: `run settled` + `processInput ran exactly once`.
      expect(inputs.get(engine), `${engine}: processInput runs`).toBe(1);

      // harness: `model was never called`.
      expect(observation.requests, `${engine}: model calls`).toHaveLength(0);

      // harness: `stream carries a tripwire signal`.
      expect(chunksOfType(turn, 'tripwire'), `${engine}: tripwire chunks`).toBe(1);

      const { messages } = await memories
        .get(engine)!
        .recall({ threadId: `${THREAD}-tripwire`, resourceId: `${RESOURCE}-tripwire` });
      const memoryUser = JSON.stringify(messages.filter(message => message.role === 'user'));

      contracts.set(engine, {
        modelCalls: observation.requests.length,
        mutationInRequest: false,
        mutationInMemory: memoryUser.includes(MUTATION),
        finishes: chunksOfType(turn, 'finish'),
        errors: errorChunks(turn),
        tripwire: chunksOfType(turn, 'tripwire') > 0,
        thrown: null,
        steps: committedSteps(turn),
        text: turn.streamedText || null,
      });
    }

    expect(contracts.get('plain'), 'plain contract').toEqual(TRIPWIRE_CONTRACT);
    for (const engine of ENGINES.slice(1)) {
      expect(contracts.get(engine), `${engine} contract`).toEqual(contracts.get('plain'));
    }
  });

  it('fails closed on a throwing input processor for every engine', async () => {
    const states = new Map<ParityEngine, ThrowCaseState>();
    for (const engine of ENGINES) {
      states.set(engine, await runT44ThrowsDirect(engine));
    }

    for (const engine of ENGINES) {
      const state = states.get(engine)!;

      // harness: `run settled` — a hung run would time out here — and `processInput ran exactly once`.
      expect(state.inputs, `${engine}: processInput runs`).toBe(1);

      // harness: every engine rejects and names the input-processor failure.
      expect(state.thrown, `${engine}: rejects`).toContain('Input processor error');

      // harness: the `throw` mode never mutates, so no mutation reaches the request or memory.
      expect(state.requestUser, `${engine}: no mutation reached the model request`).not.toContain(MUTATION);
      expect(state.memoryUser, `${engine}: no mutation reached memory`).not.toContain(MUTATION);
      expect(state.steps, `${engine}: step tool executions`).toBe(THROWS_CONTRACTS[engine].steps);

      expect(throwsContract(state), `${engine} contract`).toEqual(THROWS_CONTRACTS[engine]);
    }
  });
});

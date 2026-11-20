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
 *   - `throws`   — `processInput` throws. Every engine fails closed: the run rejects
 *     `[Agent:script] - Input processor error` with no model call, finish chunk, completed step, or
 *     persisted mutation. This is the COR-1413 regression contract.
 *
 * The `throws` shape runs through parity mode and keeps explicit assertions for the rejection,
 * absence of model and tool activity, and memory side effects.
 */
import { expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import type { InputProcessor } from '../../../../processors';
import { createTool } from '../../../../tools';
import type {
  CapturedRequest,
  EngineDifference,
  EngineTurnOptions,
  ModelScript,
  ParityEngine,
  ParitySnapshot,
  ParityTarget,
} from '../parity';
import { chunksOfType, describeParity, expectParity, textOnlyTape, toolCallTape } from '../parity';

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

      if (mode === 'tripwire') {
        abort(`${id} tripwire at processInput`, { retry: false, metadata: { code: 'rejected', target: 'staging' } });
      }
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

async function runT44(target: ParityTarget, mode: Mode) {
  const memories = new Map<ParityEngine, MockMemory>();
  const inputs = new Map<ParityEngine, number>();

  const script: ModelScript = {
    respond(request) {
      const done = completedSteps(request);
      if (done >= STEPS) return textOnlyTape(`finished ${done} steps`);
      return toolCallTape('step', { n: done + 1 }, `t44-step-${done + 1}`);
    },
  };

  const results = await expectParity(target, {
    model: script,
    ...(mode === 'tripwire' ? { differences: { [target]: TRIPWIRE_SHAPE } } : {}),
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

describeParity('input-processor parity', target => {
  it('lets an input mutation reach the model request and memory', async () => {
    const { results, memories, inputs } = await runT44(target, 'mutate');
    const contracts = new Map<ParityEngine, Record<string, unknown>>();

    for (const engine of ['plain', target] as const) {
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
    // The harness pairs every cell's contract against plain, so the wrapped engine reproduces it.
    expect(contracts.get(target), `${target} contract`).toEqual(contracts.get('plain'));
  });

  it('stops the run in processInput when the input processor trips the wire', async () => {
    const { results, memories, inputs } = await runT44(target, 'tripwire');
    const contracts = new Map<ParityEngine, Record<string, unknown>>();

    for (const engine of ['plain', target] as const) {
      const observation = results[engine]!;
      const turn = observation.turns[0];
      if (!turn) throw new Error(`T44 tripwire: ${engine} produced no turn`);

      // harness: `run settled` + `processInput ran exactly once`.
      expect(inputs.get(engine), `${engine}: processInput runs`).toBe(1);

      // harness: `model was never called`.
      expect(observation.requests, `${engine}: model calls`).toHaveLength(0);

      // harness: `stream carries a tripwire signal`.
      expect(chunksOfType(turn, 'tripwire'), `${engine}: tripwire chunks`).toBe(1);
      expect(turn.chunkPayloads[turn.chunkTypes.indexOf('tripwire')]).toEqual({
        reason: `${PROCESSOR_ID} tripwire at processInput`,
        processorId: PROCESSOR_ID,
        retry: false,
        metadata: { code: 'rejected', target: 'staging' },
      });

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
    expect(contracts.get(target), `${target} contract`).toEqual(contracts.get('plain'));
  });

  it('fails closed on a throwing input processor for every engine', async () => {
    const { results, memories, inputs } = await runT44(target, 'throw');

    for (const engine of ['plain', target] as const) {
      const observation = results[engine]!;
      const turn = observation.turns[0]!;
      expect(inputs.get(engine), `${engine}: processInput runs`).toBe(1);
      expect(turn.error?.message, `${engine}: rejects`).toContain('Input processor error');
      expect(observation.requests, `${engine}: model calls`).toHaveLength(0);
      expect(turn.chunkTypes, `${engine}: stream chunks`).toHaveLength(0);
      expect(committedSteps(turn), `${engine}: step tool executions`).toBe(0);

      const { messages } = await memories
        .get(engine)!
        .recall({ threadId: `${THREAD}-throw`, resourceId: `${RESOURCE}-throw` });
      expect(JSON.stringify(messages), `${engine}: no mutation reached memory`).not.toContain(MUTATION);
    }
  });
});

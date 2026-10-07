/**
 * Ported from validation harness case T44 (input-processors).
 *
 * One probe processor is installed as `inputProcessors` and the script model records what it
 * received, so the case can see whether an input mutation reached the model request and memory.
 * Model-free: `stepScript(1)` — one `step` tool call then `finished 1 steps` — with `maxSteps: 3`.
 *
 * Two variants are escalated rather than weakened here:
 *
 * - `throws` is a recorded FAIL in the harness's own engine comparison: plain fails CLOSED (the run
 *   rejects `[Agent:script] - Input processor error` with no model call) while durable and evented
 *   fail OPEN and run to completion. It is not one of the known differences, and it hits the same
 *   wall as T36's error variant — a rejecting stream cannot be recorded by the parity helper.
 * - `tripwire` passes every harness check and pairs green in the harness (its contract excludes the
 *   public stream shape), but the engines disagree on the stream itself: plain emits exactly one
 *   `tripwire` chunk, while durable and evented emit `start` before the `tripwire` chunk. The
 *   parity helper compares ordered `chunkTypes`, so this undeclared difference is red and the
 *   variant is held until that difference can name a ticket.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import type { InputProcessor } from '../../../processors';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, EngineTurnOptions, ModelScript, ParityEngine, ParitySnapshot } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const THREAD = 't44-thread';
const RESOURCE = 't44-resource';
const MAX_STEPS = 3;
const STEPS = 1;
const MUTATION = '[in:in-a]';

/** Recorded contract; the harness pairs the durable and evented cells against plain. */
const PLAIN_CONTRACT: Record<string, unknown> = {
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

function createInputProbe(id: string, onInput: () => void): InputProcessor {
  return {
    id,
    name: id,
    processInput: ({ messages }) => {
      onInput();

      const last = [...messages].reverse().find(message => message.role === 'user');
      const part = (last?.content?.parts ?? []).filter(part => part.type === 'text').at(-1);
      if (part && 'text' in part) part.text = `${String(part.text)} ${MUTATION}`;

      return messages;
    },
    // The harness probe logs this hook for the input side as well; it never changes the messages.
    processInputStep: () => undefined,
  };
}

async function runT44() {
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
        inputProcessors: [createInputProbe('in-a', () => inputs.set(engine, (inputs.get(engine) ?? 0) + 1))],
      });
    },
    input: 'hello there',
    options: {
      maxSteps: MAX_STEPS,
      runId: 't44-run',
      memory: { thread: THREAD, resource: RESOURCE },
    } satisfies EngineTurnOptions,
  });

  return { results, memories, inputs };
}

describe('T44 input processors (plain, durable, evented)', () => {
  it('lets an input mutation reach the model request and memory', async () => {
    const { results, memories, inputs } = await runT44();
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

      const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
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

    expect(contracts.get('plain'), 'plain contract').toEqual(PLAIN_CONTRACT);
    for (const engine of ENGINES.slice(1)) {
      // The harness pairs every cell's contract against plain's.
      expect(contracts.get(engine), `${engine} contract`).toEqual(contracts.get('plain'));
    }
  });
});

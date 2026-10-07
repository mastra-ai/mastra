/**
 * Ported from validation harness case T46 (processor-order).
 *
 * Three input and three output probe processors are installed in declared order (a, b, c) and every
 * hook invocation is logged. The case pins the order in which `processInput`, `processInputStep`
 * (per step), `processOutputStream` (per chunk) and `processOutputResult` run, and that each
 * per-step hook runs once per model step, on every engine. Model-free: two `step` tool calls then an
 * answer.
 *
 * The harness records the full `hooks` sequence in its case details but pairs only the `contract`
 * fields, so the checks below assert the contract on every engine and additionally pin the recorded
 * hook sequence per engine. The tail of that sequence differs between engines (`finish` reaches the
 * output processors after `step-finish`/`processOutputResult` on durable and evented, before them on
 * plain) — the same class of undeclared ordering difference flagged for T47, and the reason the
 * sequence is pinned per engine rather than compared across engines.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import type { InputProcessor, OutputProcessor } from '../../../processors';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, EngineTurnOptions, ModelScript } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES = ['plain', 'durable', 'evented'] as const;
const DECLARED = ['a', 'b', 'c'] as const;
const THREAD = 't46-thread';
const RESOURCE = 't46-resource';
const MAX_STEPS = 4;
const STEPS = 2;

/** Chunk types an output processor logs, mirroring the harness probe. */
const LOGGED_PART_TYPES = ['text-delta', 'text-end', 'tool-call', 'finish', 'step-finish'];

type Hook = 'processInput' | 'processInputStep' | 'processOutputStream' | 'processOutputResult';
type Entry = { processor: string; hook: Hook; type?: string; stepNumber?: number };

/** `done` counts how many completed steps the prompt already carries (harness `toolResults(prompt)`). */
function completedSteps(request: CapturedRequest): number {
  return request.prompt.reduce((total, message) => {
    if (!Array.isArray(message.content)) return total;
    return total + message.content.filter(part => part.type === 'tool-result').length;
  }, 0);
}

/** Harness `stepScript(2)`: call `step` while fewer than two steps are done, then answer. */
const script: ModelScript = {
  respond(request) {
    const done = completedSteps(request);
    if (done >= STEPS) return textOnlyTape(`finished ${done} steps`);
    return toolCallTape('step', { n: done + 1 }, `step-${done + 1}`);
  },
};

function createInputProbe(id: string, log: Entry[]): InputProcessor {
  const record = (hook: Hook, extra: Omit<Entry, 'processor' | 'hook'> = {}) =>
    log.push({ processor: id, hook, ...extra });

  return {
    id,
    name: id,
    processInput: ({ messages }) => {
      record('processInput');
      return messages;
    },
    processInputStep: ({ stepNumber }) => {
      record('processInputStep', { stepNumber });
      return undefined;
    },
  };
}

function createOutputProbe(id: string, log: Entry[]): OutputProcessor {
  const record = (hook: Hook, extra: Omit<Entry, 'processor' | 'hook'> = {}) =>
    log.push({ processor: id, hook, ...extra });

  return {
    id,
    name: id,
    processOutputStream: async ({ part }) => {
      if (LOGGED_PART_TYPES.includes(part.type)) record('processOutputStream', { type: part.type });
      return part;
    },
    processOutputResult: ({ messages }) => {
      record('processOutputResult');
      return messages;
    },
  };
}

/** True when `sequence` is `prefix-a, prefix-b, prefix-c` repeated. */
function sameOrderRepeated(sequence: string[], prefix: string): boolean {
  return (
    sequence.length > 0 &&
    sequence.length % DECLARED.length === 0 &&
    sequence.every((entry, index) => entry === `${prefix}-${DECLARED[index % DECLARED.length]}`)
  );
}

function hookNames(entries: Entry[]): string[] {
  return entries.map(entry => `${entry.processor}:${entry.hook}${entry.type ? `:${entry.type}` : ''}`);
}

/** Hook order shared by every engine: input hooks interleaved with the tool-call/step-finish streams. */
const SHARED_HOOKS = [
  'in-a:processInput',
  'in-b:processInput',
  'in-c:processInput',
  'in-a:processInputStep',
  'in-b:processInputStep',
  'in-c:processInputStep',
  'out-a:processOutputStream:tool-call',
  'out-b:processOutputStream:tool-call',
  'out-c:processOutputStream:tool-call',
  'out-a:processOutputStream:step-finish',
  'out-b:processOutputStream:step-finish',
  'out-c:processOutputStream:step-finish',
  'in-a:processInputStep',
  'in-b:processInputStep',
  'in-c:processInputStep',
  'out-a:processOutputStream:tool-call',
  'out-b:processOutputStream:tool-call',
  'out-c:processOutputStream:tool-call',
  'out-a:processOutputStream:step-finish',
  'out-b:processOutputStream:step-finish',
  'out-c:processOutputStream:step-finish',
  'in-a:processInputStep',
  'in-b:processInputStep',
  'in-c:processInputStep',
  'out-a:processOutputStream:text-delta',
  'out-b:processOutputStream:text-delta',
  'out-c:processOutputStream:text-delta',
  'out-a:processOutputStream:text-end',
  'out-b:processOutputStream:text-end',
  'out-c:processOutputStream:text-end',
];

/** Recorded tail per engine: where the final `finish` chunk reaches the output processors. */
const FINAL_HOOKS: Record<(typeof ENGINES)[number], string[]> = {
  plain: [
    'out-a:processOutputStream:finish',
    'out-b:processOutputStream:finish',
    'out-c:processOutputStream:finish',
    'out-a:processOutputStream:step-finish',
    'out-b:processOutputStream:step-finish',
    'out-c:processOutputStream:step-finish',
    'out-a:processOutputResult',
    'out-b:processOutputResult',
    'out-c:processOutputResult',
  ],
  durable: [
    'out-a:processOutputStream:step-finish',
    'out-b:processOutputStream:step-finish',
    'out-c:processOutputStream:step-finish',
    'out-a:processOutputResult',
    'out-b:processOutputResult',
    'out-c:processOutputResult',
    'out-a:processOutputStream:finish',
    'out-b:processOutputStream:finish',
    'out-c:processOutputStream:finish',
  ],
  evented: [
    'out-a:processOutputStream:step-finish',
    'out-b:processOutputStream:step-finish',
    'out-c:processOutputStream:step-finish',
    'out-a:processOutputResult',
    'out-b:processOutputResult',
    'out-c:processOutputResult',
    'out-a:processOutputStream:finish',
    'out-b:processOutputStream:finish',
    'out-c:processOutputStream:finish',
  ],
};

async function runT46() {
  const logs = new Map<string, Entry[]>();

  const results = await expectEngineParity({
    model: script,
    buildAgent: ({ engine, model }) => {
      const log: Entry[] = [];
      logs.set(engine, log);
      return new Agent({
        id: 't46-agent',
        name: 'T46 Agent',
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
        memory: new MockMemory(),
        inputProcessors: DECLARED.map(id => createInputProbe(`in-${id}`, log)),
        outputProcessors: DECLARED.map(id => createOutputProbe(`out-${id}`, log)),
      });
    },
    run: async handle => {
      const options: EngineTurnOptions = {
        maxSteps: MAX_STEPS,
        runId: `t46-run-${handle.engine}`,
        memory: { thread: THREAD, resource: RESOURCE },
      };
      await handle.turn('go', options);
    },
  });

  return { results, logs };
}

describe('T46 processor order parity', () => {
  it('honours the declared processor order per hook, per step and per chunk on every engine', async () => {
    const { results, logs } = await runT46();

    const contracts = new Map<string, Record<string, unknown>>();

    for (const engine of ENGINES) {
      const log = logs.get(engine);
      expect(log, `${engine}: processor probe recorded no hooks`).toBeDefined();
      const entries = log!;
      const observation = results[engine]!;
      const snapshot = observation.turns[0];
      expect(snapshot, `${engine}: no turn recorded`).toBeDefined();

      const by = (hook: Hook) => entries.filter(entry => entry.hook === hook);
      const order = (hook: Hook) => by(hook).map(entry => entry.processor);
      const modelCalls = observation.requests.length;

      // check('run finished', …)
      expect(chunksOfType(snapshot!, 'finish'), `${engine}: finish chunks`).toBe(1);
      for (const type of ['error', 'abort', 'tripwire']) {
        expect(chunksOfType(snapshot!, type), `${engine}: ${type} chunks`).toBe(0);
      }

      // check('processInput: declared order, once each', …)
      expect(order('processInput'), `${engine}: processInput order`).toEqual(['in-a', 'in-b', 'in-c']);

      // check('processInputStep: declared order once per model step', …)
      const inputStepOrder = order('processInputStep');
      expect(inputStepOrder, `${engine}: processInputStep length`).toHaveLength(DECLARED.length * modelCalls);
      expect(sameOrderRepeated(inputStepOrder, 'in'), `${engine}: processInputStep order`).toBe(true);

      // check('processOutputResult: declared order, once each', …)
      expect(order('processOutputResult'), `${engine}: processOutputResult order`).toEqual(['out-a', 'out-b', 'out-c']);

      // check('processOutputStream: declared order per text chunk', …)
      const deltas = entries
        .filter(entry => entry.hook === 'processOutputStream' && entry.type === 'text-delta')
        .map(entry => entry.processor);
      expect(sameOrderRepeated(deltas, 'out'), `${engine}: processOutputStream text-delta order`).toBe(true);

      // check('modelFree' contract field: three model calls, one per step plus the answer)
      expect(modelCalls, `${engine}: model calls`).toBe(3);

      const stepNumbers = by('processInputStep')
        .filter(entry => entry.processor === 'in-a')
        .map(entry => entry.stepNumber);
      expect(stepNumbers, `${engine}: in-a stepNumbers`).toEqual([0, 1, 2]);

      // Recorded harness contract fields (paired across engines by the harness's `pair()`).
      contracts.set(engine, {
        processInput: order('processInput'),
        processInputStepCount: inputStepOrder.length,
        stepNumbers,
        modelCalls,
        processOutputResult: order('processOutputResult'),
        streamChunkTypesSeen: [
          ...new Set(entries.filter(entry => entry.hook === 'processOutputStream').map(entry => entry.type!)),
        ].sort(),
        streamOrderHonoured: sameOrderRepeated(deltas, 'out'),
      });

      // The full recorded hook sequence, pinned per engine: every engine agrees on the first 30
      // entries, and the final `finish` reaches the output processors before `step-finish` /
      // `processOutputResult` on plain but after them on durable and evented. The harness records this
      // array without pairing it (see the file header), so the tail is pinned per engine here.
      expect(hookNames(entries), `${engine}: hook sequence`).toEqual([...SHARED_HOOKS, ...FINAL_HOOKS[engine]]);
    }

    // Plain pinned literally — the recorded harness `plain-none-post` cell
    // (`results/2026-09-25T16-41-48.422Z/plain-none-post/verdict.json`).
    expect(contracts.get('plain')).toEqual({
      processInput: ['in-a', 'in-b', 'in-c'],
      processInputStepCount: 9,
      stepNumbers: [0, 1, 2],
      modelCalls: 3,
      processOutputResult: ['out-a', 'out-b', 'out-c'],
      streamChunkTypesSeen: ['finish', 'step-finish', 'text-delta', 'text-end', 'tool-call'],
      streamOrderHonoured: true,
    });

    for (const engine of ['durable', 'evented'] as const) {
      expect(contracts.get(engine), `${engine}: contract`).toEqual(contracts.get('plain'));
    }
  });
});

/**
 * Ported from validation harness case T45 (output-processors).
 *
 * One probe processor is installed as `outputProcessors` and the script model records what happened
 * to the stream and to memory. Model-free: `stepScript(1)` — one `step` tool call then
 * `finished 1 steps` — with `maxSteps: 3`.
 *
 * Ported variants: `mutate`, `tripwire` and `data`. `data` was green first try; `tripwire` needed the
 * harness's own `steps` counter (the `step` tool's commit log, not the parity snapshot's
 * `toolResults`); `mutate` needs the COR-1414 declaration below.
 *
 * Not ported, escalated rather than weakened:
 *
 * - `throws` (fail CLOSED per #25826 / COR-1315): a throwing output processor makes the run surface an
 *   error, so the turn cannot be recorded by the parity helper at all — the same wall as T36's error
 *   variant and T44's `throws`.
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

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import type { OutputProcessor } from '../../../processors';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
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

function createOutputProbe(id: string, mode: Mode, handles: ProbeHandles): OutputProcessor {
  const record = (hook: string, extra: Omit<HookRecord, 'hook'> = {}) => handles.log.push({ hook, ...extra });
  const act = (hook: string, abort: (reason?: string) => never) => {
    if (mode === 'tripwire') abort(`${id} tripwire at ${hook}`);
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
});

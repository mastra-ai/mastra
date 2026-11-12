import type { LLMock } from '@copilotkit/aimock';
import { z } from 'zod';

import type { ReaderName } from './types';
import { READERS } from './types';

/**
 * A scripted turn. The same scenario runs on every engine, backend and
 * topology; the model is served by AIMock, so every engine is given the same
 * model output. Scenarios are matched by the marker in their prompt.
 */
export interface Scenario {
  name: string;
  prompt: string;
  /** Registers this scenario's model responses. */
  script: (llm: LLMock) => void;
  /** Extra `stream()` options, built in the publishing process. */
  streamOptions?: () => Record<string, unknown>;
  /** Prompts for a scenario that runs more than one turn, by variant name. */
  variants?: Record<string, string>;
  /** How the turn is driven and captured (`grid.ts`); `turn` when unset. */
  flow?: Flow;
  /** What the scenario captures; every stream reader in `READERS` when unset. */
  readers?: readonly ReaderName[];
  /**
   * Run this scenario on its own processes with these stream cleanup
   * timeouts (ms): `cleanupMs` for the publisher, `readerCleanupMs` for the
   * reader process (in the single topology the one process takes
   * `readerCleanupMs ?? cleanupMs`).
   */
  nodes?: { cleanupMs?: number; readerCleanupMs?: number };
  /** The text is cut wherever an abort lands, so only text frame types are compared. */
  ignoreText?: boolean;
}

/**
 * - `turn`: one turn, every reader.
 * - `approval`: the turn suspends on a tool approval and is resumed with `approveToolCall()`.
 * - `reuse`: a second turn with the first turn's run ID, right after it.
 * - `observer-cleanup`: an observer in the reader process leaves early; another attaches later in the same run.
 * - `abort`: the reader aborts the run through the server's abort route mid-stream.
 * - `generate-abort`: as `abort`, for a run started with `generate()`.
 * - `key-cleanup`: one turn, then the run's keys are listed once its cleanup has passed.
 */
export type Flow = 'turn' | 'approval' | 'reuse' | 'observer-cleanup' | 'abort' | 'generate-abort' | 'key-cleanup';

export const readersOf = (scenario: Scenario): readonly ReaderName[] => scenario.readers ?? READERS;

const marker = (name: string) => `[scenario:${name}]`;
const hasMarker = (name: string) => (req: any) => JSON.stringify(req.messages).includes(marker(name));
const afterTool = (name: string) => (req: any) =>
  hasMarker(name)(req) && (req.messages ?? []).some((m: any) => m.role === 'tool');
const beforeTool = (name: string) => (req: any) =>
  hasMarker(name)(req) && !(req.messages ?? []).some((m: any) => m.role === 'tool');

/**
 * Every model reply waits 500ms before its first chunk, so the mid-run
 * observer is attached before the model says anything, whatever the backend's
 * speed. The model output itself is identical for every engine.
 */
const SLOW = { chunkSize: 4, streamingProfile: { ttft: 500, tps: 40 } };
/** Several seconds of text, for scenarios that act while the model is still talking. */
const CRAWL = { chunkSize: 4, streamingProfile: { ttft: 500, tps: 5 } };
const LONG_ANSWER = 'This answer streams slowly on purpose, so that something can happen to the run before it ends.';

/** The model calls `tool`, then answers `answer` once it has the tool result. */
function toolTurn(name: string, tool: string, answer: string, args = '{}'): Scenario['script'] {
  return llm => {
    llm.on({ endpoint: 'chat', predicate: afterTool(name) }, { content: answer }, SLOW);
    llm.on(
      { endpoint: 'chat', predicate: beforeTool(name) },
      { toolCalls: [{ id: `call-${name}`, name: tool, arguments: args }] },
      SLOW,
    );
  };
}

export const SCENARIOS: Record<string, Scenario> = {
  'structured-output': {
    name: 'structured-output',
    prompt: `${marker('structured-output')} Answer as JSON.`,
    script: llm =>
      llm.on(
        { endpoint: 'chat', predicate: hasMarker('structured-output') },
        { content: '{"answer":"forty-two"}' },
        SLOW,
      ),
    streamOptions: () => ({ structuredOutput: { schema: z.object({ answer: z.string() }) } }),
  },
  /** The model's JSON fails the schema, so the turn ends with an error chunk. */
  'structured-invalid': {
    name: 'structured-invalid',
    prompt: `${marker('structured-invalid')} Answer as JSON.`,
    script: llm =>
      llm.on({ endpoint: 'chat', predicate: hasMarker('structured-invalid') }, { content: '{"answer":42}' }, SLOW),
    streamOptions: () => ({ structuredOutput: { schema: z.object({ answer: z.string() }) } }),
  },
  'tool-throws': {
    name: 'tool-throws',
    prompt: `${marker('tool-throws')} Call boom.`,
    script: toolTurn('tool-throws', 'boom', 'The tool failed.'),
  },
  'tool-undefined': {
    name: 'tool-undefined',
    prompt: `${marker('tool-undefined')} Call nothing.`,
    script: toolTurn('tool-undefined', 'nothing', 'The tool returned nothing.'),
  },
  /** The fixture's input processor aborts any prompt containing TRIPWIRE. */
  'input-tripwire': {
    name: 'input-tripwire',
    prompt: `${marker('input-tripwire')} TRIPWIRE`,
    script: llm =>
      llm.on({ endpoint: 'chat', predicate: hasMarker('input-tripwire') }, { content: 'The tripwire did not fire.' }),
  },
  /** `lookup` needs approval: the turn suspends, then `approveToolCall()` resumes it. */
  'tool-approval': {
    name: 'tool-approval',
    prompt: `${marker('tool-approval')} Look up harness.`,
    script: toolTurn('tool-approval', 'lookup', 'The lookup found it.', '{"query":"harness"}'),
    flow: 'approval',
    readers: [...READERS, 'live-resume'],
  },
  /** The second turn reuses the first turn's run ID while the first run is still inside its cleanup window. */
  'run-id-reuse': {
    name: 'run-id-reuse',
    prompt: `${marker('reuse-first')} First.`,
    variants: { first: `${marker('reuse-first')} First.`, second: `${marker('reuse-second')} Second.` },
    script: llm => {
      llm.on({ endpoint: 'chat', predicate: hasMarker('reuse-first') }, { content: 'First answer.' }, SLOW);
      llm.on({ endpoint: 'chat', predicate: hasMarker('reuse-second') }, { content: 'Second answer.' }, SLOW);
    },
    flow: 'reuse',
    readers: ['live', 'observe-mid', 'topic', 'observe-0', 'http-observe', 'thread'],
  },
  /**
   * The reader process has a 1s cleanup and observes the whole run; the
   * publisher (default cleanup) replays it 2.5s after it ends.
   */
  'observer-cleanup': {
    name: 'observer-cleanup',
    prompt: `${marker('observer-cleanup')} Talk slowly.`,
    script: llm =>
      llm.on({ endpoint: 'chat', predicate: hasMarker('observer-cleanup') }, { content: 'Watched.' }, SLOW),
    flow: 'observer-cleanup',
    readers: ['live', 'observe-mid', 'observe-0', 'topic'],
    nodes: { readerCleanupMs: 1_000 },
  },
  abort: {
    name: 'abort',
    prompt: `${marker('abort')} Talk slowly.`,
    script: llm => llm.on({ endpoint: 'chat', predicate: hasMarker('abort') }, { content: LONG_ANSWER }, CRAWL),
    flow: 'abort',
    readers: [...READERS, 'ack'],
    ignoreText: true,
  },
  'generate-abort': {
    name: 'generate-abort',
    prompt: `${marker('generate-abort')} Talk slowly.`,
    script: llm =>
      // Plain generate() makes a non-streaming request, which AIMock otherwise
      // answers instantly; durable generate() streams.
      llm.on(
        { endpoint: 'chat', predicate: hasMarker('generate-abort') },
        { content: LONG_ANSWER },
        { ...CRAWL, nonStreamingTiming: true, nonStreamingTimingAllProviders: true },
      ),
    flow: 'generate-abort',
    readers: ['ack', 'generate'],
  },
  /** Both processes clean a finished run up after 2s; keys are listed 4s after the turn. */
  'key-cleanup': {
    name: 'key-cleanup',
    prompt: `${marker('key-cleanup')} Say done.`,
    script: llm => llm.on({ endpoint: 'chat', predicate: hasMarker('key-cleanup') }, { content: 'Done.' }),
    flow: 'key-cleanup',
    readers: ['live', 'keys'],
    nodes: { cleanupMs: 2_000, readerCleanupMs: 2_000 },
  },
};

/** The full answer of the abort scenarios, to tell a cut answer from a whole one. */
export const ABORT_ANSWER = LONG_ANSWER;

/**
 * Scenarios by grid file. Each group runs in its own test file
 * (`grid.<group>.test.ts`) over the full layout × engine grid.
 */
export const SCENARIO_GROUPS = {
  chunks: ['structured-output', 'structured-invalid', 'tool-throws', 'tool-undefined', 'input-tripwire'],
  lifecycle: ['tool-approval', 'run-id-reuse', 'observer-cleanup', 'abort', 'generate-abort', 'key-cleanup'],
} as const satisfies Record<string, readonly string[]>;
export type ScenarioGroup = keyof typeof SCENARIO_GROUPS;
export const SCENARIO_NAMES: string[] = Object.values(SCENARIO_GROUPS).flat();

export function getScenario(name: string): Scenario {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`unknown stream-harness scenario: ${name}`);
  return scenario;
}

import type { LLMock } from '@copilotkit/aimock';
import { z } from 'zod';

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
}

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

/** The model calls `tool`, then answers `answer` once it has the tool result. */
function toolTurn(name: string, tool: string, answer: string): Scenario['script'] {
  return llm => {
    llm.on({ endpoint: 'chat', predicate: afterTool(name) }, { content: answer }, SLOW);
    llm.on(
      { endpoint: 'chat', predicate: beforeTool(name) },
      { toolCalls: [{ id: `call-${name}`, name: tool, arguments: '{}' }] },
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
};

/**
 * Scenarios by grid file. Each group runs in its own test file
 * (`grid.<group>.test.ts`) over the full layout × engine grid.
 */
export const SCENARIO_GROUPS = {
  chunks: ['structured-output', 'structured-invalid', 'tool-throws', 'tool-undefined', 'input-tripwire'],
} as const satisfies Record<string, readonly string[]>;
export type ScenarioGroup = keyof typeof SCENARIO_GROUPS;
export const SCENARIO_NAMES: string[] = Object.values(SCENARIO_GROUPS).flat();

export function getScenario(name: string): Scenario {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`unknown stream-harness scenario: ${name}`);
  return scenario;
}

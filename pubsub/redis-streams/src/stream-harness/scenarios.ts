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

export const SCENARIOS: Record<string, Scenario> = {
  'structured-output': {
    name: 'structured-output',
    prompt: `${marker('structured-output')} Answer as JSON.`,
    script: llm =>
      llm.on({ endpoint: 'chat', predicate: hasMarker('structured-output') }, { content: '{"answer":"forty-two"}' }),
    streamOptions: () => ({ structuredOutput: { schema: z.object({ answer: z.string() }) } }),
  },
};

export function getScenario(name: string): Scenario {
  const scenario = SCENARIOS[name];
  if (!scenario) throw new Error(`unknown stream-harness scenario: ${name}`);
  return scenario;
}

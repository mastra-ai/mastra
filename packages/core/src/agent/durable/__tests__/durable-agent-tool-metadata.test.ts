/**
 * Ported from validation harness case T34 (tool-metadata).
 *
 * The tool `echo` returns `{ n, secret: 'raw' }`. The ported variant is
 * `transform`: a tool-level `transform.transcript.output` rewrites the
 * transcript copy while the public tool result stays raw. Which copy (persisted
 * transcript / model prompt) carries the rewrite is recorded by the harness and
 * compared across engines, but not promised, so only the raw public result is
 * asserted.
 *
 * Held variants, pending a difference ticket (not asserted here):
 *
 *   provider-metadata  `providerMetadata` on the model's tool-call part must
 *                      reach the tool-call chunk unchanged. The tool-call chunk
 *                      itself matches on all engines; the pair diverges on the
 *                      tool-result chunk, whose payload keeps
 *                      `providerMetadata: { cor1252: { tag: 't34' } }` on plain
 *                      and drops the key on durable/evented.
 *   to-model-output    a `toModelOutput` mapper rewrites only the copy the model
 *                      sees; the public result stays raw. Same divergence: the
 *                      tool-result chunk keeps
 *                      `providerMetadata: { mastra: { modelOutput: ... } }` on
 *                      plain and drops it on durable/evented.
 *
 * Harness exclusions, not asserted here:
 *   - the agent-level transform policy (PR-only in the harness; it only records
 *     an observation and never asserts it).
 *   - the `display` target (Studio; covered by the harness S-cases).
 *
 * `expectEngineParity` provides the harness's engine comparison; the harness's
 * own "run settled" check (two model calls, one finish, no error) is asserted
 * per engine.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import {
  type CapturedRequest,
  type EngineParityResults,
  type EngineRunResult,
  type ModelTape,
  type ParityEngine,
  chunksOfType,
  expectEngineParity,
  textOnlyTape,
} from './parity-harness';

const ENGINES: readonly ParityEngine[] = ['plain', 'durable', 'evented'];
const THREAD = 'thread-t34';
const RESOURCE = 'resource-t34';
const TURN_OPTIONS = {
  maxSteps: 3,
  memory: { thread: THREAD, resource: RESOURCE },
} as const;

function toolResultCount(request: CapturedRequest): number {
  return request.prompt
    .filter(message => message.role === 'tool')
    .flatMap(message => (Array.isArray(message.content) ? message.content : []))
    .filter(part => part.type === 'tool-result').length;
}

const TOOL_CALL_TAPE: ModelTape = [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id: 'parity-id-tool', modelId: 'parity-model', timestamp: new Date(0) },
  {
    type: 'tool-call',
    toolCallId: 'parity-call-1',
    toolName: 'echo',
    input: JSON.stringify({ n: 1 }),
    providerExecuted: false,
  },
  { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
];

const echoTool = createTool({
  id: 'echo',
  description: 'T34 echo',
  inputSchema: z.object({ n: z.number() }),
  execute: async (input: { n: number }) => ({ n: input?.n ?? 1, secret: 'raw' as const }),
  transform: {
    transcript: {
      output: context => {
        const { n } = context.output as { n: number };
        return { n, secret: 'transcript-redacted' };
      },
    },
  },
});

/** The observation for one engine, which `expectEngineParity` always records. */
function observationOf(results: EngineParityResults, engine: ParityEngine): EngineRunResult {
  const observation = results[engine];
  if (!observation) throw new Error(`no observation recorded for engine '${engine}'`);
  return observation;
}

function runT34() {
  return expectEngineParity({
    engines: ENGINES,
    model: {
      respond: request => (toolResultCount(request) === 0 ? TOOL_CALL_TAPE : textOnlyTape('done')),
    },
    buildAgent: ({ model }) =>
      new Agent({
        id: 't34-agent-transform',
        name: 'T34 Agent',
        instructions: 'Follow the script.',
        model,
        memory: new MockMemory(),
        tools: { echo: echoTool },
      }),
    run: async handle => {
      const turn = await handle.turn('Go.', TURN_OPTIONS);

      // Harness "run settled" check: two model calls, one finish, no error.
      expect(chunksOfType(turn, 'finish')).toBe(1);
      expect(chunksOfType(turn, 'error')).toBe(0);
      expect(chunksOfType(turn, 'tool-call')).toBe(1);
    },
  });
}

describe('T34 tool metadata (plain, durable, evented)', () => {
  it('rewrites only the transcript copy with a tool-level transform, keeping the public result raw', async () => {
    const results = await runT34();

    for (const engine of ENGINES) {
      const observation = observationOf(results, engine);
      const turn = observation.turns[0]!;
      expect(observation.requests).toHaveLength(2);
      expect(turn.toolResults[0]?.result).toMatchObject({ secret: 'raw' });
    }
  });
});

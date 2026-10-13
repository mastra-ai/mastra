/**
 * Ported from validation harness case T29 (text-only-multistep).
 *
 * A text-only reply must finish in one model call and persist cleanly, and a
 * second turn on the same thread must stream the same chunk shape and send
 * the full history to the model — identically on plain, durable and evented
 * agents. This file is the reference example for porting harness cases onto
 * `expectEngineParity`. The harness's engine comparison (chunk sequence, finish
 * payload, usage, getFullOutput) is covered by the helper itself.
 */
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import type { EngineParityResults, EngineParityScenario, ParityEngine, ParitySnapshot } from './parity-harness';
import { chunksOfType, expectEngineParity, lastUserText, textOnlyTape } from './parity-harness';

const THREAD = 'thread-t29';
const RESOURCE = 'resource-t29';
const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const TURN_OPTIONS = { maxSteps: 2, memory: { thread: THREAD, resource: RESOURCE } };

/**
 * Literal contract for the plain engine, which the helper treats as the
 * reference. Pinning it here stops a plain-side change from silently moving
 * that reference and keeping the engines "in parity".
 */
const PLAIN_FINISH_KEYS = [
  'messageId',
  'messages',
  'metadata',
  'output',
  'processorRetryCount',
  'response',
  'stepResult',
];
const PLAIN_FULL_OUTPUT_KEYS = [
  'error',
  'files',
  'finishReason',
  'messages',
  'object',
  'providerMetadata',
  'reasoning',
  'reasoningText',
  'rememberedMessages',
  'request',
  'response',
  'resumeSchema',
  'runId',
  'sources',
  'spanId',
  'steps',
  'suspendPayload',
  'text',
  'toolCalls',
  'toolResults',
  'totalUsage',
  'traceId',
  'tripwire',
  'usage',
  'usedFallbackValue',
  'warnings',
];
const PLAIN_USAGE = {
  inputTokens: 10,
  outputTokens: 20,
  totalTokens: 30,
  raw: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
};

/** Runs the T29 scenario; returns each engine's results and persisted message roles. */
async function runT29(run: EngineParityScenario['run']) {
  const memories = new Map<ParityEngine, MockMemory>();
  const results = await expectEngineParity({
    model: { respond: request => textOnlyTape(`answer to: ${lastUserText(request)}`) },
    buildAgent: ({ engine, model }) => {
      const memory = new MockMemory();
      memories.set(engine, memory);
      return new Agent({ id: 't29-agent', name: 'T29 Agent', instructions: 'Answer briefly.', model, memory });
    },
    run,
  });
  const persistedRoles = async (engine: ParityEngine) => {
    const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
    return messages.map(m => m.role);
  };
  return { results, persistedRoles };
}

/** Checks the harness applies to turn 1 in both variants. */
function expectTurnOneAnswered(turn: ParitySnapshot | undefined) {
  expect(chunksOfType(turn!, 'finish')).toBe(1);
  expect(turn!.streamedText).toBe('answer to: First question');
  expect(turn!.fullOutput.text).toBe(turn!.streamedText);
}

/** Pins the plain reference to its literal contract so it cannot drift unnoticed. */
function expectPlainReference(results: EngineParityResults) {
  for (const turn of results.plain!.turns) {
    expect(turn.finishChunk.payloadKeys).toEqual(PLAIN_FINISH_KEYS);
    expect(turn.fullOutput.keys).toEqual(PLAIN_FULL_OUTPUT_KEYS);
    expect(turn.usage).toEqual(PLAIN_USAGE);
  }
}

describe('T29 text-only multistep (plain, durable, evented)', () => {
  it('single turn: one finish, one model call, persisted user+assistant', async () => {
    const { results, persistedRoles } = await runT29(async handle => {
      await handle.turn('First question', TURN_OPTIONS);
    });

    expectPlainReference(results);

    for (const engine of ENGINES) {
      const { turns, requests } = results[engine]!;
      expectTurnOneAnswered(turns[0]);
      expect(requests).toHaveLength(1);
      expect(await persistedRoles(engine)).toEqual(['user', 'assistant']);
    }
  });

  it('multi turn: second turn mirrors the first and sends the full history', async () => {
    const { results, persistedRoles } = await runT29(async handle => {
      await handle.turn('First question', TURN_OPTIONS);
      await handle.turn('Second question', TURN_OPTIONS);
    });

    expectPlainReference(results);

    for (const engine of ENGINES) {
      const { turns, requests } = results[engine]!;
      expectTurnOneAnswered(turns[0]);
      expect(turns.map(t => t.streamedText)).toEqual(['answer to: First question', 'answer to: Second question']);
      expect(turns[1]!.chunks).toEqual(turns[0]!.chunks);
      expect(requests).toHaveLength(2);
      expect(requests[1]!.prompt.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
      expect(await persistedRoles(engine)).toEqual(['user', 'assistant', 'user', 'assistant']);
    }
  });
});

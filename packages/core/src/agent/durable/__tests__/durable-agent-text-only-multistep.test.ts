/**
 * Ported from validation harness case T29 (text-only-multistep).
 *
 * A text-only reply must finish in one model call and persist cleanly, and a
 * second turn on the same thread must stream the same chunk shape and send
 * the full history to the model — identically on plain, durable and evented
 * agents. This file is the reference example for porting harness cases onto
 * `expectEngineParity`.
 */
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import type { EngineParityScenario, ParityEngine } from './parity-harness';
import { expectEngineParity, lastUserText, textOnlyTape } from './parity-harness';

const THREAD = 'thread-t29';
const RESOURCE = 'resource-t29';
const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const TURN_OPTIONS = { maxSteps: 2, memory: { thread: THREAD, resource: RESOURCE } };

const memories = new Map<ParityEngine, MockMemory>();

const scenario = (run: EngineParityScenario['run']): EngineParityScenario => ({
  model: { respond: request => textOnlyTape(`answer to: ${lastUserText(request)}`) },
  buildAgent: ({ engine, model }) => {
    const memory = new MockMemory();
    memories.set(engine, memory);
    return new Agent({ id: 't29-agent', name: 'T29 Agent', instructions: 'Answer briefly.', model, memory });
  },
  run,
});

async function persistedRoles(engine: ParityEngine): Promise<string[]> {
  const { messages } = await memories.get(engine)!.recall({ threadId: THREAD, resourceId: RESOURCE });
  return messages.map(m => m.role);
}

describe('T29 text-only multistep (plain, durable, evented)', () => {
  it('single turn: one finish, one model call, persisted user+assistant', async () => {
    const results = await expectEngineParity(
      scenario(async handle => {
        await handle.turn('First question', TURN_OPTIONS);
      }),
    );

    for (const engine of ENGINES) {
      const { turns, requests } = results[engine]!;
      const [turn] = turns;
      expect(turn!.chunks.filter(c => c.endsWith(':finish'))).toHaveLength(1);
      expect(turn!.text).toBe('answer to: First question');
      expect(turn!.streamedText).toBe(turn!.text);
      expect(requests).toHaveLength(1);
      expect(await persistedRoles(engine)).toEqual(['user', 'assistant']);
    }
  });

  it('multi turn: second turn mirrors the first and sends the full history', async () => {
    const results = await expectEngineParity(
      scenario(async handle => {
        await handle.turn('First question', TURN_OPTIONS);
        await handle.turn('Second question', TURN_OPTIONS);
      }),
    );

    for (const engine of ENGINES) {
      const { turns, requests } = results[engine]!;
      expect(turns.map(t => t.text)).toEqual(['answer to: First question', 'answer to: Second question']);
      expect(turns[1]!.chunks).toEqual(turns[0]!.chunks);
      expect(requests).toHaveLength(2);
      expect(requests[1]!.prompt.map(m => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
      expect(await persistedRoles(engine)).toEqual(['user', 'assistant', 'user', 'assistant']);
    }
  });
});

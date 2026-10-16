import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { createActionAgent, requestMessages, runScenario, useActionAimock } from '../test-utils/aimock';

const userTexts = (messages: Array<Record<string, any>>) =>
  messages.filter(m => m.role === 'user').map(m => (typeof m.content === 'string' ? m.content : m.content?.[0]?.text));

describe('action-native memory (aimock)', () => {
  const getMock = useActionAimock();

  it('recalls only the last N runs when lastMessages is set', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const { agent, memory } = createActionAgent(llm, { memory: new MockMemory({ options: { lastMessages: 2 } }) });

    for (const text of ['one', 'two', 'three', 'four']) {
      await runScenario(agent, memory, text, { thread: 't-window' });
    }

    expect(userTexts(requestMessages(llm, 3))).toEqual(['two', 'three', 'four']);
  });

  it('keeps threads isolated from each other', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'ok' });
    const { agent, memory } = createActionAgent(llm);

    await runScenario(agent, memory, 'secret A', { thread: 't-a' });
    await runScenario(agent, memory, 'secret B', { thread: 't-b' });
    await runScenario(agent, memory, 'back to A', { thread: 't-a' });

    expect(userTexts(requestMessages(llm, 2))).toEqual(['secret A', 'back to A']);
  });

  it('persists each finished turn before the next turn runs', async () => {
    const llm = getMock();
    const seenDuringTool: string[][] = [];
    const { agent, memory } = createActionAgent(llm, {
      tools: {
        probe: createTool({
          id: 'probe',
          description: 'Probe',
          inputSchema: z.object({}),
          execute: async () => {
            const stored = await memory.listActions({ threadId: 't-turns' });
            seenDuringTool.push(stored.map(a => a.type));
            return { ok: true };
          },
        }),
      },
    });
    llm.on({ endpoint: 'chat', sequenceIndex: 0 }, { toolCalls: [{ id: 'p1', name: 'probe', arguments: {} }] });
    llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { toolCalls: [{ id: 'p2', name: 'probe', arguments: {} }] });
    llm.on({ endpoint: 'chat', sequenceIndex: 2 }, { content: 'probed' });

    await runScenario(agent, memory, 'probe twice', { thread: 't-turns' });

    // A tool runs only once the run's input, its call and its tool-started are stored.
    expect(seenDuringTool[0]).toEqual(['run-start', 'text', 'turn-start', 'tool-call', 'tool-started']);
    // By turn 2, all of turn 1 is stored too.
    expect(seenDuringTool[1]).toEqual([
      'run-start',
      'text',
      'turn-start',
      'tool-call',
      'tool-started',
      'tool-result',
      'turn-end',
      'turn-start',
      'tool-call',
      'tool-started',
    ]);
  });
});

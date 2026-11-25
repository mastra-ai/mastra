import { describe, expect, it } from 'vitest';

import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { createTextStreamModel } from './signals-test-utils';

describe('Agent state signals with recalled history (#28565)', () => {
  it('Given a state signal on the first step of a later turn, When the turn finishes, Then the earlier reply is not treated as this turn’s response', async () => {
    const memory = new MockMemory();
    const threadId = 'state-history-thread';
    const resourceId = 'state-history-user';
    await memory.createThread({ threadId, resourceId });

    let stateVersion = 0;
    const stateProcessor = {
      id: 'turn-state',
      computeStateSignal: () => {
        stateVersion += 1;
        return { cacheKey: `turn-state:${stateVersion}`, contents: `state ${stateVersion}` };
      },
    };
    const responseIdsSeen: string[][] = [];
    const responseRecorder = {
      id: 'response-recorder',
      processOutputResult: ({ messages, messageList }: { messages: any[]; messageList?: any }) => {
        responseIdsSeen.push(messageList!.get.response.db().map((message: { id: string }) => message.id));
        return messages;
      },
    };

    const firstAgent = new Agent({
      id: 'state-history-agent',
      name: 'State History Agent',
      instructions: 'Test',
      model: createTextStreamModel('first reply'),
      memory,
      inputProcessors: [stateProcessor],
      outputProcessors: [responseRecorder],
    });
    await (
      await firstAgent.stream('first question', { memory: { thread: threadId, resource: resourceId } })
    ).consumeStream();

    const firstTurn = await memory.recall({ threadId, resourceId });
    const firstReply = firstTurn.messages.find(message => message.role === 'assistant');
    expect(firstReply).toBeDefined();

    const secondAgent = new Agent({
      id: 'state-history-agent',
      name: 'State History Agent',
      instructions: 'Test',
      model: createTextStreamModel('second reply'),
      memory,
      inputProcessors: [stateProcessor],
      outputProcessors: [responseRecorder],
    });
    await (
      await secondAgent.stream('second question', { memory: { thread: threadId, resource: resourceId } })
    ).consumeStream();

    expect(responseIdsSeen).toHaveLength(2);
    const stored = await memory.recall({ threadId, resourceId });
    const secondReply = stored.messages.filter(message => message.role === 'assistant').at(-1);
    expect(secondReply?.id).not.toBe(firstReply!.id);
    expect(responseIdsSeen[1]).toEqual([secondReply!.id]);

    const storedFirstReply = stored.messages.find(message => message.id === firstReply!.id);
    expect(storedFirstReply?.content.metadata?.mastra).not.toMatchObject({ responseBoundary: true });
    expect(stored.messages.filter(message => message.role === 'assistant').map(message => message.id)).toHaveLength(2);
  });
});

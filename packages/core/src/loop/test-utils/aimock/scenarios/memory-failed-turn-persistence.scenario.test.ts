import { it, expect } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import type { Processor } from '../../../../processors';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A turn that fails must leave the same history behind on every engine. Users reload the thread
 * after an error: if the in-process loop drops what the durable engines keep, the reply they
 * watched stream in vanishes, or the whole turn (their own message included) disappears. (#27427)
 */

const resourceId = 'failed-turn-user';
const PARTIAL_REPLY = 'Your balance is $1,204.50 as of this morning and your next';
const midStreamDrop = { chunkSize: 5, latency: 20, disconnectAfterMs: 150 };

async function savedMessages(memory: MockMemory, threadId: string) {
  const { messages } = await memory.recall({ threadId, resourceId });
  return messages.map(message => ({
    role: message.role,
    parts: message.content.parts.map(part => part.type),
    text: message.content.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join(''),
  }));
}

describeForAllEngines('AIMock loop scenario: failed turns are kept in memory', engine => {
  const getMock = useLoopScenarioAimock();

  // Technical: the provider socket resets after a few text deltas and no error processor retries.
  // The in-process loop only built messages from the stream's collected chunks on the success
  // path, so the terminal error was recorded on an empty assistant record and the streamed text
  // was lost. Durable/evented materialize the streamed chunks before recording the error.
  it('keeps the partial reply next to the error when the stream drops mid-reply', async () => {
    const memory = new MockMemory();
    const threadId = 'failed-turn-stream-drop';

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is my balance?',
      memory,
      threadId,
      resourceId,
      errorProcessors: [],
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: PARTIAL_REPLY }, midStreamDrop);
      },
    });

    const streamed = chunks!
      .filter(chunk => chunk.type === 'text-delta')
      .map(chunk => chunk.payload.text)
      .join('');
    // Guard: the reply really was cut off part-way through.
    expect(streamed.length).toBeGreaterThan(0);
    expect(streamed.length).toBeLessThan(PARTIAL_REPLY.length);

    const saved = await savedMessages(memory, threadId);
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({ role: 'user', text: 'What is my balance?' });
    expect(saved[1]!.role).toBe('assistant');
    expect(saved[1]!.text).toBe(streamed);
    expect(saved[1]!.parts.at(-1)).toBe('error');
  });

  // Technical: a non-TripWire error thrown by processInputStep was rethrown out of the step, so
  // the workflow failed without a finish and memory was never saved. Durable/evented record a
  // terminal error part and finish the turn.
  it('keeps the user message and the error when an input processor throws', async () => {
    const memory = new MockMemory();
    const threadId = 'failed-turn-input-processor';
    let errorSeen: unknown;
    const failingProcessor: Processor = {
      id: 'failing-input-step',
      processInputStep: async () => {
        throw new Error('context lookup failed');
      },
    };

    await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'What is my balance?',
      memory,
      threadId,
      resourceId,
      inputProcessors: [failingProcessor],
      onError: ({ error }) => {
        errorSeen = error;
      },
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: 'unreachable' });
      },
    });

    expect(getMock().getRequests()).toHaveLength(0);
    expect((errorSeen as Error | undefined)?.message).toContain('context lookup failed');

    const saved = await savedMessages(memory, threadId);
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({ role: 'user', text: 'What is my balance?' });
    expect(saved[1]).toMatchObject({ role: 'assistant', parts: ['error'] });
  });
});

import { expect, it } from 'vitest';
import type { MastraDBMessage } from '../../../../agent/message-list';
import { MockMemory } from '../../../../memory/mock';
import { describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

/**
 * A turn that ends in a provider failure is still part of the conversation. What the thread
 * stores must say what happened: the text the user already saw, followed by the error that
 * ended the turn — on one assistant message. A turn that recovers through a model retry must
 * store only the recovered answer, with no leftover error record.
 *
 * The failures are real at the HTTP layer: aimock resets the socket mid-stream
 * (`disconnectAfterMs`) or answers with an HTTP 500. Every case passes `errorProcessors: []`,
 * which replaces the default stability processors at call time, so no processor-level retry
 * starts another step before the terminal error is recorded.
 */

const PARTIAL_REPLY = 'Here is the first half of the answer before the connection';
const RECOVERED_REPLY = 'Recovered answer.';
const midStreamDrop = { chunkSize: 5, latency: 20, disconnectAfterMs: 150 };
const SERVER_ERROR = {
  error: { message: 'first attempt failed', type: 'server_error', code: 'internal_error' },
  status: 500,
} as const;

function errorPartsIn(messages: MastraDBMessage[]) {
  return messages.flatMap(message => (message.content?.parts ?? []).filter(part => part.type === 'error'));
}

describeForAllEngines('Thread persistence when a turn ends in a provider error', engine => {
  const getMock = useLoopScenarioAimock();

  // Known gap: the normal (and fs-routed) engine drops a text part that never received
  // `text-end` when the stream dies mid-part, so only the error part is stored even though the
  // user already saw the partial text. The durable and evented engines keep it. When the text part
  // is closed before the error (the unit case in agent-message-persistence.test.ts), every engine
  // stores ['text', 'error'].
  const plain = engine === 'normal' || engine === 'fs';
  (plain ? it.fails : it)('appends the error part after the partial text of the same assistant message', async () => {
    const memory = new MockMemory();

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Tell me something.',
      memory,
      threadId: 'thread-partial-error',
      resourceId: 'resource-partial-error',
      errorProcessors: [],
      modelSettings: { maxRetries: 0 },
      collectChunks: true,
      fixtures: llm => {
        llm.on({ endpoint: 'chat' }, { content: PARTIAL_REPLY }, midStreamDrop);
      },
    });

    // Guard: the attempt really streamed text before the socket reset.
    const streamed = chunks!
      .filter(c => c.type === 'text-delta')
      .map(c => c.payload.text)
      .join('');
    expect(streamed.length).toBeGreaterThan(0);
    expect(PARTIAL_REPLY.startsWith(streamed)).toBe(true);
    expect(await output.finishReason).toBe('error');

    const { messages } = await memory.recall({
      threadId: 'thread-partial-error',
      resourceId: 'resource-partial-error',
    });

    expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.content.parts.map(part => part.type)).toEqual(['text', 'error']);
    expect(messages[1]!.content.parts[0]).toMatchObject({ type: 'text', text: streamed });

    const errorParts = errorPartsIn(messages);
    expect(errorParts).toHaveLength(1);
    expect(errorParts[0]).toMatchObject({
      type: 'error',
      error: { message: expect.any(String) },
      createdAt: expect.any(Number),
    });
  });

  it('records no error part when an ordinary model retry recovers the turn', async () => {
    const memory = new MockMemory();

    const { output, requests } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Tell me something.',
      memory,
      threadId: 'thread-recovered',
      resourceId: 'resource-recovered',
      errorProcessors: [],
      modelSettings: { maxRetries: 1 },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', sequenceIndex: 0 }, SERVER_ERROR);
        llm.on({ endpoint: 'chat', sequenceIndex: 1 }, { content: RECOVERED_REPLY });
      },
    });

    expect(await output.text).toBe(RECOVERED_REPLY);
    expect(requests).toHaveLength(2);

    const { messages } = await memory.recall({ threadId: 'thread-recovered', resourceId: 'resource-recovered' });

    expect(errorPartsIn(messages)).toEqual([]);
    expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.content.parts).toEqual([expect.objectContaining({ type: 'text', text: RECOVERED_REPLY })]);
  }, 20_000);
});

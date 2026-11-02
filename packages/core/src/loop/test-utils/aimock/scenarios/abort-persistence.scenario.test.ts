/**
 * AIMock Scenario: Abort persistence
 *
 * When a reply is cut short, the text the user already saw must still be saved
 * to the thread:
 * - cancelling mid-stream persists the partial assistant text, without an error part
 * - a response processor that throws a non-TripWire AbortError after the reply
 *   streamed must not discard the streamed text (#22593)
 *
 * The runs go through `agent.stream` directly because `runLoopScenario` does not
 * forward `onAbort`/`onFinish` and drains the stream itself.
 */

import { expect, it, vi } from 'vitest';
import { MockMemory } from '../../../../memory/mock';
import {
  createSharedAgent,
  describeForAllEngines,
  isDurableEngineVariant,
  useLoopScenarioAimock,
} from '../aimock-scenario';

const REPLY = 'Here is a long answer that the user cancels before it finishes streaming.';
const slowStream = { chunkSize: 4, latency: 30 };

async function savedAssistantMessages(memory: MockMemory, threadId: string, resourceId: string) {
  const { messages } = await memory.recall({ threadId, resourceId });
  return messages.filter(message => message.role === 'assistant');
}

type SavedMessage = Awaited<ReturnType<typeof savedAssistantMessages>>[number];

function textOf(message: SavedMessage) {
  return (message.content.parts ?? []).map(part => (part.type === 'text' ? part.text : '')).join('');
}

describeForAllEngines('AIMock loop scenario: abort persistence', engine => {
  const getMock = useLoopScenarioAimock();

  it('cancelling a streaming reply saves the partial text to the thread', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: REPLY }, slowStream);
    const memory = new MockMemory();
    const { agent } = await createSharedAgent(llm, { engine, memory });
    const threadId = `thread-abort-persist-${engine}`;
    const resourceId = 'customer-abort';
    const onFinish = vi.fn();

    const controller = new AbortController();
    const result = await agent.stream('Tell me something long.', {
      memory: { thread: threadId, resource: resourceId },
      abortSignal: controller.signal,
      onFinish,
    });
    const output = isDurableEngineVariant(engine) ? result.output : result;
    let streamed = '';
    try {
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'text-delta') {
          streamed += chunk.payload.text;
          controller.abort();
        }
      }
    } catch {
      // Durable streams can reject with AbortError after the abort chunk.
    }

    // Guard: the abort really landed mid-reply.
    expect(streamed.length).toBeGreaterThan(0);
    expect(streamed.length).toBeLessThan(REPLY.length);

    await vi.waitFor(async () => {
      const [assistant] = await savedAssistantMessages(memory, threadId, resourceId);
      expect(assistant, 'partial assistant message was not persisted after abort').toBeDefined();
      const savedText = textOf(assistant!);
      expect(savedText).toContain(streamed);
      expect(savedText.length).toBeLessThan(REPLY.length);
      expect(assistant!.content.parts?.some(part => part.type === 'error')).toBe(false);
    });
    expect(onFinish).not.toHaveBeenCalled();
    result.cleanup?.();
  });

  it('a response processor that throws AbortError after streaming keeps the streamed text (#22593)', async () => {
    const llm = getMock();
    llm.on({ endpoint: 'chat' }, { content: 'Hello' });
    const memory = new MockMemory();
    // A non-TripWire AbortError from processLLMResponse is rethrown into the
    // step's outer catch, which must still persist the already-streamed text.
    const processLLMResponse = vi.fn(async () => {
      const error = new Error('Aborted by processor');
      error.name = 'AbortError';
      throw error;
    });
    const abortingProcessor = {
      id: 'abort-on-response',
      name: 'abort-on-response',
      processLLMResponse,
    };
    const { agent } = await createSharedAgent(llm, {
      engine,
      memory,
      inputProcessors: [abortingProcessor as any],
    });
    const threadId = `thread-processor-abort-${engine}`;
    const resourceId = 'customer-abort';

    const result = await agent.stream('Go', { memory: { thread: threadId, resource: resourceId } });
    const output = isDurableEngineVariant(engine) ? result.output : result;
    let streamed = '';
    let streamError: unknown;
    try {
      for await (const chunk of output.fullStream) {
        if (chunk.type === 'text-delta') streamed += chunk.payload.text;
      }
    } catch (error) {
      streamError = error;
    }

    // Guard: the reply streamed and the processor ran (and threw) afterwards.
    expect(streamed).toBe('Hello');
    expect(processLLMResponse).toHaveBeenCalled();
    if (streamError) expect((streamError as Error).name).toBe('AbortError');

    await vi.waitFor(async () => {
      const [assistant] = await savedAssistantMessages(memory, threadId, resourceId);
      expect(assistant, 'streamed assistant message was not persisted after processor abort').toBeDefined();
      expect(textOf(assistant!)).toContain('Hello');
    });
    result.cleanup?.();
  });
});

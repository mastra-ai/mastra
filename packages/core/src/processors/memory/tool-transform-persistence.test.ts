import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../../agent/message-list';
import type { MastraDBMessage } from '../../agent/message-list';
import { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';
import { transformToolPayloadForTargets } from '../../tools/payload-transform';
import { MessageHistory } from './message-history';

describe('output-only tool transforms in stored history', () => {
  it.each(['save-queue', 'message-history'] as const)(
    'preserves tool arguments and redacts results through %s, including replay',
    async savePath => {
      const input = { query: 'first' };
      const output = { query: 'first', payload: 'large raw result' };
      const source = {
        toolTransform: {
          transcript: { output: () => ({ query: 'first' }) },
        },
      };
      const context = { toolName: 'lookup', toolCallId: 'call-1' };
      const inputTransform = await transformToolPayloadForTargets(
        { ...context, phase: 'input-available', input },
        source,
      );
      const outputTransform = await transformToolPayloadForTargets(
        { ...context, phase: 'output-available', input, output },
        source,
      );
      const message: MastraDBMessage = {
        id: 'assistant-1',
        role: 'assistant',
        threadId: 'thread-1',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'lookup',
                args: input,
                result: output,
              },
              providerMetadata: {
                mastra: {
                  toolPayloadTransform: {
                    transcript: { ...inputTransform?.transcript, ...outputTransform?.transcript },
                  },
                },
              },
            },
          ],
        },
      };
      const list = new MessageList().add(message, 'response');
      let saved: MastraDBMessage[] = [];
      const saveMessages = vi.fn(async ({ messages }: { messages: MastraDBMessage[] }) => {
        saved = messages;
        return { messages };
      });

      if (savePath === 'save-queue') {
        await saveMessages({ messages: list.drainUnsavedMessages() });
      } else {
        const storage = {
          saveMessages,
          getThreadById: vi.fn().mockResolvedValue({ id: 'thread-1', metadata: {} }),
          updateThread: vi.fn().mockResolvedValue(undefined),
        } as unknown as MemoryStorage;
        const requestContext = new RequestContext();
        requestContext.set('MastraMemory', { thread: { id: 'thread-1' }, resourceId: 'resource-1' });
        await new MessageHistory({ storage }).processOutputResult({
          messageList: list,
          messages: [message],
          requestContext,
          abort: reason => {
            throw new Error(reason);
          },
        });
      }

      expect(saved).toHaveLength(1);
      const savedPart = saved[0]!.content.parts.find(part => part.type === 'tool-invocation');
      expect(savedPart).toBeDefined();
      if (!savedPart || savedPart.type !== 'tool-invocation') throw new Error('Expected a saved tool invocation');
      expect(savedPart.toolInvocation.args).toEqual(input);
      expect(savedPart.toolInvocation.state).toBe('result');
      expect(savedPart.toolInvocation).toMatchObject({ result: { query: 'first' } });

      // Persisting a smaller transcript must not change the live model result.
      const liveModelMessages = list.get.all.aiV5.model();
      expect(liveModelMessages).toContainEqual(
        expect.objectContaining({
          role: 'tool',
          content: [expect.objectContaining({ output: { type: 'json', value: output } })],
        }),
      );
      // On the next turn, the stored call still has the arguments the model emitted.
      const replay = new MessageList().add(saved, 'memory').get.all.aiV5.model();
      expect(replay).toContainEqual(
        expect.objectContaining({
          role: 'assistant',
          content: [expect.objectContaining({ type: 'tool-call', input })],
        }),
      );
      expect(replay).toContainEqual(
        expect.objectContaining({
          role: 'tool',
          content: [expect.objectContaining({ output: { type: 'json', value: { query: 'first' } } })],
        }),
      );
    },
  );
});

import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { getDummyResponseModel } from '../agent/__tests__/mock-model';
import { InMemoryStore } from '../storage/mock';
import { Harness } from './harness';

describe('Harness tool-error reload', () => {
  async function createHarnessWithThread() {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test',
      model: getDummyResponseModel('v2'),
    });
    const harness = new Harness({
      id: 'test-harness',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });

    await harness.init();
    const thread = await harness.createThread({ title: 'Tool error thread' });
    const memoryStorage = await storage.getStore('memory');
    if (!memoryStorage) throw new Error('Expected memory storage');

    return { harness, memoryStorage, thread };
  }

  it('reconstructs a persisted failed tool (output-error) as an error tool_result', async () => {
    const { harness, memoryStorage, thread } = await createHarnessWithThread();

    await memoryStorage.saveMessages({
      messages: [
        {
          id: 'assistant-failed-tool',
          threadId: thread.id,
          resourceId: 'test-harness',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'output-error',
                  toolCallId: 'call-1',
                  toolName: 'find_files',
                  args: { path: '/x' },
                  errorText: 'Permission denied',
                },
              },
            ],
          },
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
        },
      ] as any,
    });

    const messages = await harness.listMessages();
    const assistant = messages.find(m => m.id === 'assistant-failed-tool');
    expect(assistant).toBeDefined();

    const content = assistant!.content as Array<Record<string, unknown>>;
    const toolResult = content.find(c => c.type === 'tool_result' && c.id === 'call-1');
    expect(toolResult).toBeDefined();
    expect(toolResult).toMatchObject({
      type: 'tool_result',
      name: 'find_files',
      result: 'Permission denied',
      isError: true,
    });
  });
});

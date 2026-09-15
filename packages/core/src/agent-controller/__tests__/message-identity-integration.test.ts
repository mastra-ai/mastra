/**
 * End-to-end identity contract: the assistant message emitted over the live
 * stream must carry the same id as its persisted copy. Clients reconcile a
 * live transcript against refetched history by id — two ids for one turn
 * render the turn twice (doubled assistant bubble after an SSE reconnect).
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../../agent';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

describe('stream ↔ persisted message identity', () => {
  it('emits the assistant message under the id its persisted copy carries', async () => {
    const storage = new InMemoryStore();
    const agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      model: createTextStreamModel('Good to hear.'),
      instructions: 'You are a test agent.',
      memory: new MockMemory({ storage }),
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      storage,
      resourceId: 'test-resource',
      modes: [{ id: 'build', agent }],
      defaultModeId: 'build',
    });

    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    await controller.getMastra()?.startWorkers();
    await session.thread.create();
    const threadId = session.thread.requireId();

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    await session.sendMessage({ content: 'It seems to work well actually' });

    const streamedEnd = events.find(
      (event): event is Extract<AgentControllerEvent, { type: 'message_end' }> =>
        event.type === 'message_end' && event.message.role === 'assistant',
    );
    expect(streamedEnd).toBeDefined();
    expect(streamedEnd!.message.content.parts).toEqual([{ type: 'text', text: 'Good to hear.' }]);

    const persisted = await session.thread.listMessages({ threadId });
    const persistedAssistant = persisted.filter(message => message.role === 'assistant');
    expect(persistedAssistant).toHaveLength(1);
    expect(streamedEnd!.message.id).toBe(persistedAssistant[0]!.id);
  }, 30000);
});

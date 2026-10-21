import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

// generateLegacy() only accepts AI SDK v4 (LanguageModelV1) models and the aimock
// harness drives the v5+ stream loop, so the legacy save path needs MockLanguageModelV1.
// The v2 counterparts of these cases live in the persistence-* aimock scenarios.

function legacyTextModel() {
  return new MockLanguageModelV1({
    doGenerate: async () => ({
      text: Array.from({ length: 10 }, (_, count) => `Dummy response ${count}`).join(' '),
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      rawCall: { rawPrompt: null, rawSettings: {} },
    }),
  });
}

function legacyThrowingModel(message: string) {
  return new MockLanguageModelV1({
    doGenerate: async () => {
      throw new Error(message);
    },
  });
}

describe('generateLegacy message persistence', () => {
  it('saves the assistant reply after a successful run', async () => {
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'legacy-save-agent',
      name: 'Legacy Save Agent',
      instructions: 'test',
      model: legacyTextModel(),
      memory,
    });

    await agent.generateLegacy('repeat tool calls', { threadId: 'legacy-thread-1', resourceId: 'legacy-resource-1' });

    const { messages } = await memory.recall({ threadId: 'legacy-thread-1', resourceId: 'legacy-resource-1' });
    expect(messages.map(message => message.role)).toEqual(['user', 'assistant']);
    expect(messages[1]!.content.parts?.find(part => part.type === 'text')).toMatchObject({
      text: expect.stringContaining('Dummy response 9'),
    });
  });

  it('drops an input-only failed turn when the model throws before any output', async () => {
    const memory = new MockMemory();
    const saveMessagesSpy = vi.spyOn(memory, 'saveMessages');
    const agent = new Agent({
      id: 'legacy-interrupt-agent',
      name: 'Legacy Interrupt Agent',
      instructions: 'test',
      model: legacyThrowingModel('Immediate interruption'),
      memory,
    });

    await expect(
      agent.generateLegacy('interrupt before step', { threadId: 'legacy-thread-2', resourceId: 'legacy-resource-2' }),
    ).rejects.toThrow('Immediate interruption');

    // MessageHistory's orphan guard excludes input-only turns on the legacy path.
    const { messages } = await memory.recall({ threadId: 'legacy-thread-2', resourceId: 'legacy-resource-2' });
    expect(messages).toEqual([]);
    expect(saveMessagesSpy).not.toHaveBeenCalled();
  });

  it('creates the thread up front even when the model fails', async () => {
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'legacy-error-agent',
      name: 'Legacy Error Agent',
      instructions: 'test',
      model: legacyThrowingModel('Simulated error during response'),
      memory,
    });

    await expect(
      agent.generateLegacy('trigger error', {
        memory: { resource: 'legacy-user-err', thread: { id: 'legacy-thread-err' } },
      }),
    ).rejects.toThrow('Simulated error during response');

    // Storage backends that validate thread existence need the thread before any message is saved.
    const thread = await memory.getThreadById({ threadId: 'legacy-thread-err' });
    expect(thread?.id).toBe('legacy-thread-err');
  });
});

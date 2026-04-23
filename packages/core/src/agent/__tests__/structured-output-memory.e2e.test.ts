import { randomUUID } from 'node:crypto';
import { getLLMTestMode } from '@internal/llm-recorder';
import { createGatewayMock, setupDummyApiKeys } from '@internal/test-utils';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

const MODE = getLLMTestMode();
setupDummyApiKeys(MODE, ['openai']);

const mock = createGatewayMock();

beforeAll(() => mock.start());
afterAll(() => mock.saveAndStop());

const profileSchema = z.object({
  favoriteColor: z.string(),
  hometown: z.string(),
  petName: z.string(),
});

describe('Structured output memory inheritance (e2e)', { timeout: 180_000 }, () => {
  it('uses prior thread memory when structured output runs on a separate model after multiple turns', async () => {
    const threadId = randomUUID();
    const resourceId = `structured-output-memory-e2e-${randomUUID()}`;
    const memory = new MockMemory();

    await memory.createThread({ threadId, resourceId });

    const agent = new Agent({
      id: 'structured-output-memory-e2e-agent',
      name: 'Structured Output Memory E2E Agent',
      instructions:
        'You are a concise assistant. Acknowledge facts briefly and rely on conversation memory when asked later.',
      model: 'openai/gpt-5.4-mini',
      memory,
    });

    await agent.generate('Please remember this exactly: my favorite color is violet', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    await agent.generate('Please remember this too: I grew up in Lisbon', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    await agent.generate('One more fact to remember: my dog is named Mochi', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    const result = await agent.stream(
      'Tell me a story and use details I mentioned already but dont use the specific nouns/names I mentioned please',
      {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
        structuredOutput: {
          schema: profileSchema,
          model: 'openai/gpt-5.4-mini',
          useAgent: true,
        },
      },
    );

    const textChunks: string[] = [];
    let structuredObject:
      | {
          favoriteColor: string;
          hometown: string;
          petName: string;
        }
      | undefined;

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        textChunks.push(chunk.payload.text);
      }

      if (chunk.type === 'object-result') {
        structuredObject = chunk.object as typeof structuredObject;
      }
    }
    await result.getFullOutput();

    const streamedText = textChunks.join('');

    expect(streamedText.trim()).not.toContain('[object Object]');
    expect(streamedText.toLowerCase()).not.toContain('violet');
    expect(streamedText.toLowerCase()).not.toContain('lisbon');
    expect(streamedText.toLowerCase()).not.toContain('mochi');
    expect(structuredObject).toBeDefined();
    expect(structuredObject?.favoriteColor.toLowerCase()).toContain('violet');
    expect(structuredObject?.hometown.toLowerCase()).toContain('lisbon');
    expect(structuredObject?.petName.toLowerCase()).toContain('mochi');

    await vi.waitFor(async () => {
      const recalled = await memory.recall({ threadId, resourceId });
      const lastAssistantMessage = [...recalled.messages].reverse().find(message => message.role === 'assistant');
      const assistantText =
        lastAssistantMessage?.content.parts
          ?.filter(part => part.type === 'text')
          .map(part => part.text)
          .join('') ?? '';

      expect(assistantText).not.toContain('[object Object]');
      expect(assistantText).not.toContain('violet');
      expect(assistantText).not.toContain('lisbon');
      expect(assistantText).not.toContain('mochi');
    });
  });
});

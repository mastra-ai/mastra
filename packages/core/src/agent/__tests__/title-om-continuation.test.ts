import { randomUUID } from 'node:crypto';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const QUESTION = 'What is the weather in Lisbon today?';
const REMINDER = '<system-reminder>Please continue naturally.</system-reminder>';

/**
 * Stands in for observational memory: from step 1 on, adds OM's continuation reminder and, like OM after an
 * observation, saves the request and then drops it from the run's messages.
 */
function omLikeProcessor({ dropRequest, memory }: { dropRequest: boolean; memory: MockMemory }): Processor {
  return {
    id: 'om-like',
    processInputStep: async ({ messageList, stepNumber }) => {
      if (stepNumber < 1) return messageList;
      if (dropRequest) {
        const requests = messageList.get.all.db().filter(m => m.role === 'user' && m.id !== 'om-continuation');
        if (requests.length) {
          await memory.saveMessages({ messages: requests });
          messageList.removeByIds(requests.map(m => m.id));
        }
      }
      if (!messageList.get.all.db().some(m => m.id === 'om-continuation')) {
        messageList.add(
          {
            id: 'om-continuation',
            role: 'user',
            createdAt: new Date(0),
            content: { format: 2, parts: [{ type: 'text', text: REMINDER }] },
          },
          'memory',
        );
      }
      return messageList;
    },
  };
}

function createModels(toolSteps = 2) {
  let call = 0;
  const finish = (finishReason: 'tool-calls' | 'stop') =>
    ({ type: 'finish', finishReason, usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } }) as const;
  const agentModel = new MockLanguageModelV2({
    doStream: async () => {
      const step = call++;
      const chunks =
        step < toolSteps
          ? [
              { type: 'tool-call', toolCallId: `call-${step}`, toolName: 'lookupWeather', input: '{"city":"Lisbon"}' },
              finish('tool-calls'),
            ]
          : [
              { type: 'text-start', id: 't1' },
              { type: 'text-delta', id: 't1', delta: 'It is sunny in Lisbon.' },
              { type: 'text-end', id: 't1' },
              finish('stop'),
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: randomUUID(), modelId: 'mock', timestamp: new Date(0) },
          ...chunks,
        ] as any),
      };
    },
  });

  const titleCalls: unknown[] = [];
  const titleModel = new MockLanguageModelV2({
    doGenerate: async options => {
      titleCalls.push(options);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        content: [{ type: 'text' as const, text: 'Lisbon Weather' }],
        warnings: [],
      };
    },
  });
  return { agentModel, titleModel, titleCalls };
}

const lookupWeather = createTool({
  id: 'lookupWeather',
  description: 'Look up the weather for a city.',
  inputSchema: z.object({ city: z.string() }),
  execute: async () => ({ forecast: 'sunny' }),
});

async function runTurn({ dropRequest, toolSteps = 2 }: { dropRequest: boolean; toolSteps?: number }) {
  const { agentModel, titleModel, titleCalls } = createModels(toolSteps);
  const memory = new MockMemory();
  memory.getMergedThreadConfig = () => ({ generateTitle: { model: titleModel } });
  const agent = new Agent({
    id: 'om-title-test',
    name: 'OM Title Test',
    instructions: 'Answer briefly.',
    model: agentModel,
    tools: { lookupWeather },
    memory,
    inputProcessors: [omLikeProcessor({ dropRequest, memory })],
  });

  const threadId = `thread-${randomUUID()}`;
  const result = await agent.stream(QUESTION, {
    memory: { resource: 'user-1', thread: { id: threadId, title: '' } },
    maxSteps: toolSteps + 2,
  });
  await result.consumeStream();
  return { memory, threadId, titleCalls };
}

async function titlePromptFor(options: { dropRequest: boolean; toolSteps?: number }) {
  const { memory, threadId, titleCalls } = await runTurn(options);
  await vi.waitFor(async () => {
    expect((await memory.getThreadById({ threadId }))?.title).toBe('Lisbon Weather');
  });
  expect(titleCalls).toHaveLength(1);
  return JSON.stringify(titleCalls[0]);
}

describe('thread title with an OM continuation reminder', () => {
  it('ignores the reminder when the request is still in the run', async () => {
    const titlePrompt = await titlePromptFor({ dropRequest: false });
    expect(titlePrompt).toContain(QUESTION);
    expect(titlePrompt).not.toContain('system-reminder');
  });

  it('titles from the stored request once the run dropped it', async () => {
    const titlePrompt = await titlePromptFor({ dropRequest: true });
    expect(titlePrompt).toContain(QUESTION);
    expect(titlePrompt).not.toContain('system-reminder');
  });
});

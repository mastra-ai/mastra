import { randomUUID } from 'node:crypto';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const QUESTION = 'What is the weather in Lisbon today?';
const REMINDER = '<system-reminder>Please continue naturally.</system-reminder>';

type ReminderShape = { id: string; metadata?: Record<string, unknown>; stored?: boolean };

/**
 * Stands in for observational memory: from step 1 on, adds a system reminder and, like OM after an
 * observation, saves the request and then drops it from the run's messages. By default the reminder is
 * OM's own `om-continuation`; other shapes cover reminders with other ids or legacy metadata, and one
 * that reached storage.
 */
function omLikeProcessor({
  dropRequest,
  memory,
  reminder = { id: 'om-continuation' },
  fromStep = 1,
}: {
  dropRequest: boolean;
  memory: MockMemory;
  reminder?: ReminderShape;
  fromStep?: number;
}): Processor {
  return {
    id: 'om-like',
    processInputStep: async ({ messageList, stepNumber }) => {
      if (stepNumber < fromStep) return messageList;
      if (dropRequest) {
        const requests = messageList.get.all.db().filter(m => m.role === 'user' && m.id !== reminder.id);
        if (requests.length) {
          await memory.saveMessages({ messages: requests });
          messageList.removeByIds(requests.map(m => m.id));
        }
      }
      if (!messageList.get.all.db().some(m => m.id === reminder.id)) {
        const message = {
          id: reminder.id,
          role: 'user' as const,
          createdAt: reminder.stored ? new Date() : new Date(0),
          threadId: messageList.get.all.db().find(m => m.threadId)?.threadId,
          resourceId: 'user-1',
          content: {
            format: 2 as const,
            parts: [{ type: 'text' as const, text: reminder.metadata ? 'Remember the AGENTS.md rules.' : REMINDER }],
            ...(reminder.metadata ? { metadata: reminder.metadata } : {}),
          },
        };
        if (reminder.stored) await memory.saveMessages({ messages: [message] });
        messageList.add(message, 'memory');
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

async function runTurn({
  dropRequest,
  toolSteps = 2,
  reminder,
}: {
  dropRequest: boolean;
  toolSteps?: number;
  reminder?: ReminderShape;
}) {
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
    inputProcessors: [omLikeProcessor({ dropRequest, memory, reminder })],
  });

  const threadId = `thread-${randomUUID()}`;
  const result = await agent.stream(QUESTION, {
    memory: { resource: 'user-1', thread: { id: threadId, title: '' } },
    maxSteps: toolSteps + 2,
  });
  await result.consumeStream();
  return { memory, threadId, titleCalls };
}

async function titlePromptFor(options: Parameters<typeof runTurn>[0]) {
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

  it.each([
    ['another id with <system-reminder> text', { id: 'agents-md-reminder' }],
    [
      'legacy reminder metadata',
      { id: 'legacy-reminder', metadata: { dynamicAgentsMdReminder: { path: 'AGENTS.md' } } },
    ],
  ] as const)('ignores a reminder with %s', async (_label, reminder) => {
    const titlePrompt = await titlePromptFor({ dropRequest: false, reminder });
    expect(titlePrompt).toContain(QUESTION);
    expect(titlePrompt).not.toContain('system-reminder');
    expect(titlePrompt).not.toContain('AGENTS.md rules');
  });

  it('ignores a reminder that reached storage when titling from stored messages', async () => {
    const titlePrompt = await titlePromptFor({
      dropRequest: true,
      reminder: { id: 'stored-reminder', stored: true },
    });
    expect(titlePrompt).toContain(QUESTION);
    expect(titlePrompt).not.toContain('system-reminder');
  });

  // The AI SDK v4 legacy path runs the same input processors and titles from the same messages.
  it.each([false, true])('legacy generate titles from the user question (request dropped: %s)', async dropRequest => {
    const { titleModel, titleCalls } = createModels();
    const memory = new MockMemory();
    memory.getMergedThreadConfig = () => ({ generateTitle: { model: titleModel } });
    const agent = new Agent({
      id: 'om-title-legacy-test',
      name: 'OM Title Legacy Test',
      instructions: 'Answer briefly.',
      model: new MockLanguageModelV1({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 5 },
          text: 'It is sunny in Lisbon.',
        }),
      }),
      memory,
      inputProcessors: [omLikeProcessor({ dropRequest, memory, fromStep: 0 })],
    });

    const threadId = `thread-${randomUUID()}`;
    await agent.generateLegacy(QUESTION, { memory: { resource: 'user-1', thread: { id: threadId, title: '' } } });
    await vi.waitFor(async () => {
      expect((await memory.getThreadById({ threadId }))?.title).toBe('Lisbon Weather');
    });
    expect(titleCalls).toHaveLength(1);
    const titlePrompt = JSON.stringify(titleCalls[0]);
    expect(titlePrompt).toContain(QUESTION);
    expect(titlePrompt).not.toContain('system-reminder');
  });
});

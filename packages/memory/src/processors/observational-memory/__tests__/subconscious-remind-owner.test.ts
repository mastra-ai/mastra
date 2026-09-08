import type { LanguageModelV2StreamPart } from '@internal/ai-sdk-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { Memory } from '../../..';
import { applyExtractorHooks } from '../extracted-values';
import { SubconsciousRemindExtractor } from '../subconscious';
import {
  getRemindMessageText,
  getRemindThreadId,
  REMIND_PARENT_THREAD_METADATA_KEY,
} from '../subconscious/remind-protocol';
import { createAskMemoryTool } from '../subconscious/remind-questions';

const ORG = 'org-1';
const PROJECT = 'project-1';
const SESSION = 'session-1';
const PARENT = 'parent';

function latestUserText(prompt: unknown): string {
  if (!Array.isArray(prompt)) return '';
  const users = prompt.filter(message => (message as { role?: unknown }).role === 'user');
  const last = users[users.length - 1] as { content?: unknown } | undefined;
  const content = last?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part): part is { type: 'text'; text: string } => {
      return !!part && typeof part === 'object' && part.type === 'text' && typeof part.text === 'string';
    })
    .map(part => part.text)
    .join('\n');
}

function toolCallStream(toolName: string, input: Record<string, unknown>, callId: string) {
  const serialized = JSON.stringify(input);
  const parts: LanguageModelV2StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: callId, modelId: 'remind-model', timestamp: new Date() },
    { type: 'tool-input-start', id: callId, toolName },
    { type: 'tool-input-delta', id: callId, delta: serialized },
    { type: 'tool-call', toolCallId: callId, toolName, input: serialized },
    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
  ];
  return { stream: convertArrayToReadableStream(parts), rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
}

function textStopStream(text: string) {
  const parts: LanguageModelV2StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'stop', modelId: 'remind-model', timestamp: new Date() },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
  ];
  return { stream: convertArrayToReadableStream(parts), rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
}

function createHarness(options: { knowledgeResourceId?: string }) {
  const storage = new InMemoryStore();
  const memory = new Memory({ storage });
  const requestContext = new RequestContext();
  requestContext.set('organizationId', ORG);
  if (options.knowledgeResourceId) requestContext.set('knowledgeResourceId', options.knowledgeResourceId);

  const emitted = { reminder: 0, reply: 0 };
  let sourceRecordId = '';
  const model = new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
      content: [{ type: 'text', text: 'ok' }],
    }),
    doStream: async streamOptions => {
      const latest = latestUserText(streamOptions.prompt);
      const replyId = latest.match(/Memory question (\S+)/)?.[1];
      if (replyId && emitted.reply === 0) {
        emitted.reply += 1;
        return toolCallStream(
          'reply_to_memory_question',
          { replyId, answer: 'You decided January 15.', moreComing: false },
          'reply-call',
        );
      }
      const eventId = latest.match(/Passive reminder check (subconscious:remind:[^\s"\\]+:event)/)?.[1];
      if (eventId && emitted.reminder === 0) {
        emitted.reminder += 1;
        return toolCallStream(
          'send_reminder',
          { eventId, reminder: 'Project Atlas launches January 15.', sourceIds: [sourceRecordId] },
          'reminder-call',
        );
      }
      return textStopStream('Done.');
    },
  });

  const signals: Array<{ signal: any; options: any }> = [];
  const mainAgent = {
    id: 'main-agent',
    getModel: vi.fn(async () => model),
    getMastraInstance: vi.fn(),
    getPubSub: vi.fn(),
    sendSignal: vi.fn((signal: unknown, sendOptions: { ifActive: { behavior: string } }) => {
      signals.push({ signal, options: sendOptions });
      if (sendOptions.ifActive.behavior === 'persist') {
        return { signal, accepted: Promise.resolve({ action: 'persist' }), persisted: Promise.resolve() };
      }
      return { signal, accepted: Promise.resolve({ action: 'deliver', runId: 'parent-run' }) };
    }),
  } as any;

  const errors: unknown[] = [];
  const writer = {
    custom: vi.fn(async (event: unknown) => {
      if ((event as { type?: string }).type === 'data-subconscious-error') errors.push(event);
    }),
  } as any;

  return {
    storage,
    memory,
    requestContext,
    model,
    emitted,
    signals,
    errors,
    writer,
    mainAgent,
    setSourceRecordId(id: string) {
      sourceRecordId = id;
    },
  };
}

async function runScenario(knowledgeResourceId: string | undefined) {
  const harness = createHarness({ knowledgeResourceId });
  const scopeResource = knowledgeResourceId ?? SESSION;
  const scope = [`org:${ORG}`, `resource:${scopeResource}`];

  const knowledgeStore = await harness.memory.storage.getStore('knowledge');
  const node = await knowledgeStore.createNode({ name: 'Project Atlas', kind: 'project', scope });
  const record = await knowledgeStore.appendKnowledge({
    node,
    text: 'Project Atlas launches January 15.',
    scope,
    sourceThreadId: 'beta',
    resolutionScope: [...scope, 'thread:beta'],
    defaultScope: scope,
  });
  harness.setSourceRecordId(record.id);

  // Passive path: the reminder sidekick creates subconscious:<parent>:remind.
  const passiveSendSignal = vi.fn(async () => undefined) as any;
  const passive = await applyExtractorHooks({
    source: 'observer',
    extractors: [new SubconsciousRemindExtractor({ name: 'remind', maxSteps: 3, builtIn: true })],
    rawObservations: 'The user is scheduling Project Atlas.',
    threadId: PARENT,
    resourceId: SESSION,
    mainAgent: harness.mainAgent,
    memory: harness.memory,
    requestContext: harness.requestContext,
    sendSignal: passiveSendSignal,
    sendStateSignal: vi.fn(async () => ({ skipped: false })) as any,
    writer: harness.writer,
  } as any);
  expect(passive.failures, JSON.stringify(harness.errors)).toBeUndefined();
  expect(harness.emitted.reminder).toBe(1);

  const remindThreadId = getRemindThreadId(PARENT);
  const thread = await harness.memory.getThreadById({ threadId: remindThreadId });
  expect(thread).not.toBeNull();
  if (!thread) throw new Error('remind thread missing');
  const memoryStore = await harness.storage.getStore('memory');
  const stored = await memoryStore.listMessages({
    threadId: remindThreadId,
    resourceId: thread.resourceId,
    perPage: false,
  });
  const passiveChecks = stored.messages.filter(message =>
    getRemindMessageText(message).startsWith('Passive reminder check'),
  );
  expect(passiveChecks.length).toBeGreaterThan(0);

  // Question path: ask_memory from the parent agent under its own resource.
  const tool = createAskMemoryTool({
    memory: harness.memory,
    config: { name: 'remind', builtIn: true, maxSteps: 5 },
    getParentAgent: () => harness.mainAgent,
  });
  const result = (await tool.execute?.({ question: 'What did I decide?' }, {
    agent: { agentId: 'main-agent', threadId: PARENT, resourceId: SESSION, messages: [] },
    requestContext: harness.requestContext,
    writer: harness.writer,
  } as any)) as any;

  expect(result, `ask_memory result: ${JSON.stringify(result)}`).toMatchObject({ accepted: true, status: 'pending' });

  expect(thread.resourceId).toBe(SESSION);
  expect(thread.metadata?.[REMIND_PARENT_THREAD_METADATA_KEY]).toBe(PARENT);

  await vi.waitFor(
    () => {
      const answer = harness.signals.find(entry => entry.signal?.tagName === 'remind-answer');
      expect(answer, `no remind-answer signal; errors=${JSON.stringify(harness.errors)}`).toBeDefined();
    },
    { timeout: 5000 },
  );
  const answers = harness.signals.filter(entry => entry.signal?.tagName === 'remind-answer');
  expect(answers[0]!.signal.attributes).toMatchObject({
    replyId: result.replyId,
    moreComing: 'false',
    source: 'subconscious',
    agent: 'remind',
  });
  expect(answers.some(entry => entry.options.threadId === PARENT && entry.options.resourceId === SESSION)).toBe(true);
  expect(harness.emitted).toEqual({ reminder: 1, reply: 1 });
}

describe('Subconscious remind thread ownership', () => {
  // Control first: the package vitest config bails after the first failure.
  it('accepts ask_memory after a passive reminder without override', async () => {
    await runScenario(undefined);
  });

  it('accepts ask_memory after a passive reminder with a knowledgeResourceId override', async () => {
    await runScenario(PROJECT);
  });
});

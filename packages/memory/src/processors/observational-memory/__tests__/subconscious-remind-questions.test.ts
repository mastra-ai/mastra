import { Agent } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory } from '../../..';
import { Subconscious } from '../subconscious';
import { REMIND_MESSAGE_METADATA_KEY } from '../subconscious/remind-protocol';
import { createAskMemoryTool, createReplyToMemoryQuestionTool } from '../subconscious/remind-questions';

const parentThreadId = 'parent-thread';
const resourceId = 'resource-1';
const parentAgentId = 'parent-agent';

function createParentAgent() {
  return {
    id: parentAgentId,
    getModel: vi.fn(async () => 'openai/gpt-5-mini'),
    getMastraInstance: vi.fn(),
    getPubSub: vi.fn(),
    sendSignal: vi.fn((signal: unknown, options: { ifActive: { behavior: string } }) => {
      const action = options.ifActive.behavior === 'persist' ? 'persist' : 'discard';
      return {
        signal,
        accepted: Promise.resolve({ action }),
        persisted: action === 'persist' ? Promise.resolve() : undefined,
      };
    }),
  } as any;
}

function toolContext(messages: unknown[] = []) {
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'org-1');
  return {
    agent: { agentId: parentAgentId, threadId: parentThreadId, resourceId, messages },
    requestContext,
  } as any;
}

function replyToolContext(messages: unknown[] = []) {
  const context = toolContext(messages);
  context.agent.threadId = `subconscious:${parentThreadId}:remind`;
  return context;
}

function questionMessage(replyId: string): MastraDBMessage {
  return {
    id: `${replyId}:message`,
    role: 'user',
    threadId: `subconscious:${parentThreadId}:remind`,
    resourceId,
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [{ type: 'text', text: `Memory question ${replyId}\n\nWhat did I decide?` }],
      metadata: {
        [REMIND_MESSAGE_METADATA_KEY]: { type: 'question', replyId, askedAt: Date.now() },
      },
    },
  };
}

describe('Subconscious reminder questions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes ask_memory only when Subconscious tools are enabled', () => {
    const memory = new Memory({ storage: new InMemoryStore() });

    expect(
      memory.listTools({
        observationalMemory: {
          model: 'openai/gpt-5-mini',
          experimental_subconscious: new Subconscious(),
        },
      }),
    ).toHaveProperty('ask_memory');
    expect(
      memory.listTools({
        observationalMemory: {
          model: 'openai/gpt-5-mini',
          experimental_subconscious: new Subconscious({ tools: false }),
        },
      }),
    ).not.toHaveProperty('ask_memory');
  });

  it('sends the question directly to the owned sidekick thread with minimal metadata', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const parentAgent = createParentAgent();
    const sendMessage = vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation((() => ({
      accepted: Promise.resolve({ action: 'deliver', runId: 'sidekick-run' }),
    })) as any);
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true, maxSteps: 5 },
      getParentAgent: () => parentAgent,
    });

    const result = (await tool.execute?.({ question: 'What did I decide?' }, toolContext())) as any;

    expect(result).toMatchObject({ accepted: true, status: 'pending' });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: `Memory question ${result.replyId}\n\nWhat did I decide?`,
        metadata: {
          [REMIND_MESSAGE_METADATA_KEY]: {
            type: 'question',
            replyId: result.replyId,
            askedAt: expect.any(Number),
          },
        },
      }),
      expect.objectContaining({
        threadId: `subconscious:${parentThreadId}:remind`,
        resourceId,
        ifActive: { behavior: 'deliver' },
        ifIdle: expect.objectContaining({ behavior: 'wake' }),
      }),
    );
  });

  it('rejects a question when native sidekick routing does not accept it', async () => {
    const memory = new Memory({ storage: new InMemoryStore() });
    const parentAgent = createParentAgent();
    vi.spyOn(Agent.prototype, 'sendMessage').mockImplementation((() => ({
      accepted: Promise.resolve({ action: 'discard' }),
    })) as any);
    const tool = createAskMemoryTool({
      memory,
      config: { name: 'remind', builtIn: true, maxSteps: 5 },
      getParentAgent: () => parentAgent,
    });

    const result = await tool.execute?.({ question: 'What did I decide?' }, toolContext());

    expect(result).toMatchObject({ accepted: false, status: 'rejected', error: expect.stringContaining('discard') });
  });

  it('rejects replies that are not tied to a question in the current MessageList', async () => {
    const parentAgent = createParentAgent();
    const tool = createReplyToMemoryQuestionTool({ parentAgent, parentThreadId, resourceId });

    const result = await tool.execute?.(
      { replyId: 'reply-1', answer: 'January 15.', moreComing: false },
      replyToolContext(),
    );

    expect(result).toEqual({
      delivered: false,
      replyId: 'reply-1',
      reason: 'question-not-in-current-conversation',
    });
    expect(parentAgent.sendSignal).not.toHaveBeenCalled();
  });

  it('accepts the provider-facing MessageList shape for reply authorization', async () => {
    const parentAgent = createParentAgent();
    const tool = createReplyToMemoryQuestionTool({ parentAgent, parentThreadId, resourceId });
    const providerMessage = {
      role: 'user',
      content: [{ type: 'text', text: 'Memory question reply-1\n\nWhat did I decide?' }],
    };

    const result = await tool.execute?.(
      { replyId: 'reply-1', answer: 'January 15.', moreComing: false },
      replyToolContext([providerMessage]),
    );

    expect(result).toMatchObject({ delivered: true, replyId: 'reply-1', moreComing: false });
  });

  it('delivers partial replies with content-derived deterministic IDs', async () => {
    const parentAgent = createParentAgent();
    const tool = createReplyToMemoryQuestionTool({ parentAgent, parentThreadId, resourceId });
    const context = replyToolContext([questionMessage('reply-1')]);

    const first = await tool.execute?.(
      { replyId: 'reply-1', answer: 'I found the launch notes.', moreComing: true },
      context,
    );
    const second = await tool.execute?.(
      { replyId: 'reply-1', answer: 'I found the launch notes.', moreComing: true },
      context,
    );

    expect(first).toMatchObject({ delivered: true, replyId: 'reply-1', moreComing: true });
    expect(second).toMatchObject({ delivered: true, replyId: 'reply-1', moreComing: true });
    expect(parentAgent.sendSignal).toHaveBeenCalledTimes(2);
    const firstId = parentAgent.sendSignal.mock.calls[0]![0].id;
    expect(firstId).toMatch(/^reply-1:partial:[a-f0-9]{12}:signal$/);
  });

  it('rejects a terminal reply reconstructed from provider-shaped MessageList tool history', async () => {
    const parentAgent = createParentAgent();
    const tool = createReplyToMemoryQuestionTool({ parentAgent, parentThreadId, resourceId });
    const toolResult = {
      role: 'tool',
      content: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-1',
            toolName: 'reply_to_memory_question',
            args: {},
            result: { delivered: true, replyId: 'reply-1', moreComing: false },
          },
        },
      ],
    } as unknown as MastraDBMessage;

    const result = await tool.execute?.(
      { replyId: 'reply-1', answer: 'Duplicate answer.', moreComing: false },
      replyToolContext([questionMessage('reply-1'), toolResult]),
    );

    expect(result).toEqual({ delivered: false, replyId: 'reply-1', reason: 'already-terminal' });
    expect(parentAgent.sendSignal).not.toHaveBeenCalled();
  });

  it('delivers terminal replies with one deterministic signal ID', async () => {
    const parentAgent = createParentAgent();
    const tool = createReplyToMemoryQuestionTool({ parentAgent, parentThreadId, resourceId });

    const context = replyToolContext([questionMessage('reply-1')]);
    const result = await tool.execute?.({ replyId: 'reply-1', answer: 'January 15.', moreComing: false }, context);
    const duplicate = await tool.execute?.({ replyId: 'reply-1', answer: 'January 15.', moreComing: false }, context);

    expect(result).toMatchObject({ delivered: true, replyId: 'reply-1', moreComing: false, outcome: 'answer' });
    expect(duplicate).toMatchObject({ delivered: true, replyId: 'reply-1', moreComing: false, outcome: 'answer' });
    expect(parentAgent.sendSignal).toHaveBeenCalledTimes(2);
    expect(parentAgent.sendSignal).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ id: 'reply-1:terminal:signal', contents: 'January 15.' }),
      expect.objectContaining({ ifActive: { behavior: 'persist' }, ifIdle: { behavior: 'persist' } }),
    );
    expect(parentAgent.sendSignal).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'reply-1:terminal:signal' }),
      expect.objectContaining({ ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'discard' } }),
    );
  });
});

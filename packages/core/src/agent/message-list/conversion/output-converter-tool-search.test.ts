import { describe, expect, it } from 'vitest';
import { AIV5Adapter } from '../adapters';
import { MessageList } from '../index';
import type { MastraDBMessage } from '../index';
import type { AIV5Type } from '../types';
import { aiV5UIMessagesToAIV5ModelMessages } from './output-converter';

/**
 * Tests for OpenAI hosted `tool_search` (Responses API) replay handling.
 *
 * The provider assigns the call and result of a hosted tool_search DIFFERENT
 * item ids (`tsc_…` for the call, `tso_…` for the output). Stored history
 * keeps both on the merged tool part (`itemId` + `resultItemId`); when the
 * part is converted back to model messages, each side must carry its own id
 * so the provider emits two distinct `item_reference`s instead of the same
 * one twice ("Duplicate item found with id tso_…").
 *
 * A hosted tool_search part whose provider item ids were lost (e.g. a UI
 * round-trip that strips providerMetadata) cannot be replayed at all: the
 * provider rebuilds a `tool_search_call` without `arguments` and leaves an
 * orphan `function_call_output`, both 400s. Such parts are dropped from
 * prompts.
 */

type ToolUIPartLike = AIV5Type.UIMessage['parts'][number];

const makeMessage = (parts: AIV5Type.UIMessage['parts'], id = 'msg-1'): AIV5Type.UIMessage => ({
  id,
  role: 'assistant',
  parts,
});

const collectOpenAIItemMetadata = (messages: AIV5Type.ModelMessage[]) => {
  const entries: Array<{ partType: string; openai: Record<string, unknown> }> = [];
  for (const msg of messages) {
    if (typeof msg.content === 'string') continue;
    for (const part of msg.content) {
      const providerOptions = (part as { providerOptions?: Record<string, Record<string, unknown>> }).providerOptions;
      if (providerOptions?.openai) {
        entries.push({ partType: part.type, openai: providerOptions.openai });
      }
    }
  }
  return entries;
};

describe('aiV5UIMessagesToAIV5ModelMessages — hosted tool_search replay', () => {
  it('should give the tool-call and tool-result parts their own item ids (no duplicate references)', () => {
    const msg = makeMessage([
      {
        type: 'tool-tool_search',
        toolCallId: 'tsc_1',
        state: 'output-available',
        input: { queries: ['cache'], call_id: null },
        output: { tools: ['get_block'] },
        providerExecuted: true,
        callProviderMetadata: { openai: { itemId: 'tsc_1', resultItemId: 'tso_1' } },
      } as ToolUIPartLike,
    ]);

    const result = aiV5UIMessagesToAIV5ModelMessages([msg], [], 'prompt');

    const entries = collectOpenAIItemMetadata(result);
    const callEntry = entries.find(e => e.partType === 'tool-call');
    const resultEntry = entries.find(e => e.partType === 'tool-result');

    expect(callEntry?.openai).toEqual({ itemId: 'tsc_1' });
    expect(resultEntry?.openai).toEqual({ itemId: 'tso_1' });

    const itemIds = entries.map(e => e.openai.itemId);
    expect(new Set(itemIds).size).toBe(itemIds.length);
    expect(entries.every(e => !('resultItemId' in e.openai))).toBe(true);
  });

  it('should drop a hosted tool_search part whose provider item ids were lost (unreplayable)', () => {
    const messages: AIV5Type.UIMessage[] = [
      makeMessage(
        [
          {
            type: 'tool-tool_search',
            toolCallId: 'tsc_1',
            state: 'output-available',
            input: { queries: ['cache'], call_id: null },
            output: { tools: ['get_block'] },
            providerExecuted: true,
          } as ToolUIPartLike,
          { type: 'text', text: 'Found the tool.' },
        ],
        'msg-1',
      ),
      { id: 'msg-2', role: 'user', parts: [{ type: 'text', text: 'next question' }] },
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, [], 'prompt');

    const allParts = result.flatMap(m => (typeof m.content === 'string' ? [] : m.content));
    const toolParts = allParts.filter(p => p.type === 'tool-call' || p.type === 'tool-result');
    expect(toolParts).toHaveLength(0);
    expect(result.some(m => m.role === 'tool')).toBe(false);
    // The rest of the assistant turn survives.
    expect(allParts.some(p => p.type === 'text' && p.text === 'Found the tool.')).toBe(true);
  });

  it('should drop an assistant message entirely when its only part is an unreplayable tool_search part', () => {
    const messages: AIV5Type.UIMessage[] = [
      makeMessage([
        {
          type: 'tool-tool_search',
          toolCallId: 'tsc_1',
          state: 'output-available',
          input: { queries: ['cache'], call_id: null },
          output: { tools: ['get_block'] },
          providerExecuted: true,
        } as ToolUIPartLike,
      ]),
      { id: 'msg-2', role: 'user', parts: [{ type: 'text', text: 'next question' }] },
    ];

    const result = aiV5UIMessagesToAIV5ModelMessages(messages, [], 'prompt');

    expect(result.some(m => m.role === 'assistant')).toBe(false);
    expect(result.some(m => m.role === 'user')).toBe(true);
  });

  it('should keep a client-executed tool_search part (non-null call_id) even without provider item ids', () => {
    const msg = makeMessage([
      {
        type: 'tool-tool_search',
        toolCallId: 'call_abc',
        state: 'output-available',
        input: { queries: ['cache'], call_id: 'call_abc' },
        output: { tools: ['get_block'] },
      } as ToolUIPartLike,
    ]);

    const result = aiV5UIMessagesToAIV5ModelMessages([msg], [], 'prompt');

    const allParts = result.flatMap(m => (typeof m.content === 'string' ? [] : m.content));
    expect(allParts.some(p => p.type === 'tool-call')).toBe(true);
    expect(allParts.some(p => p.type === 'tool-result')).toBe(true);
  });

  it('should keep hosted tool_search parts in response mode even without provider item ids', () => {
    const msg = makeMessage([
      {
        type: 'tool-tool_search',
        toolCallId: 'tsc_1',
        state: 'output-available',
        input: { queries: ['cache'], call_id: null },
        output: { tools: ['get_block'] },
        providerExecuted: true,
      } as ToolUIPartLike,
    ]);

    const result = aiV5UIMessagesToAIV5ModelMessages([msg], [], 'response');

    const allParts = result.flatMap(m => (typeof m.content === 'string' ? [] : m.content));
    expect(allParts.some(p => p.type === 'tool-call')).toBe(true);
  });

  it('should not affect web_search parts that replay with no provider metadata at all', () => {
    const msg = makeMessage([
      {
        type: 'tool-web_search',
        toolCallId: 'ws_1',
        state: 'output-available',
        input: { query: 'news' },
        output: { status: 'completed' },
        providerExecuted: true,
      } as ToolUIPartLike,
    ]);

    const result = aiV5UIMessagesToAIV5ModelMessages([msg], [], 'prompt');

    const allParts = result.flatMap(m => (typeof m.content === 'string' ? [] : m.content));
    const toolCall = allParts.find(p => p.type === 'tool-call');
    const toolResult = allParts.find(p => p.type === 'tool-result');
    expect(toolCall).toBeDefined();
    expect(toolResult).toBeDefined();
    expect((toolCall as { providerOptions?: unknown }).providerOptions?.['openai' as never]).toBeUndefined();
    expect((toolResult as { providerOptions?: unknown }).providerOptions?.['openai' as never]).toBeUndefined();
  });

  it('should preserve both item ids when a replayed model message merges call and result parts (input adapter)', () => {
    // A prior turn's response messages fed back as input: the assistant model
    // message carries the provider-executed call and result as separate parts,
    // each with its own Responses item id.
    const modelMessage = {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'tsc_1',
          toolName: 'tool_search',
          input: { queries: ['cache'], call_id: null },
          providerExecuted: true,
          providerOptions: { openai: { itemId: 'tsc_1' } },
        },
        {
          type: 'tool-result',
          toolCallId: 'tsc_1',
          toolName: 'tool_search',
          output: { type: 'json', value: { tools: ['get_block'] } },
          providerExecuted: true,
          providerOptions: { openai: { itemId: 'tso_1' } },
        },
      ],
    } as AIV5Type.ModelMessage;

    const dbMessage = AIV5Adapter.fromModelMessage(modelMessage, 'input');

    const part = dbMessage.content.parts.find(p => p.type === 'tool-invocation') as
      | { providerMetadata?: Record<string, unknown>; providerExecuted?: boolean }
      | undefined;
    expect(part?.providerMetadata).toEqual({ openai: { itemId: 'tsc_1', resultItemId: 'tso_1' } });
    // Provider-executed must survive the round-trip, or the replayed result is
    // moved to a `tool` role message and re-serialized as a broken client-mode
    // tool_search_output.
    expect(part?.providerExecuted).toBe(true);
  });

  it('should produce unique item ids end-to-end through MessageList.llmPrompt', async () => {
    const messageList = new MessageList();

    const assistantMsg: MastraDBMessage = {
      id: 'msg-assistant',
      role: 'assistant',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: 'tsc_1',
              toolName: 'tool_search',
              args: { queries: ['cache'], call_id: null },
              result: { tools: ['get_block'] },
            },
            providerExecuted: true,
            providerMetadata: { openai: { itemId: 'tsc_1', resultItemId: 'tso_1' } },
          } as MastraDBMessage['content']['parts'][number],
          { type: 'text', text: 'Found the tool.' },
        ],
      },
    };

    messageList.add({ id: 'msg-user', role: 'user', content: 'find a block tool' }, 'user');
    messageList.add(assistantMsg, 'response');
    messageList.add({ id: 'msg-user-2', role: 'user', content: 'now use it' }, 'user');

    const prompt = await messageList.get.all.aiV5.llmPrompt();

    const itemIds: string[] = [];
    for (const msg of prompt) {
      if (typeof msg.content === 'string') continue;
      for (const part of msg.content) {
        const openaiOptions = (part as { providerOptions?: Record<string, Record<string, unknown>> }).providerOptions
          ?.openai;
        if (typeof openaiOptions?.itemId === 'string') itemIds.push(openaiOptions.itemId);
        expect(openaiOptions?.resultItemId).toBeUndefined();
      }
    }

    expect(itemIds).toContain('tsc_1');
    expect(itemIds).toContain('tso_1');
    expect(new Set(itemIds).size).toBe(itemIds.length);
  });
});

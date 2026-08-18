import { describe, expect, it } from 'vitest';

import type { MastraDBMessage, MastraToolInvocationPart } from '../state/types';
import type { AIV6Type } from '../types';
import { RESPONSE_RESULT_ITEM_ID_KEY } from '../utils/response-item-metadata';
import { AIV6Adapter } from './AIV6Adapter';

/**
 * Some hosted tools on the OpenAI Responses API (e.g. tool_search) return the
 * call and its output as two items with DIFFERENT ids (tsc_… call / tso_…
 * output). AIV6Adapter.toUIMessage surfaces the result id in a dedicated
 * `resultProviderMetadata` slot, so fromUIMessage must merge it back onto the
 * single merged tool part; otherwise a UI round trip drops the tso_… id and
 * re-introduces the duplicate-item-reference replay defect.
 */
describe('AIV6Adapter — tool_search call/result item id preservation', () => {
  const CALL_ITEM_ID = 'tsc_123';
  const RESULT_ITEM_ID = 'tso_456';

  const findToolInvocationPart = (dbMsg: MastraDBMessage, toolCallId: string): MastraToolInvocationPart | undefined =>
    dbMsg.content.parts.find(
      (p): p is MastraToolInvocationPart => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === toolCallId,
    );

  it('fromUIMessage keeps both the tsc_ call id and the tso_ result id from a UI part', () => {
    const toolPart: AIV6Type.ToolUIPart = {
      type: 'tool-tool_search',
      toolCallId: CALL_ITEM_ID,
      state: 'output-available',
      input: { query: 'find weather tools' },
      output: { tools: ['get_weather'] },
      providerExecuted: true,
      callProviderMetadata: { openai: { itemId: CALL_ITEM_ID } },
      resultProviderMetadata: { openai: { itemId: RESULT_ITEM_ID } },
    };

    const uiMsg: AIV6Type.UIMessage = {
      id: 'msg-1',
      role: 'assistant',
      parts: [toolPart],
    };

    const dbMsg = AIV6Adapter.fromUIMessage(uiMsg);

    const toolInvocationPart = findToolInvocationPart(dbMsg, CALL_ITEM_ID);
    expect(toolInvocationPart).toBeDefined();
    expect(toolInvocationPart!.toolInvocation.state).toBe('result');

    const openaiMetadata = toolInvocationPart!.providerMetadata?.openai;
    expect(openaiMetadata?.itemId).toBe(CALL_ITEM_ID);
    expect(openaiMetadata?.[RESPONSE_RESULT_ITEM_ID_KEY]).toBe(RESULT_ITEM_ID);
  });

  it('survives a full toUIMessage → fromUIMessage round trip', () => {
    const dbMsg: MastraDBMessage = {
      id: 'msg-1',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: CALL_ITEM_ID,
              toolName: 'tool_search',
              args: { query: 'find weather tools' },
              result: { tools: ['get_weather'] },
            },
            providerExecuted: true,
            providerMetadata: {
              openai: { itemId: CALL_ITEM_ID, [RESPONSE_RESULT_ITEM_ID_KEY]: RESULT_ITEM_ID },
            },
          },
        ],
      },
    };

    const uiMsg = AIV6Adapter.toUIMessage(dbMsg);
    const roundTripped = AIV6Adapter.fromUIMessage(uiMsg);

    const toolInvocationPart = findToolInvocationPart(roundTripped, CALL_ITEM_ID);
    expect(toolInvocationPart).toBeDefined();
    expect(toolInvocationPart!.toolInvocation.state).toBe('result');

    const openaiMetadata = toolInvocationPart!.providerMetadata?.openai;
    expect(openaiMetadata?.itemId).toBe(CALL_ITEM_ID);
    expect(openaiMetadata?.[RESPONSE_RESULT_ITEM_ID_KEY]).toBe(RESULT_ITEM_ID);
  });

  it('leaves call-only states unchanged (no result metadata to merge)', () => {
    const toolPart: AIV6Type.ToolUIPart = {
      type: 'tool-tool_search',
      toolCallId: CALL_ITEM_ID,
      state: 'input-available',
      input: { query: 'find weather tools' },
      providerExecuted: true,
      callProviderMetadata: { openai: { itemId: CALL_ITEM_ID } },
    };

    const uiMsg: AIV6Type.UIMessage = {
      id: 'msg-1',
      role: 'assistant',
      parts: [toolPart],
    };

    const dbMsg = AIV6Adapter.fromUIMessage(uiMsg);

    const toolInvocationPart = findToolInvocationPart(dbMsg, CALL_ITEM_ID);
    expect(toolInvocationPart).toBeDefined();
    expect(toolInvocationPart!.toolInvocation.state).toBe('call');

    const openaiMetadata = toolInvocationPart!.providerMetadata?.openai;
    expect(openaiMetadata?.itemId).toBe(CALL_ITEM_ID);
    expect(openaiMetadata?.[RESPONSE_RESULT_ITEM_ID_KEY]).toBeUndefined();
  });
});

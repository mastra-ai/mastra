import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../state/types';

import { AIV5Adapter } from './AIV5Adapter';

/**
 * Tests for providerExecuted flag propagation through AIV5Adapter.toUIMessage.
 *
 * When a tool-invocation part in a MastraDBMessage has providerExecuted: true,
 * the resulting AIV5 UIMessage ToolUIPart must also carry providerExecuted: true.
 * This is critical for the sanitization filter in output-converter.ts to
 * distinguish provider-executed tools from incomplete client-side tool calls.
 */
describe('AIV5Adapter.toUIMessage — providerExecuted propagation', () => {
  const makeDbMessage = (parts: MastraDBMessage['content']['parts']): MastraDBMessage => ({
    id: 'msg-1',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts,
    },
  });

  it('should propagate providerExecuted on input-available (call state) tool parts', () => {
    const dbMsg = makeDbMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'call-1',
          toolName: 'web_search_20250305',
          args: { query: 'test' },
        },
        providerExecuted: true,
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const toolPart = uiMsg.parts.find(p => 'toolCallId' in p && (p as any).toolCallId === 'call-1') as any;
    expect(toolPart).toBeDefined();
    expect(toolPart.state).toBe('input-available');
    expect(toolPart.providerExecuted).toBe(true);
  });

  it('should propagate providerExecuted on output-available (result state) tool parts', () => {
    const dbMsg = makeDbMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'call-1',
          toolName: 'web_search_20250305',
          args: { query: 'test' },
          result: [{ url: 'https://example.com', title: 'Result', content: 'data' }],
        },
        providerExecuted: true,
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const toolPart = uiMsg.parts.find(p => 'toolCallId' in p && (p as any).toolCallId === 'call-1') as any;
    expect(toolPart).toBeDefined();
    expect(toolPart.state).toBe('output-available');
    expect(toolPart.providerExecuted).toBe(true);
  });

  it('should NOT add providerExecuted when it is absent from the DB message part', () => {
    const dbMsg = makeDbMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'call-1',
          toolName: 'get_company_info',
          args: { name: 'test' },
        },
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const toolPart = uiMsg.parts.find(p => 'toolCallId' in p && (p as any).toolCallId === 'call-1') as any;
    expect(toolPart).toBeDefined();
    expect(toolPart.state).toBe('input-available');
    expect(toolPart.providerExecuted).toBeUndefined();
  });

  it('should handle mixed parts: provider-executed and regular tools in the same message', () => {
    const dbMsg = makeDbMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: 'call-1',
          toolName: 'web_search_20250305',
          args: { query: 'test' },
        },
        providerExecuted: true,
      } as any,
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'call-2',
          toolName: 'get_company_info',
          args: { name: 'test' },
          result: { company: 'Acme' },
        },
      } as any,
    ]);

    const uiMsg = AIV5Adapter.toUIMessage(dbMsg);

    const webSearchPart = uiMsg.parts.find(p => 'toolCallId' in p && (p as any).toolCallId === 'call-1') as any;
    const regularPart = uiMsg.parts.find(p => 'toolCallId' in p && (p as any).toolCallId === 'call-2') as any;

    expect(webSearchPart.providerExecuted).toBe(true);
    expect(regularPart.providerExecuted).toBeUndefined();
  });
});

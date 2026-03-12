import { describe, expect, it } from 'vitest';
import type { AIV5Type } from '../types';
import { sanitizeV5UIMessages } from './output-converter';

/**
 * Tests for provider-executed tool handling in sanitizeV5UIMessages.
 *
 * Provider-executed tools (e.g. Anthropic web_search_20250305) are executed
 * server-side by the provider API. They remain in 'input-available' state
 * because no client-side result is added. The sanitization filter must keep
 * these parts so the provider API sees the server_tool_use block and can
 * execute the deferred tool on the next continuation request.
 */
describe('sanitizeV5UIMessages — provider-executed tool handling', () => {
  const makeToolPart = (
    overrides: Partial<AIV5Type.ToolUIPart> & { type: string; toolCallId: string },
  ): AIV5Type.ToolUIPart =>
    ({
      state: 'input-available' as const,
      input: {},
      ...overrides,
    }) as AIV5Type.ToolUIPart;

  const makeMessage = (parts: AIV5Type.UIMessage['parts']): AIV5Type.UIMessage => ({
    id: 'msg-1',
    role: 'assistant',
    parts,
  });

  it('should filter out regular input-available tool parts when filterIncompleteToolCalls is true', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-get_info',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { name: 'test' },
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    // Message should be dropped entirely — its only part was filtered out
    expect(result).toHaveLength(0);
  });

  it('should keep provider-executed input-available tool parts when filterIncompleteToolCalls is true', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect((result[0]!.parts[0] as any).toolCallId).toBe('call-1');
    expect((result[0]!.parts[0] as any).providerExecuted).toBe(true);
  });

  it('should keep output-available parts for client-executed tools', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-get_info',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'test' },
        output: { company: 'Acme' },
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
  });

  it('should handle mid-loop parallel calls: keep client output-available + provider input-available, drop regular input-available', () => {
    const msg = makeMessage([
      // Regular tool with result — keep
      makeToolPart({
        type: 'tool-get_company_info',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'test' },
        output: { company: 'Acme' },
      }),
      // Provider-executed tool with no client result — keep
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-2',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
      // Regular tool still pending — drop
      makeToolPart({
        type: 'tool-update_record',
        toolCallId: 'call-3',
        state: 'input-available',
        input: { id: '123' },
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(2);

    const toolCallIds = result[0]!.parts.map((p: any) => p.toolCallId);
    expect(toolCallIds).toContain('call-1');
    expect(toolCallIds).toContain('call-2');
    expect(toolCallIds).not.toContain('call-3');
  });

  it('should strip output-available provider-executed tool parts so completed server_tool_use blocks are not sent back to the LLM', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { query: 'anthropic' },
        output: { results: ['result1'] },
        providerExecuted: true,
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    // Entire message dropped — its only part was a completed provider-executed tool
    expect(result).toHaveLength(0);
  });

  it('should strip output-error provider-executed tool parts', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-1',
        state: 'output-error',
        input: { query: 'test' },
        providerExecuted: true,
      } as any),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(0);
  });

  it('should handle resume scenario: keep client output-available, strip completed provider output-available', () => {
    const msg = makeMessage([
      // Client-executed tool with result — keep (needs to go back in prompt)
      makeToolPart({
        type: 'tool-get_company_info',
        toolCallId: 'call-1',
        state: 'output-available',
        input: { name: 'test' },
        output: { company: 'Acme' },
      }),
      // Provider-executed tool already completed — strip (provider handles internally)
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-2',
        state: 'output-available',
        input: { query: 'test' },
        output: { results: ['result1'] },
        providerExecuted: true,
      }),
    ]);

    const result = sanitizeV5UIMessages([msg], true);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);

    const toolCallIds = result[0]!.parts.map((p: any) => p.toolCallId);
    expect(toolCallIds).toContain('call-1');
    expect(toolCallIds).not.toContain('call-2');
  });

  it('should strip orphaned provider-executed call when its result exists in a different message', () => {
    // This reproduces the bug where OM sealing (or any other mechanism) splits
    // a provider-executed tool call and its result into separate messages.
    // Message 1: call (input-available, providerExecuted)
    // Message 2: result (output-available, providerExecuted)
    // Without the fix, the call is kept and the result is stripped → orphaned server_tool_use → 400
    const msg1 = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'srvtoolu_split1',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
    ]);

    const msg2: AIV5Type.UIMessage = {
      id: 'msg-2',
      role: 'assistant',
      parts: [
        makeToolPart({
          type: 'tool-web_search_20250305',
          toolCallId: 'srvtoolu_split1',
          state: 'output-available',
          input: { query: 'test' },
          output: { results: ['result1'] },
          providerExecuted: true,
        }),
      ],
    };

    const result = sanitizeV5UIMessages([msg1, msg2], true);

    // Both messages should be dropped — the call AND result are stripped
    const allToolCallIds = result.flatMap(m => m.parts.filter((p: any) => p.toolCallId).map((p: any) => p.toolCallId));
    expect(allToolCallIds).not.toContain('srvtoolu_split1');
  });

  it('should strip orphaned call but keep other parts in the same message', () => {
    // Message 1 has both a text part and a provider-executed call
    const msg1: AIV5Type.UIMessage = {
      id: 'msg-1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Let me search for that.' },
        makeToolPart({
          type: 'tool-web_search_20250305',
          toolCallId: 'srvtoolu_split2',
          state: 'input-available',
          input: { query: 'test' },
          providerExecuted: true,
        }),
      ],
    };

    const msg2: AIV5Type.UIMessage = {
      id: 'msg-2',
      role: 'assistant',
      parts: [
        makeToolPart({
          type: 'tool-web_search_20250305',
          toolCallId: 'srvtoolu_split2',
          state: 'output-available',
          input: { query: 'test' },
          output: { results: ['result1'] },
          providerExecuted: true,
        }),
      ],
    };

    const result = sanitizeV5UIMessages([msg1, msg2], true);

    // msg1 should still exist with just the text part
    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect(result[0]!.parts[0]!.type).toBe('text');
  });

  it('should keep provider-executed call when no result exists anywhere (normal in-flight case)', () => {
    // Only a call, no result in any message — this is the normal case during streaming
    const msg1 = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'srvtoolu_inflight',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
    ]);

    const result = sanitizeV5UIMessages([msg1], true);

    // Call should be kept — no completed result exists
    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(1);
    expect((result[0]!.parts[0] as any).toolCallId).toBe('srvtoolu_inflight');
  });

  it('should not filter provider-executed tools when filterIncompleteToolCalls is false', () => {
    const msg = makeMessage([
      makeToolPart({
        type: 'tool-web_search_20250305',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { query: 'test' },
        providerExecuted: true,
      }),
      makeToolPart({
        type: 'tool-get_info',
        toolCallId: 'call-2',
        state: 'input-available',
        input: { name: 'test' },
      }),
    ]);

    // Without filterIncompleteToolCalls, both should be kept (only input-streaming is filtered)
    const result = sanitizeV5UIMessages([msg], false);

    expect(result).toHaveLength(1);
    expect(result[0]!.parts).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';

import type { CollectedChunk } from './build-messages-from-chunks';
import { buildMessagesFromChunks } from './build-messages-from-chunks';

function build(chunks: CollectedChunk[], tools?: any) {
  return buildMessagesFromChunks({
    chunks,
    messageId: 'msg-1',
    tools,
  });
}

function parts(chunks: CollectedChunk[], tools?: any) {
  const msgs = build(chunks, tools);
  return msgs[0]?.content.parts ?? [];
}

describe('buildMessagesFromChunks', () => {
  // ── Text spans ──────────────────────────────────────────────

  it('should produce a single text part from a text-start/delta/end span', () => {
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: 'Hello' } },
      { type: 'text-delta', payload: { id: 't1', text: ', world!' } },
      { type: 'text-end', payload: { id: 't1' } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'text', text: 'Hello, world!' });
  });

  it('should skip empty text spans (no deltas)', () => {
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-end', payload: { id: 't1' } },
    ]);
    expect(result).toHaveLength(0);
  });

  it('should skip text spans with only empty-string deltas', () => {
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: '' } },
      { type: 'text-delta', payload: { id: 't1', text: '' } },
      { type: 'text-end', payload: { id: 't1' } },
    ]);
    expect(result).toHaveLength(0);
  });

  it('should keep an empty text span whose deltas carry providerMetadata (#20469)', () => {
    const meta = { google: { thoughtSignature: 'sig-abc' } };
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: '', providerMetadata: meta } },
      { type: 'text-end', payload: { id: 't1' } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'text', text: '', providerMetadata: meta });
  });

  it('should handle text-delta without a matching text-start', () => {
    const result = parts([
      { type: 'text-delta', payload: { id: 't1', text: 'orphan' } },
      { type: 'text-end', payload: { id: 't1' } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'text', text: 'orphan' });
  });

  it('should flush unclosed text spans at end of stream', () => {
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: 'truncated' } },
      // No text-end
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'text', text: 'truncated' });
  });

  // ── Interleaved text spans ──────────────────────────────────

  it('should correctly separate interleaved text spans by ID', () => {
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-start', payload: { id: 't2' } },
      { type: 'text-delta', payload: { id: 't1', text: 'Hello' } },
      { type: 'text-delta', payload: { id: 't2', text: 'Goodbye' } },
      { type: 'text-delta', payload: { id: 't1', text: ', world!' } },
      { type: 'text-end', payload: { id: 't2' } },
      { type: 'text-end', payload: { id: 't1' } },
    ]);
    expect(result).toHaveLength(2);
    // Parts are emitted in first-delta order (content arrival order), not text-end order.
    // t1's first delta arrives before t2's first delta, so t1 appears first.
    expect(result[0]).toMatchObject({ type: 'text', text: 'Hello, world!' });
    expect(result[1]).toMatchObject({ type: 'text', text: 'Goodbye' });
  });

  // ── ProviderMetadata cascading ──────────────────────────────

  it('should use providerMetadata from text-start by default', () => {
    const meta = { openai: { itemId: 'msg_1' } };
    const result = parts([
      { type: 'text-start', payload: { id: 't1', providerMetadata: meta } },
      { type: 'text-delta', payload: { id: 't1', text: 'hi' } },
      { type: 'text-end', payload: { id: 't1' } },
    ]);
    expect(result[0]?.providerMetadata).toEqual(meta);
  });

  it('should use latest non-null providerMetadata (text-end wins)', () => {
    const startMeta = { openai: { itemId: 'start' } };
    const endMeta = { openai: { itemId: 'end' } };
    const result = parts([
      { type: 'text-start', payload: { id: 't1', providerMetadata: startMeta } },
      { type: 'text-delta', payload: { id: 't1', text: 'hi' } },
      { type: 'text-end', payload: { id: 't1', providerMetadata: endMeta } },
    ]);
    expect(result[0]?.providerMetadata).toEqual(endMeta);
  });

  // ── Reasoning spans ─────────────────────────────────────────

  it('should produce a reasoning part from a reasoning-start/delta/end span', () => {
    const result = parts([
      { type: 'reasoning-start', payload: { id: 'r1' } },
      { type: 'reasoning-delta', payload: { id: 'r1', text: 'Thinking...' } },
      { type: 'reasoning-end', payload: { id: 'r1' } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'reasoning',
      reasoning: 'Thinking...',
      details: [{ type: 'text', text: 'Thinking...' }],
    });
  });

  it('should emit empty reasoning parts (needed for OpenAI item_reference)', () => {
    const result = parts([
      { type: 'reasoning-start', payload: { id: 'r1' } },
      { type: 'reasoning-end', payload: { id: 'r1' } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'reasoning',
      reasoning: '',
      details: [{ type: 'text', text: '' }],
    });
  });

  it('should use latest providerMetadata for reasoning (end wins)', () => {
    const startMeta = { openai: { itemId: 'rs_start', signature: 'aaa' } };
    const endMeta = { openai: { itemId: 'rs_end', signature: 'bbb' } };
    const result = parts([
      { type: 'reasoning-start', payload: { id: 'r1', providerMetadata: startMeta } },
      { type: 'reasoning-delta', payload: { id: 'r1', text: 'think' } },
      { type: 'reasoning-end', payload: { id: 'r1', providerMetadata: endMeta } },
    ]);
    expect(result[0]).toMatchObject({
      type: 'reasoning',
      reasoning: 'think',
      providerMetadata: endMeta,
    });
  });

  it('should handle redacted reasoning', () => {
    const result = parts([
      {
        type: 'reasoning-start',
        payload: { id: 'r1', providerMetadata: { deepseek: { redactedData: 'abc' } } },
      },
      { type: 'reasoning-end', payload: { id: 'r1' } },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'reasoning',
      reasoning: '',
      details: [{ type: 'redacted', data: '' }],
    });
  });

  it('should handle standalone redacted-reasoning chunks', () => {
    const meta = { deepseek: { redactedData: 'abc' } };
    const result = parts([{ type: 'redacted-reasoning', payload: { id: 'r1', data: 'abc', providerMetadata: meta } }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'reasoning',
      reasoning: '',
      details: [{ type: 'redacted', data: '' }],
      providerMetadata: meta,
    });
  });

  it('should merge interleaved reasoning spans by ID', () => {
    const result = parts([
      { type: 'reasoning-start', payload: { id: 'r1' } },
      { type: 'reasoning-start', payload: { id: 'r2' } },
      { type: 'reasoning-delta', payload: { id: 'r1', text: 'Thought A. ' } },
      { type: 'reasoning-delta', payload: { id: 'r2', text: 'Thought B.' } },
      { type: 'reasoning-delta', payload: { id: 'r1', text: 'More A.' } },
      { type: 'reasoning-end', payload: { id: 'r1' } },
      { type: 'reasoning-end', payload: { id: 'r2' } },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      type: 'reasoning',
      reasoning: 'Thought A. More A.',
      details: [{ type: 'text', text: 'Thought A. More A.' }],
    });
    expect(result[1]).toMatchObject({
      type: 'reasoning',
      reasoning: 'Thought B.',
      details: [{ type: 'text', text: 'Thought B.' }],
    });
  });

  // ── Tool calls ──────────────────────────────────────────────

  it('should produce a tool-invocation part with state: call', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'myTool', args: { q: 'test' } },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'call',
        toolCallId: 'tc1',
        toolName: 'myTool',
        args: { q: 'test' },
      },
    });
  });

  it('should merge tool-call + tool-result into a single result part', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'myTool', args: { q: 'test' } },
      },
      {
        type: 'tool-result',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          result: { answer: '42' },
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        toolCallId: 'tc1',
        toolName: 'myTool',
        args: { q: 'test' },
        result: { answer: '42' },
      },
    });
  });

  it('should preserve both call and result itemIds when a Responses provider assigns each side its own id', () => {
    // OpenAI hosted tool_search (Responses API) emits a tool-call chunk carrying
    // the call item id (tsc_…) and a tool-result chunk carrying the output item
    // id (tso_…). Replay needs BOTH ids — losing the call id makes the next
    // request reference the same item twice ("Duplicate item found").
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'tc1',
          toolName: 'tool_search',
          args: { queries: ['cache'] },
          providerExecuted: true,
          providerMetadata: { openai: { itemId: 'tsc_1' } },
        },
      },
      {
        type: 'tool-result',
        payload: {
          toolCallId: 'tc1',
          toolName: 'tool_search',
          args: { queries: ['cache'] },
          result: { tools: ['get_block'] },
          providerExecuted: true,
          providerMetadata: { openai: { itemId: 'tso_1' } },
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect((result[0] as any).providerMetadata).toEqual({
      openai: { itemId: 'tsc_1', resultItemId: 'tso_1' },
    });
  });

  it('should keep the result metadata as-is when call and result share the same itemId', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'ws1',
          toolName: 'web_search_call',
          args: { query: 'news' },
          providerExecuted: true,
          providerMetadata: { openai: { itemId: 'ws_1' } },
        },
      },
      {
        type: 'tool-result',
        payload: {
          toolCallId: 'ws1',
          toolName: 'web_search_call',
          args: { query: 'news' },
          result: { status: 'completed' },
          providerExecuted: true,
          providerMetadata: { openai: { itemId: 'ws_1' } },
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect((result[0] as any).providerMetadata).toEqual({ openai: { itemId: 'ws_1' } });
  });

  it('should not add itemId metadata when neither chunk carries any (web_search shape)', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: { toolCallId: 'ws1', toolName: 'web_search', args: { query: 'news' }, providerExecuted: true },
      },
      {
        type: 'tool-result',
        payload: {
          toolCallId: 'ws1',
          toolName: 'web_search',
          args: { query: 'news' },
          result: { status: 'completed' },
          providerExecuted: true,
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect((result[0] as any).providerMetadata).toBeUndefined();
  });

  it('should merge tool-call + tool-error into a single output-error part', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          providerExecuted: true,
        },
      },
      {
        type: 'tool-error',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          error: new Error('Provider tool failed'),
          providerExecuted: true,
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'output-error',
        toolCallId: 'tc1',
        toolName: 'myTool',
        args: { q: 'test' },
        errorText: 'Provider tool failed',
      },
      providerExecuted: true,
    });
  });

  it('should preserve string tool-error messages', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          providerExecuted: true,
        },
      },
      {
        type: 'tool-error',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          error: 'boom',
          providerExecuted: true,
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'output-error',
        toolCallId: 'tc1',
        toolName: 'myTool',
        args: { q: 'test' },
        errorText: 'boom',
      },
      providerExecuted: true,
    });
  });

  it('should preserve plain-object tool-error messages', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          providerExecuted: true,
        },
      },
      {
        type: 'tool-error',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          error: { message: 'Provider object failure' },
          providerExecuted: true,
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'output-error',
        toolCallId: 'tc1',
        toolName: 'myTool',
        args: { q: 'test' },
        errorText: 'Provider object failure',
      },
      providerExecuted: true,
    });
  });

  it('should fall back for falsy tool errors', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          providerExecuted: true,
        },
      },
      {
        type: 'tool-error',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          error: null,
          providerExecuted: true,
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'output-error',
        toolCallId: 'tc1',
        toolName: 'myTool',
        args: { q: 'test' },
        errorText: 'Tool execution failed',
      },
      providerExecuted: true,
    });
  });

  it('should fall back for whitespace-only tool error strings', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          providerExecuted: true,
        },
      },
      {
        type: 'tool-error',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          error: '   ',
          providerExecuted: true,
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'output-error',
        toolCallId: 'tc1',
        toolName: 'myTool',
        args: { q: 'test' },
        errorText: 'Tool execution failed',
      },
      providerExecuted: true,
    });
  });

  it('should fall back for Error instances without usable messages', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          providerExecuted: true,
        },
      },
      {
        type: 'tool-error',
        payload: {
          toolCallId: 'tc1',
          toolName: 'myTool',
          args: { q: 'test' },
          error: new Error(''),
          providerExecuted: true,
        },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'output-error',
        toolCallId: 'tc1',
        toolName: 'myTool',
        args: { q: 'test' },
        errorText: 'Tool execution failed',
      },
      providerExecuted: true,
    });
  });

  // ── Source and file parts ───────────────────────────────────

  it('should produce a source part', () => {
    const result = parts([
      {
        type: 'source',
        payload: { id: 's1', url: 'https://example.com', title: 'Example' },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'source',
      source: { sourceType: 'url', url: 'https://example.com', title: 'Example' },
    });
  });

  it('should produce a file part', () => {
    const result = parts([
      {
        type: 'file',
        payload: { data: 'base64data', mimeType: 'image/png' },
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'file', data: 'base64data', mimeType: 'image/png' });
  });

  // ── step-start insertion ────────────────────────────────────

  it('should insert step-start between tool-invocation and text', () => {
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: 'Before tool' } },
      { type: 'text-end', payload: { id: 't1' } },
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'myTool', args: {} },
      },
      {
        type: 'tool-result',
        payload: { toolCallId: 'tc1', toolName: 'myTool', args: {}, result: 'ok' },
      },
      { type: 'text-start', payload: { id: 't2' } },
      { type: 'text-delta', payload: { id: 't2', text: 'After tool' } },
      { type: 'text-end', payload: { id: 't2' } },
    ]);

    const types = result.map((p: any) => p.type);
    expect(types).toEqual(['text', 'tool-invocation', 'step-start', 'text']);
  });

  it('should NOT insert step-start between text and text', () => {
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: 'First' } },
      { type: 'text-end', payload: { id: 't1' } },
      { type: 'text-start', payload: { id: 't2' } },
      { type: 'text-delta', payload: { id: 't2', text: 'Second' } },
      { type: 'text-end', payload: { id: 't2' } },
    ]);

    const types = result.map((p: any) => p.type);
    expect(types).toEqual(['text', 'text']);
  });

  // ── Mixed content ordering ──────────────────────────────────

  it('should preserve stream start order when text-end arrives after tool-call', () => {
    // text-start arrives BEFORE tool-call, but text-end arrives AFTER.
    // Parts should reflect the order content *first appeared* in the stream.
    const result = parts([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: 'Before tool' } },
      // Tool call arrives while text span t1 is still open
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'myTool', args: {} },
      },
      // Text span t1 closes after the tool-call
      { type: 'text-end', payload: { id: 't1' } },
    ]);

    const types = result.map((p: any) => p.type);
    // text t1 started before tool-call, so it should appear first
    expect(types).toEqual(['text', 'tool-invocation']);
  });

  it('should preserve stream start order when reasoning-end arrives after tool-call', () => {
    const result = parts([
      { type: 'reasoning-start', payload: { id: 'r1' } },
      { type: 'reasoning-delta', payload: { id: 'r1', text: 'Thinking...' } },
      // Tool call arrives while reasoning span is still open
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'myTool', args: {} },
      },
      // Reasoning ends after tool-call
      { type: 'reasoning-end', payload: { id: 'r1' } },
    ]);

    const types = result.map((p: any) => p.type);
    // reasoning started before tool-call, so it should appear first
    expect(types).toEqual(['reasoning', 'tool-invocation']);
  });

  it('should preserve correct order: reasoning, text, tool-call', () => {
    const result = parts([
      { type: 'reasoning-start', payload: { id: 'r1' } },
      { type: 'reasoning-delta', payload: { id: 'r1', text: 'Thinking' } },
      { type: 'reasoning-end', payload: { id: 'r1' } },
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: 'Response' } },
      { type: 'text-end', payload: { id: 't1' } },
      {
        type: 'tool-call',
        payload: { toolCallId: 'tc1', toolName: 'myTool', args: {} },
      },
    ]);

    const types = result.map((p: any) => p.type);
    expect(types).toEqual(['reasoning', 'text', 'tool-invocation']);
  });

  it('should produce reasoning → text → tool-calls when reasoning-end arrives after text-end (#15914)', () => {
    // Regression for #15914: stream order from Ollama qwen3 has text-start before
    // reasoning-start, reasoning-delta before text-delta, and reasoning-end after text-end.
    // Parts should follow first-content-arrival order (reasoning before text).
    const result = parts([
      { type: 'response-metadata', payload: { id: 'rm1', modelId: 'test-model' } },
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'reasoning-start', payload: { id: 'r1' } },
      { type: 'reasoning-delta', payload: { id: 'r1', text: 'Thinking...' } },
      { type: 'text-delta', payload: { id: 't1', text: 'Hello' } },
      { type: 'tool-call-input-streaming-start', payload: { toolCallId: 'tc1', toolName: 'myTool', args: {} } },
      { type: 'tool-call-delta', payload: { toolCallId: 'tc1', argsTextDelta: "{'q':'first'}" } },
      { type: 'tool-call-input-streaming-end', payload: { toolCallId: 'tc1' } },
      { type: 'tool-call', payload: { toolCallId: 'tc1', toolName: 'myTool', args: { q: 'first' } } },
      { type: 'tool-call-input-streaming-start', payload: { toolCallId: 'tc2', toolName: 'myTool', args: {} } },
      { type: 'tool-call-delta', payload: { toolCallId: 'tc2', argsTextDelta: "{'q':'second'}" } },
      { type: 'tool-call-input-streaming-end', payload: { toolCallId: 'tc2' } },
      { type: 'tool-call', payload: { toolCallId: 'tc2', toolName: 'myTool', args: { q: 'second' } } },
      { type: 'text-end', payload: { id: 't1' } },
      { type: 'reasoning-end', payload: { id: 'r1' } },
      { type: 'finish', payload: { finishReason: 'stop', usage: {} } },
    ]);

    expect(result).toHaveLength(4);
    expect(result.map((p: any) => p.type)).toEqual(['reasoning', 'text', 'tool-invocation', 'tool-invocation']);
    expect(result[0]).toMatchObject({ type: 'reasoning', details: [{ type: 'text', text: 'Thinking...' }] });
    expect(result[1]).toMatchObject({ type: 'text', text: 'Hello' });
    expect(result[2]).toMatchObject({
      toolInvocation: { state: 'call', toolCallId: 'tc1', toolName: 'myTool', args: { q: 'first' } },
    });
    expect(result[3]).toMatchObject({
      toolInvocation: { state: 'call', toolCallId: 'tc2', toolName: 'myTool', args: { q: 'second' } },
    });
  });

  // ── Empty stream / no parts ─────────────────────────────────

  it('should return empty array for empty chunks', () => {
    const result = build([]);
    expect(result).toEqual([]);
  });

  it('should return empty array when only non-part chunks exist', () => {
    const result = build([
      { type: 'response-metadata', payload: { id: 'id-1', modelId: 'test' } },
      { type: 'finish', payload: { finishReason: 'stop', usage: {} } },
    ]);
    expect(result).toEqual([]);
  });

  // ── Message structure ───────────────────────────────────────

  it('should produce a single assistant message with correct ID and format', () => {
    const msgs = build([
      { type: 'text-start', payload: { id: 't1' } },
      { type: 'text-delta', payload: { id: 't1', text: 'Hello' } },
      { type: 'text-end', payload: { id: 't1' } },
    ]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.id).toBe('msg-1');
    expect(msgs[0]!.role).toBe('assistant');
    expect(msgs[0]!.content.format).toBe(2);
    expect(msgs[0]).not.toHaveProperty('createdAt');
  });

  it('should include responseModelMetadata in content', () => {
    const msgs = buildMessagesFromChunks({
      chunks: [
        { type: 'text-start', payload: { id: 't1' } },
        { type: 'text-delta', payload: { id: 't1', text: 'hi' } },
        { type: 'text-end', payload: { id: 't1' } },
      ],
      messageId: 'msg-1',
      responseModelMetadata: { metadata: { modelId: 'gpt-5' } },
    });
    expect(msgs[0]!.content.metadata).toEqual({ modelId: 'gpt-5' });
  });

  it('should prefer configured modelId over API response modelId in metadata', () => {
    // This test documents that responseModelMetadata should contain the configured
    // model ID (e.g., 'gpt-5.4'), not the API response model ID (e.g., 'gpt-5.4-2026-03-05').
    // The caller (buildResponseModelMetadata) is responsible for this preference.
    const msgs = buildMessagesFromChunks({
      chunks: [
        { type: 'text-start', payload: { id: 't1' } },
        { type: 'text-delta', payload: { id: 't1', text: 'response' } },
        { type: 'text-end', payload: { id: 't1' } },
      ],
      messageId: 'msg-1',
      responseModelMetadata: { metadata: { modelId: 'gpt-5.4', provider: 'openai.responses' } },
    });
    // Verify the configured modelId is preserved in the message metadata
    expect(msgs[0]!.content.metadata).toEqual({ modelId: 'gpt-5.4', provider: 'openai.responses' });
  });

  it('uses transcript transforms for tool input and output', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
        },
        metadata: {
          mastra: {
            toolPayloadTransform: {
              transcript: {
                'input-available': { transformed: { customerId: 'cus_123' } },
              },
            },
          },
        },
      },
      {
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
          result: { displayName: 'Acme', apiKey: 'secret-output' },
        },
        metadata: {
          mastra: {
            toolPayloadTransform: {
              transcript: {
                'input-available': { transformed: { customerId: 'cus_123' } },
                'output-available': { transformed: { displayName: 'Acme' } },
              },
            },
          },
        },
      },
    ]);

    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        args: { customerId: 'cus_123' },
        result: { displayName: 'Acme' },
      },
    });
  });

  it('preserves raw tool payloads when transcript transform metadata is absent', () => {
    const result = parts([
      {
        type: 'tool-call',
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
        },
      },
      {
        type: 'tool-result',
        payload: {
          toolCallId: 'call-1',
          toolName: 'lookupCustomer',
          args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
          result: { displayName: 'Acme', apiKey: 'secret-output' },
        },
      },
    ]);

    expect(result[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: {
        state: 'result',
        args: { customerId: 'cus_123', internalPath: '/workspace/private/customer.json' },
        result: { displayName: 'Acme', apiKey: 'secret-output' },
      },
    });
  });
});

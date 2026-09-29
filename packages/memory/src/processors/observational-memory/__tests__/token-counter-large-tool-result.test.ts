import type { MastraDBMessage } from '@mastra/core/agent';
import { describe, expect, it } from 'vitest';

import { TokenCounter } from '../token-counter';
import { DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS } from '../tool-result-helpers';

function messageWithInvocation(
  invocation: Record<string, unknown>,
  providerMetadata?: Record<string, unknown>,
): MastraDBMessage {
  return {
    id: `msg-${String(invocation.toolCallId ?? '1')}`,
    role: 'assistant',
    createdAt: new Date(),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: invocation,
          providerMetadata,
        },
      ],
    },
  } as unknown as MastraDBMessage;
}

function messageWithToolResult(result: unknown): MastraDBMessage {
  return messageWithInvocation({
    state: 'result',
    toolCallId: 'tool-1',
    toolName: 'read_file',
    args: {},
    result,
  });
}

describe('TokenCounter with oversized tool results', () => {
  it('counts the full tool result, not the representation truncated for the Observer', () => {
    const counter = new TokenCounter();
    // Comfortably past the Observer's per-tool-result truncation budget.
    const hugeResult = { contents: 'lorem ipsum dolor sit amet '.repeat(40_000) };

    const tokens = counter.countMessage(messageWithToolResult(hugeResult));

    expect(tokens).toBeGreaterThan(DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS * 5);
  });

  it('scales with tool result size past the Observer truncation budget', () => {
    const counter = new TokenCounter();
    const build = (repeats: number) =>
      messageWithToolResult({ contents: 'lorem ipsum dolor sit amet '.repeat(repeats) });

    const smaller = counter.countMessage(build(40_000));
    const larger = counter.countMessage(build(80_000));

    expect(larger).toBeGreaterThan(smaller * 1.8);
  });

  it('counts oversized entries inside multimodal tool result content', () => {
    const counter = new TokenCounter();
    const build = (repeats: number) =>
      messageWithToolResult({
        content: [{ type: 'json', value: { contents: 'lorem ipsum dolor sit amet '.repeat(repeats) } }],
      });

    const smaller = counter.countMessage(build(40_000));
    const larger = counter.countMessage(build(80_000));

    expect(smaller).toBeGreaterThan(DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS * 5);
    expect(larger).toBeGreaterThan(smaller * 1.8);
  });

  it.each([
    ['result', { state: 'result', result: 'saved' }, 'saved'],
    ['errored result', { state: 'result', result: 'failed', isError: true }, 'failed'],
    ['output error', { state: 'output-error', errorText: 'disk full' }, 'disk full'],
    [
      'output denial',
      { state: 'output-denied', approval: { id: 'approval-1', approved: false, reason: 'protected' } },
      'protected',
    ],
  ])('counts the call signature and terminal outcome for a canonical %s', (_label, terminal, outcome) => {
    const counter = new TokenCounter();
    const args = { path: '/tmp/a/longer/path/that/makes/the/signature/token/delta/visible.txt' };
    const message = messageWithInvocation({
      ...terminal,
      toolCallId: 'terminal-1',
      toolName: 'write_file',
      args,
    });

    const expected = Math.round(
      counter.countString('assistant') +
        counter.countString('write_file') +
        counter.countString(JSON.stringify(args)) +
        counter.countString(outcome) +
        3.8 +
        3.8 -
        12,
    );

    const actual = counter.countMessage(message);
    expect(actual).toBe(expected);
    if (_label === 'result') {
      const outcomeOnlyBaseline = Math.round(
        counter.countString('assistant') + counter.countString(outcome) + 3.8 + 3.8,
      );
      expect(outcomeOnlyBaseline).toBe(11);
      expect(actual).toBe(33);
      expect(actual - outcomeOnlyBaseline).toBe(22);
    }
  });

  it.each([
    ['null', null, 'null', -12],
    ['false', false, 'false', -12],
    ['zero', 0, '0', -12],
    ['empty string', '', '', 0],
  ])('counts falsy %s arguments as part of the terminal signature', (_label, args, serializedArgs, argsOverhead) => {
    const counter = new TokenCounter();
    const message = messageWithInvocation({
      state: 'result',
      toolCallId: `falsy-${_label}`,
      toolName: 'lookup',
      args,
      result: 'saved',
    });
    const expected = Math.round(
      counter.countString('assistant') +
        counter.countString('lookup') +
        counter.countString(serializedArgs) +
        counter.countString('saved') +
        3.8 +
        3.8 +
        argsOverhead,
    );

    expect(counter.countMessage(message)).toBe(expected);
  });

  it.each([
    ['provided error text', 'disk full', 'disk full'],
    ['missing error text', undefined, 'Tool execution failed'],
    ['empty error text', '', 'Tool execution failed'],
  ])('counts %s for an errored result without a result body', (_label, errorText, outcome) => {
    const counter = new TokenCounter();
    const args = { path: '/tmp/a' };
    const message = messageWithInvocation({
      state: 'result',
      toolCallId: `errored-fallback-${_label}`,
      toolName: 'write_file',
      args,
      result: '',
      isError: true,
      errorText,
    });
    const expected = Math.round(
      counter.countString('assistant') +
        counter.countString('write_file') +
        counter.countString(JSON.stringify(args)) +
        counter.countString(outcome) +
        3.8 +
        3.8 -
        12,
    );

    expect(counter.countMessage(message)).toBe(expected);
  });

  it('counts the visible fallback for an empty successful result', () => {
    const counter = new TokenCounter();
    const args = { query: 'status' };
    const message = messageWithInvocation({
      state: 'result',
      toolCallId: 'empty-success',
      toolName: 'lookup',
      args,
      result: '',
    });
    const expected = Math.round(
      counter.countString('assistant') +
        counter.countString('lookup') +
        counter.countString(JSON.stringify(args)) +
        counter.countString('[empty result]') +
        3.8 +
        3.8 -
        12,
    );

    expect(counter.countMessage(message)).toBe(expected);
  });

  it('applies object overhead adjustments to both signature and result', () => {
    const counter = new TokenCounter();
    const args = { query: 'status' };
    const result = { ok: true, count: 2 };
    const message = messageWithInvocation({
      state: 'result',
      toolCallId: 'object-result',
      toolName: 'lookup',
      args,
      result,
    });

    const expected = Math.round(
      counter.countString('assistant') +
        counter.countString('lookup') +
        counter.countString(JSON.stringify(args)) +
        counter.countString(JSON.stringify(result)) +
        3.8 +
        3.8 -
        12 -
        12,
    );

    expect(counter.countMessage(message)).toBe(expected);
  });

  it('prefers stored modelOutput while counting the terminal signature', () => {
    const counter = new TokenCounter();
    const args = { query: 'status' };
    const modelOutput = { source: 'stored', value: 42 };
    const message = messageWithInvocation(
      {
        state: 'result',
        toolCallId: 'stored-output',
        toolName: 'lookup',
        args,
        result: { source: 'raw', value: 1 },
      },
      { mastra: { modelOutput } },
    );

    const expected = Math.round(
      counter.countString('assistant') +
        counter.countString('lookup') +
        counter.countString(JSON.stringify(args)) +
        counter.countString(JSON.stringify(modelOutput)) +
        3.8 +
        3.8 -
        12 -
        12,
    );

    expect(counter.countMessage(message)).toBe(expected);
    const part = (message.content as { parts: Array<{ providerMetadata?: Record<string, any> }> }).parts[0]!;
    const cache = part.providerMetadata?.mastra?.tokenEstimate as Record<string, { key: string }>;
    expect(Object.values(cache).some(entry => entry.key.startsWith('tool-call-name:'))).toBe(true);
    expect(Object.values(cache).some(entry => entry.key.startsWith('tool-call-args-json:'))).toBe(true);
    expect(Object.values(cache).some(entry => entry.key.startsWith('tool-result-model-output-json:'))).toBe(true);
  });

  it('reuses terminal signature and outcome token caches after message serialization', () => {
    const counter = new TokenCounter();
    const message = messageWithInvocation({
      state: 'result',
      toolCallId: 'cached-result',
      toolName: 'lookup',
      args: { query: 'cached' },
      result: { value: 'cached-result' },
    });

    const firstCount = counter.countMessage(message);
    const firstPart = (message.content as { parts: Array<Record<string, any>> }).parts[0]!;
    const firstCache = firstPart.providerMetadata?.mastra?.tokenEstimate;
    const reloaded = {
      ...JSON.parse(JSON.stringify(message)),
      createdAt: new Date(message.createdAt),
    } as MastraDBMessage;

    const secondCount = counter.countMessage(reloaded);
    const secondPart = (reloaded.content as { parts: Array<Record<string, any>> }).parts[0]!;

    expect(firstCache).toBeTruthy();
    expect(
      Object.values(firstCache as Record<string, { key: string }>).some(entry =>
        entry.key.startsWith('tool-call-name:'),
      ),
    ).toBe(true);
    expect(
      Object.values(firstCache as Record<string, { key: string }>).some(entry =>
        entry.key.startsWith('tool-call-args-json:'),
      ),
    ).toBe(true);
    expect(
      Object.values(firstCache as Record<string, { key: string }>).some(entry =>
        entry.key.startsWith('tool-result-json:'),
      ),
    ).toBe(true);
    expect(secondCount).toBe(firstCount);
    expect(secondPart.providerMetadata?.mastra?.tokenEstimate).toEqual(firstCache);
  });

  it('keeps standalone countMessage accounting message-local for malformed split histories', () => {
    const counter = new TokenCounter();
    const args = { query: 'split' };
    const callMessage = messageWithInvocation({
      state: 'call',
      toolCallId: 'split-history',
      toolName: 'lookup',
      args,
    });
    const resultMessage = messageWithInvocation({
      state: 'result',
      toolCallId: 'split-history',
      toolName: 'lookup',
      args,
      result: 'done',
    });
    const canonicalMessage = messageWithInvocation({
      state: 'result',
      toolCallId: 'split-history',
      toolName: 'lookup',
      args,
      result: 'done',
    });

    expect(counter.countMessage(callMessage) + counter.countMessage(resultMessage)).toBeGreaterThan(
      counter.countMessage(canonicalMessage),
    );
  });
});

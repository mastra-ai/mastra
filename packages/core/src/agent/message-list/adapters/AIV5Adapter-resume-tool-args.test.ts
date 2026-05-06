/**
 * Regression tests for #16017 — AIV5Adapter.fromModelMessage fabricates
 * `args: {}` on every tool-result whose matching tool-call lives in a
 * different model message. The canonical case is `agent.resumeStream(...)`
 * after an HITL suspend: the resumed stream emits a standalone tool-result
 * chunk, the persisted row gets `args: {}` for that toolCallId, and after
 * 3-4 cycles Anthropic in-context-learns the empty pattern and starts
 * emitting empty-args tool-calls itself, breaking subsequent invocations.
 *
 * Fix: when a tool-result has no matching tool-call in the same model
 * message, the adapter should look up prior tool-call args via a
 * caller-supplied `previousMessages` context before falling back to
 * `args: {}`.
 */
import type { ModelMessage as AIV5ModelMessage } from '@ai-sdk/provider-utils-v5';
import { describe, it, expect } from 'vitest';
import type { MastraDBMessage } from '../state/types';
import { AIV5Adapter } from './AIV5Adapter';

/**
 * Build a fully-formed MastraDBMessage representing an assistant turn that
 * issued a single tool-call with concrete args. Used as the "prior message"
 * in resume-flow regression tests.
 */
function buildPriorToolCallMessage(opts: {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}): MastraDBMessage {
  return {
    id: 'msg-call',
    role: 'assistant',
    createdAt: new Date('2026-01-01T10:00:00Z'),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            toolCallId: opts.toolCallId,
            toolName: opts.toolName,
            args: opts.args,
            state: 'call',
          },
        },
      ],
      toolInvocations: [
        {
          toolCallId: opts.toolCallId,
          toolName: opts.toolName,
          args: opts.args,
          state: 'call',
        },
      ],
    },
  };
}

/**
 * Build a stand-alone tool-result ModelMessage of the exact shape
 * `agent.resumeStream(...)` emits after an HITL suspend.
 */
function buildStandaloneToolResult(opts: { toolCallId: string; toolName: string; output: unknown }): AIV5ModelMessage {
  return {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: opts.toolCallId,
        toolName: opts.toolName,
        output: { type: 'json', value: opts.output } as any,
      },
    ],
  };
}

describe('AIV5Adapter.fromModelMessage — recover args from previousMessages on resume (#16017)', () => {
  it('fabricates args:{} when no previousMessages context is supplied (current default)', () => {
    const result = AIV5Adapter.fromModelMessage(
      buildStandaloneToolResult({
        toolCallId: 'tc-1',
        toolName: 'buildSlide',
        output: { ok: true },
      }),
    );

    const part = result.content.parts.find(
      p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'tc-1',
    ) as { type: 'tool-invocation'; toolInvocation: { args: unknown; result: unknown } };

    // No context, no recovery — falls back to args:{} (existing behaviour).
    expect(part.toolInvocation.args).toEqual({});
    expect(part.toolInvocation.result).toEqual({ ok: true });
  });

  it('recovers args from previousMessages when the tool-call lived in an earlier message', () => {
    const prior = buildPriorToolCallMessage({
      toolCallId: 'tc-1',
      toolName: 'buildSlide',
      args: { slideIndex: 7, title: 'Architecture' },
    });

    const result = AIV5Adapter.fromModelMessage(
      buildStandaloneToolResult({
        toolCallId: 'tc-1',
        toolName: 'buildSlide',
        output: { ok: true },
      }),
      undefined,
      { memoryInfo: null, previousMessages: [prior] },
    );

    const part = result.content.parts.find(
      p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'tc-1',
    ) as { type: 'tool-invocation'; toolInvocation: { args: unknown; result: unknown } };

    // The fix: args from the prior message are recovered, not fabricated as {}.
    expect(part.toolInvocation.args).toEqual({ slideIndex: 7, title: 'Architecture' });
    expect(part.toolInvocation.result).toEqual({ ok: true });
  });

  it('also populates the toolInvocations array with the recovered args', () => {
    const prior = buildPriorToolCallMessage({
      toolCallId: 'tc-2',
      toolName: 'lookup',
      args: { id: 42 },
    });

    const result = AIV5Adapter.fromModelMessage(
      buildStandaloneToolResult({
        toolCallId: 'tc-2',
        toolName: 'lookup',
        output: { name: 'foo' },
      }),
      undefined,
      { memoryInfo: null, previousMessages: [prior] },
    );

    const ti = result.content.toolInvocations?.find(t => t.toolCallId === 'tc-2');
    expect(ti?.args).toEqual({ id: 42 });
    expect(ti?.state).toBe('result');
  });

  it('falls back to args:{} when previousMessages does not contain the toolCallId (no regression)', () => {
    const unrelated = buildPriorToolCallMessage({
      toolCallId: 'different-id',
      toolName: 'other',
      args: { irrelevant: true },
    });

    const result = AIV5Adapter.fromModelMessage(
      buildStandaloneToolResult({
        toolCallId: 'tc-3',
        toolName: 'unmatched',
        output: { ok: true },
      }),
      undefined,
      { memoryInfo: null, previousMessages: [unrelated] },
    );

    const part = result.content.parts.find(
      p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'tc-3',
    ) as { type: 'tool-invocation'; toolInvocation: { args: unknown; result: unknown } };

    expect(part.toolInvocation.args).toEqual({});
    expect(part.toolInvocation.result).toEqual({ ok: true });
  });

  it('still uses same-message tool-call args when both are present (intra-message path is unchanged)', () => {
    const sameMsg: AIV5ModelMessage = {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: 'tc-4',
          toolName: 'inplace',
          input: { x: 1 } as any,
        },
        {
          type: 'tool-result',
          toolCallId: 'tc-4',
          toolName: 'inplace',
          output: { type: 'json', value: { ok: true } } as any,
        },
      ],
    };

    const result = AIV5Adapter.fromModelMessage(sameMsg);

    const part = result.content.parts.find(
      p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'tc-4',
    ) as { type: 'tool-invocation'; toolInvocation: { args: unknown; result: unknown } };

    expect(part.toolInvocation.args).toEqual({ x: 1 });
    expect(part.toolInvocation.result).toEqual({ ok: true });
  });

  it('recovers args from a prior message that only carries the call on toolInvocations (legacy/restored shape)', () => {
    // Some persisted/restored DB rows only have the call on the flat
    // toolInvocations array, with no matching part in content.parts. The
    // helper must still find them — see CodeRabbit comment on PR #16284.
    const legacyPrior: MastraDBMessage = {
      id: 'msg-legacy',
      role: 'assistant',
      createdAt: new Date('2026-01-01T11:00:00Z'),
      content: {
        format: 2,
        parts: [],
        toolInvocations: [
          {
            toolCallId: 'tc-legacy',
            toolName: 'lookup',
            args: { id: 99 },
            state: 'call',
          },
        ],
      },
    };

    const result = AIV5Adapter.fromModelMessage(
      buildStandaloneToolResult({
        toolCallId: 'tc-legacy',
        toolName: 'lookup',
        output: { name: 'foo' },
      }),
      undefined,
      { memoryInfo: null, previousMessages: [legacyPrior] },
    );

    const part = result.content.parts.find(
      p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'tc-legacy',
    ) as { type: 'tool-invocation'; toolInvocation: { args: unknown; result: unknown } };

    expect(part.toolInvocation.args).toEqual({ id: 99 });
    expect(part.toolInvocation.result).toEqual({ name: 'foo' });
  });

  it('prefers the most recent prior tool-call when multiple messages share the same toolCallId', () => {
    const old = buildPriorToolCallMessage({
      toolCallId: 'tc-5',
      toolName: 'lookup',
      args: { v: 'old' },
    });
    const recent = {
      ...buildPriorToolCallMessage({
        toolCallId: 'tc-5',
        toolName: 'lookup',
        args: { v: 'recent' },
      }),
      id: 'msg-recent',
    };

    const result = AIV5Adapter.fromModelMessage(
      buildStandaloneToolResult({
        toolCallId: 'tc-5',
        toolName: 'lookup',
        output: 'ok',
      }),
      undefined,
      { memoryInfo: null, previousMessages: [old, recent] },
    );

    const part = result.content.parts.find(
      p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'tc-5',
    ) as { type: 'tool-invocation'; toolInvocation: { args: unknown } };

    expect(part.toolInvocation.args).toEqual({ v: 'recent' });
  });
});

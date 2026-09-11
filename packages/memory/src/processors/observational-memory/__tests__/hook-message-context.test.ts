import type { MastraDBMessage } from '@mastra/core/agent';
import { estimateTokenCount } from 'tokenx';
import { describe, expect, it, vi } from 'vitest';

import {
  formatMessagesForExtractorHooks,
  HOOK_MESSAGE_MAX_CHARACTERS,
  HOOK_MESSAGE_MAX_TOKENS,
} from '../hook-message-context';

function message(parts: MastraDBMessage['content']['parts']): MastraDBMessage {
  return { id: 'message', role: 'assistant', createdAt: new Date(0), content: { format: 2, parts } };
}

function expectBounded(text: string) {
  expect(text.length).toBeLessThanOrEqual(HOOK_MESSAGE_MAX_CHARACTERS);
  expect(estimateTokenCount(text)).toBeLessThanOrEqual(HOOK_MESSAGE_MAX_TOKENS);
}

describe('extractor hook message context', () => {
  it.each(['text', 'reasoning', 'tool-call', 'tool-result'])(
    'retains a bounded head and tail for oversized %s',
    kind => {
      const text = 'HEAD_FACT ' + 'inventory '.repeat(200_000) + ' TAIL_FACT';
      const parts: MastraDBMessage['content']['parts'] =
        kind === 'text'
          ? [{ type: 'text', text }]
          : kind === 'reasoning'
            ? [{ type: 'reasoning', reasoning: text, details: [] }]
            : [
                {
                  type: 'tool-invocation',
                  toolInvocation:
                    kind === 'tool-call'
                      ? { state: 'call', toolCallId: 'call', toolName: 'inventory', args: { text } }
                      : { state: 'result', toolCallId: 'call', toolName: 'inventory', args: {}, result: { text } },
                },
              ];
      const stringify = vi.spyOn(JSON, 'stringify');
      try {
        const result = formatMessagesForExtractorHooks([message(parts)]);
        expect(result).toContain('HEAD_FACT');
        expect(result).toContain('TAIL_FACT');
        expect(result).toContain('[middle context omitted]');
        expectBounded(result);
        // No intermediate JSON.stringify call receives the giant value/object.
        expect(
          stringify.mock.calls.every(
            ([value]) =>
              typeof value !== 'object' && (typeof value !== 'string' || value.length <= HOOK_MESSAGE_MAX_CHARACTERS),
          ),
        ).toBe(true);
      } finally {
        stringify.mockRestore();
      }
    },
  );

  it('bounds the whole window rather than granting a budget to every message', () => {
    const messages = Array.from({ length: 2_000 }, (_, index) =>
      message([{ type: 'text', text: `message-${index} ` + 'filler '.repeat(100) }]),
    );
    const result = formatMessagesForExtractorHooks(messages);
    expect(result).toContain('message-0 ');
    expect(result).toContain('message-1999 ');
    expect(result).not.toContain('message-1000 ');
    expect(result).toContain('[middle context omitted]');
    expectBounded(result);
  });

  it('bounds dense Unicode and escaped tool arguments without losing end facts', () => {
    const text = 'HEAD_FACT ' + '漢字🪶\n"\\'.repeat(10_000) + ' TAIL_FACT';
    const result = formatMessagesForExtractorHooks([
      message([
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'call', toolName: 'inventory', args: { text } },
        },
      ]),
    ]);
    expect(result).toContain('HEAD_FACT');
    expect(result).toContain('TAIL_FACT');
    expectBounded(result);
  });

  it('keeps short content intact and excludes encrypted provider payloads', () => {
    const result = formatMessagesForExtractorHooks([
      message([
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call',
            toolName: 'inventory',
            args: { fact: 'PARENT_FACT', encryptedContent: 'SECRET'.repeat(1_000) },
          },
        },
      ]),
    ]);
    expect(result).toContain('PARENT_FACT');
    expect(result).not.toContain('SECRET');
    expect(result).not.toContain('[middle context omitted]');
    expectBounded(result);
  });
});

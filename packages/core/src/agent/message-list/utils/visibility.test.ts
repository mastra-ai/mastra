import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../state/types';
import { filterMessagesByVisibility, isVisiblePart } from './visibility';

const baseMessage = (parts: MastraDBMessage['content']['parts'], id = 'msg-1'): MastraDBMessage => ({
  id,
  role: 'assistant',
  content: { format: 2, parts },
  createdAt: new Date(),
});

describe('isVisiblePart', () => {
  it('returns true when part has no visibility flag', () => {
    expect(isVisiblePart({ type: 'text', text: 'hi' })).toBe(true);
  });

  it('returns true when visibility is explicitly "all"', () => {
    expect(isVisiblePart({ type: 'text', text: 'hi', visibility: 'all' })).toBe(true);
  });

  it('returns false for "llm" parts when filtering for the "all" tier', () => {
    expect(isVisiblePart({ type: 'text', text: 'hidden', visibility: 'llm' })).toBe(false);
  });

  it('keeps explicit "all" parts visible at the "llm" tier', () => {
    // The "llm" tier is a future-facing slot; explicit "all" should still be
    // visible there because "all" is the most permissive flag.
    expect(isVisiblePart({ type: 'text', text: 'all-text', visibility: 'all' }, 'llm')).toBe(true);
    expect(isVisiblePart({ type: 'text', text: 'no-flag' }, 'llm')).toBe(true);
    expect(isVisiblePart({ type: 'text', text: 'llm-text', visibility: 'llm' }, 'llm')).toBe(true);
  });
});

describe('filterMessagesByVisibility', () => {
  it('returns messages unchanged when no parts carry a visibility flag', () => {
    const messages = [
      baseMessage([
        { type: 'text', text: 'plain text' },
        { type: 'text', text: 'more text' },
      ]),
    ];
    const result = filterMessagesByVisibility(messages);
    expect(result).toBe(result);
    expect(result[0]).toBe(messages[0]);
  });

  it('strips parts marked visibility:"llm" while preserving others', () => {
    const messages = [
      baseMessage([
        { type: 'text', text: 'visible' },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId: 'call-1',
            toolName: 'hidden-tool',
            args: {},
          },
          visibility: 'llm',
        },
        { type: 'text', text: 'also visible' },
      ]),
    ];

    const [filtered] = filterMessagesByVisibility(messages);

    expect(filtered).toBeDefined();
    expect(filtered!.content).not.toBe(messages[0]!.content);
    expect(filtered!.content.parts).toHaveLength(2);
    expect(filtered!.content.parts.map(p => p.type)).toEqual(['text', 'text']);
  });

  it('drops messages whose parts are entirely hidden', () => {
    const messages = [
      baseMessage(
        [
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'hidden', args: {} },
            visibility: 'llm',
          },
        ],
        'all-hidden',
      ),
      baseMessage([{ type: 'text', text: 'visible' }], 'mixed'),
    ];

    const result = filterMessagesByVisibility(messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('mixed');
  });

  it('preserves messages with string content unchanged', () => {
    const stringMessage = {
      id: 'string-msg',
      role: 'user' as const,
      content: 'hello' as unknown as MastraDBMessage['content'],
      createdAt: new Date(),
    } as MastraDBMessage;

    const result = filterMessagesByVisibility([stringMessage]);
    expect(result).toEqual([stringMessage]);
  });

  it('recomputes legacy content.content from visible text parts only', () => {
    const messages = [
      {
        ...baseMessage([
          { type: 'text', text: 'visible-1' },
          { type: 'text', text: 'hidden', visibility: 'llm' },
          { type: 'text', text: 'visible-2' },
        ]),
        content: {
          format: 2 as const,
          parts: [
            { type: 'text' as const, text: 'visible-1' },
            { type: 'text' as const, text: 'hidden', visibility: 'llm' as const },
            { type: 'text' as const, text: 'visible-2' },
          ],
          // Legacy aggregated string still includes the hidden text.
          content: 'visible-1\nhidden\nvisible-2',
        },
      },
    ];

    const [filtered] = filterMessagesByVisibility(messages as MastraDBMessage[]);
    expect(filtered).toBeDefined();
    expect(filtered!.content.content).toBe('visible-1\nvisible-2');
  });

  it('omits legacy content.content when input did not carry it', () => {
    const messages = [
      baseMessage([
        { type: 'text', text: 'visible' },
        { type: 'text', text: 'hidden', visibility: 'llm' },
      ]),
    ];

    const [filtered] = filterMessagesByVisibility(messages);
    expect(filtered).toBeDefined();
    expect('content' in filtered!.content).toBe(false);
  });

  it('does not mutate the input messages or parts', () => {
    const originalParts: MastraDBMessage['content']['parts'] = [
      { type: 'text', text: 'visible' },
      { type: 'text', text: 'hidden', visibility: 'llm' },
    ];
    const messages = [baseMessage(originalParts)];

    filterMessagesByVisibility(messages);

    expect(messages[0]!.content.parts).toBe(originalParts);
    expect(messages[0]!.content.parts).toHaveLength(2);
  });

  it('strips hidden tool calls from legacy content.toolInvocations', () => {
    const visibleInvocation = {
      state: 'result' as const,
      toolCallId: 'call-visible',
      toolName: 'searchTool',
      args: { query: 'q' },
      result: 'result',
    };
    const hiddenInvocation = {
      state: 'result' as const,
      toolCallId: 'call-hidden',
      toolName: 'skillsTool',
      args: {},
      result: 'secret',
    };

    const messages = [
      {
        ...baseMessage([
          { type: 'tool-invocation', toolInvocation: visibleInvocation },
          { type: 'tool-invocation', toolInvocation: hiddenInvocation, visibility: 'llm' },
        ]),
        content: {
          format: 2 as const,
          parts: [
            { type: 'tool-invocation' as const, toolInvocation: visibleInvocation },
            {
              type: 'tool-invocation' as const,
              toolInvocation: hiddenInvocation,
              visibility: 'llm' as const,
            },
          ],
          // Legacy mirror of every tool invocation, including the hidden one.
          toolInvocations: [visibleInvocation, hiddenInvocation],
        },
      },
    ];

    const [filtered] = filterMessagesByVisibility(messages as MastraDBMessage[]);
    expect(filtered).toBeDefined();
    expect(filtered!.content.parts).toHaveLength(1);
    expect(filtered!.content.toolInvocations).toEqual([visibleInvocation]);
  });
});

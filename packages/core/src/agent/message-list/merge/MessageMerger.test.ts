import { describe, expect, it } from 'vitest';
import { MessageList } from '../index';
import type { MastraDBMessage, MastraMessageContentV2 } from '../state/types';

type Part = MastraMessageContentV2['parts'][number];

function toolPart(toolCallId: string, state: 'call' | 'result', result?: unknown): Part {
  return {
    type: 'tool-invocation',
    toolInvocation: { state, toolCallId, toolName: 'search', args: {}, ...(state === 'result' ? { result } : {}) },
  } as Part;
}

function assistantMessage(parts: Part[], createdAt: number): MastraDBMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    threadId: 'thread-1',
    createdAt: new Date(createdAt),
    content: { format: 2, parts },
  } as MastraDBMessage;
}

/**
 * Adds a tool call, then a follow-up message carrying that call's result plus
 * `texts`, and returns the text parts in the order they were persisted.
 */
function mergeTextsAfterToolResult(texts: string[]): string[] {
  const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });

  list.add(assistantMessage([{ type: 'step-start' } as Part, toolPart('tc-1', 'call')], 1000), 'response');
  list.add(
    assistantMessage(
      [toolPart('tc-1', 'result', { ok: true }), ...texts.map(text => ({ type: 'text', text }) as Part)],
      2000,
    ),
    'response',
  );

  const merged = list.get.all.db()[0]!;
  return merged.content.parts.filter(part => part.type === 'text').map(part => (part as { text: string }).text);
}

describe('MessageMerger', () => {
  describe('text parts following a tool result', () => {
    it('keeps a single trailing text part', () => {
      expect(mergeTextsAfterToolResult(['Here is the answer.'])).toEqual(['Here is the answer.']);
    });

    // `pushNewPart` injects a `step-start` ahead of the first text part after a
    // tool invocation, inserting two parts where the caller's offset arithmetic
    // assumed one. Every later part was then placed one slot short and spliced
    // in front of the part before it, rotating the run.
    it('keeps two trailing text parts in order', () => {
      expect(mergeTextsAfterToolResult(['Here is the answer. ', 'Hope that helps!'])).toEqual([
        'Here is the answer. ',
        'Hope that helps!',
      ]);
    });

    it.each([2, 3, 4, 5, 6])('keeps %i trailing text parts in order', count => {
      const texts = Array.from({ length: count }, (_, index) => `part-${index}`);
      expect(mergeTextsAfterToolResult(texts)).toEqual(texts);
    });

    it('injects exactly one step-start before the trailing text run', () => {
      const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
      list.add(assistantMessage([{ type: 'step-start' } as Part, toolPart('tc-1', 'call')], 1000), 'response');
      list.add(
        assistantMessage(
          [
            toolPart('tc-1', 'result', { ok: true }),
            { type: 'text', text: 'first' } as Part,
            { type: 'text', text: 'second' } as Part,
          ],
          2000,
        ),
        'response',
      );

      const parts = list.get.all.db()[0]!.content.parts;
      expect(parts.map(part => part.type)).toEqual(['step-start', 'tool-invocation', 'step-start', 'text', 'text']);
    });

    it('records the tool result on the existing call part', () => {
      const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
      list.add(assistantMessage([{ type: 'step-start' } as Part, toolPart('tc-1', 'call')], 1000), 'response');
      list.add(
        assistantMessage([toolPart('tc-1', 'result', { ok: true }), { type: 'text', text: 'done' } as Part], 2000),
        'response',
      );

      const toolInvocation = list.get.all
        .db()[0]!
        .content.parts.find(part => part.type === 'tool-invocation') as Extract<Part, { type: 'tool-invocation' }>;
      expect(toolInvocation.toolInvocation.state).toBe('result');
      expect((toolInvocation.toolInvocation as { result?: unknown }).result).toEqual({ ok: true });
    });
  });
});

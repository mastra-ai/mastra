import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import { messageProse, messageScript, revealedParts } from './reveal';

type MessagePart = MastraDBMessage['content']['parts'][number];

const text = (value: string): MessagePart => ({ type: 'text', text: value });

const tool = (toolCallId: string): MessagePart => ({
  type: 'tool-invocation',
  toolInvocation: { state: 'call', toolCallId, toolName: 'read_file', args: {} },
});

const MARK = messageScript([tool('call-1')]);

describe('revealing a message in the order it was written', () => {
  it('holds back the rows that follow prose still being laid down', () => {
    const parts = [text('Reading the file'), tool('call-1'), text('Done')];

    expect(revealedParts(parts, 'Reading the')).toEqual([text('Reading the')]);
  });

  it('gives a row its own beat after the prose before it, then lets it through', () => {
    const parts = [text('Reading the file'), tool('call-1'), text('Done')];

    expect(revealedParts(parts, 'Reading the file')).toEqual([text('Reading the file')]);
    expect(revealedParts(parts, `Reading the file\n\n${MARK}`)).toEqual([text('Reading the file'), tool('call-1')]);
  });

  it('lands a burst of rows one beat at a time, not as one block', () => {
    const parts = [tool('call-1'), tool('call-2')];

    expect(revealedParts(parts, '')).toEqual([]);
    expect(revealedParts(parts, MARK)).toEqual([tool('call-1')]);
    expect(revealedParts(parts, `${MARK}\n\n${MARK}`)).toEqual([tool('call-1'), tool('call-2')]);
  });

  it('hands back the message untouched once the reveal has caught up', () => {
    const parts = [text('Reading the file'), tool('call-1'), text('Done')];

    expect(revealedParts(parts, messageScript(parts))).toBe(parts);
  });

  it('keeps the copyable prose free of row marks', () => {
    const parts = [text('Reading the file'), tool('call-1'), text('Done')];

    expect(messageProse(parts)).toBe('Reading the file\n\nDone');
  });
});

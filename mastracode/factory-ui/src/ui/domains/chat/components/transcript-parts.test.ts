import { describe, expect, it } from 'vitest';

import { messageText } from './transcript-parts';
import type { MessagePart } from './transcript-parts';

describe('messageText', () => {
  it('keeps the copyable prose free of thinking and tool rows', () => {
    const parts: MessagePart[] = [
      { type: 'reasoning', reasoning: 'Need the core package first', details: [] },
      { type: 'text', text: 'Reading the file' },
      {
        type: 'tool-invocation',
        toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'read_file', args: {} },
      },
      { type: 'text', text: 'Done' },
    ];

    expect(messageText(parts)).toBe('Reading the file\n\nDone');
  });
});

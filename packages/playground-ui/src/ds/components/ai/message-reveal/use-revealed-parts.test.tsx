// @vitest-environment jsdom
import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useRevealedParts } from './message-reveal';

type MessagePart = MastraDBMessage['content']['parts'][number];

const parts: MessagePart[] = [
  { type: 'text', text: 'Reading the file' },
  { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'read_file', args: {} } },
];

describe('useRevealedParts', () => {
  it('draws a message that is not streaming whole, with nothing left to pace', () => {
    const { result } = renderHook(() => useRevealedParts(parts, false));

    expect(result.current).toBe(parts);
  });

  it('starts a streaming message from nothing so its first words are paced', () => {
    const { result } = renderHook(() => useRevealedParts(parts, true));

    expect(result.current).toEqual([]);
  });
});

import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChatTranscriptContext } from '../../context/ChatTranscriptContext';
import type { ChatTranscriptApi } from '../../context/ChatTranscriptContext';
import { initialTranscript } from '../../services/transcript';
import type { TimelineEntry } from '../../services/transcript';
import { ActivityLine } from '../ActivityLine';

const CREATED_AT = new Date('2026-07-15T10:00:00.000Z');

function assistantMessage(parts: MastraDBMessage['content']['parts']): TimelineEntry {
  return {
    kind: 'message',
    id: 'msg-1',
    message: { id: 'msg-1', role: 'assistant', createdAt: CREATED_AT, content: { format: 2, parts } },
  };
}

function userMessage(text: string): TimelineEntry {
  return {
    kind: 'message',
    id: 'msg-0',
    message: {
      id: 'msg-0',
      role: 'user',
      createdAt: CREATED_AT,
      content: { format: 2, parts: [{ type: 'text', text }] },
    },
  };
}

function renderLine(busy: boolean, entries: TimelineEntry[]) {
  const value: ChatTranscriptApi = {
    transcript: { ...initialTranscript, entries },
    busy,
    localUser: () => {},
    reset: () => {},
    resolvePrompt: () => {},
    clearPending: () => {},
    pushNotice: () => {},
    loadMore: { hasMore: false, isLoading: false },
  };
  return render(
    <ChatTranscriptContext.Provider value={value}>
      <ActivityLine />
    </ChatTranscriptContext.Provider>,
  );
}

describe('ActivityLine', () => {
  it('covers the silence between sending and the first output', () => {
    renderLine(true, [userMessage('go on then')]);

    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('steps aside as soon as the run reaches for a tool', () => {
    renderLine(true, [
      userMessage('go on then'),
      assistantMessage([
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'view', args: {} },
        },
      ]),
    ]);

    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });

  it('stays away between two tool calls, where the streamed answer already shows the run is alive', () => {
    renderLine(true, [
      userMessage('go on then'),
      assistantMessage([
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'view', args: {}, result: 'ok' },
        },
        { type: 'text', text: 'Here is what the file holds' },
      ]),
    ]);

    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });

  it('says nothing when the run is idle', () => {
    renderLine(false, [userMessage('go on then')]);

    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });
});

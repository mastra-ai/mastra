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
  it('fills the gap while a run has nothing else to show', () => {
    renderLine(true, []);

    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('steps aside once a running tool row carries the activity', () => {
    renderLine(true, [
      assistantMessage([
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'view', args: {} },
        },
      ]),
    ]);

    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });

  it('returns after that tool finishes, while the run keeps going', () => {
    renderLine(true, [
      assistantMessage([
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'view', args: {}, result: 'ok' },
        },
      ]),
    ]);

    expect(screen.getByText('Thinking')).toBeInTheDocument();
  });

  it('says nothing when the run is idle', () => {
    renderLine(false, []);

    expect(screen.queryByText('Thinking')).not.toBeInTheDocument();
  });
});

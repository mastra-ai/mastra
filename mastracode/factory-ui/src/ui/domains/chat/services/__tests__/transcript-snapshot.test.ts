import { defaultDisplayState } from '@mastra/core/agent-controller';
import type { MastraDBMessage, WireDisplayState } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import { initialTranscript, transcriptReducer } from '../transcript';

const message: MastraDBMessage = {
  id: 'checkout-message',
  role: 'assistant',
  createdAt: new Date('2026-09-08T10:00:00Z'),
  content: { format: 2, parts: [{ type: 'text', text: 'Checking out the pull request.' }] },
};

function snapshot(isRunning: boolean): WireDisplayState {
  return {
    ...defaultDisplayState(),
    activeTools: {},
    toolInputBuffers: {},
    pendingSuspensions: {},
    activeSubagents: {},
    modifiedFiles: {},
    currentMessage: message,
    isRunning,
  };
}

describe('controller display snapshots', () => {
  it('hydrates a message on attachment and settles it even if message_end was missed', () => {
    const attached = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'display_state_changed', displayState: snapshot(true) },
    });
    expect(attached.entries).toMatchObject([{ id: message.id, message, streaming: true }]);

    const finished = transcriptReducer(attached, { type: 'event', event: { type: 'agent_end', reason: 'complete' } });
    expect(finished.entries).toMatchObject([{ id: message.id, streaming: false }]);

    const reconciled = transcriptReducer(finished, { type: 'mergeWindow', messages: [message] });
    expect(reconciled.entries).toHaveLength(1);
    expect(reconciled.entries).toMatchObject([{ id: message.id, streaming: false }]);
  });

  it('keeps a completed message settled while the run is finishing', () => {
    const completed = transcriptReducer(initialTranscript, { type: 'event', event: { type: 'message_end', message } });
    const finishing = transcriptReducer(completed, {
      type: 'event',
      event: { type: 'display_state_changed', displayState: snapshot(true) },
    });
    expect(finishing.entries).toMatchObject([{ id: message.id, streaming: false }]);
  });

  it('reconciles a missed completion from an idle snapshot without duplicating history', () => {
    const streaming = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'message_update', message },
    });
    const reattached = transcriptReducer(streaming, {
      type: 'event',
      event: { type: 'display_state_changed', displayState: snapshot(false) },
    });
    const reconciled = transcriptReducer(reattached, { type: 'mergeWindow', messages: [message] });
    expect(reconciled.pending).toBe(false);
    expect(reconciled.entries).toMatchObject([{ id: message.id, streaming: false }]);
  });
});

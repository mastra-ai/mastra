import type { KnownAgentControllerEvent } from '@mastra/client-js';
import { defaultDisplayState } from '@mastra/core/agent-controller';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { expect, it } from 'vitest';

import { toolFromInvocationPart } from '../../components/transcript-parts';
import { initialTranscript, transcriptReducer } from '../transcript';

it('preserves the native denied outcome through bootstrap and display updates', () => {
  const message: MastraDBMessage = {
    id: 'denied-message',
    role: 'assistant',
    createdAt: new Date(),
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'output-denied',
            toolCallId: 'denied-call',
            toolName: 'execute_command',
            args: { command: 'rm x' },
            approval: { id: 'denied-call', approved: false, reason: 'Rejected by user' },
          },
        },
      ],
    },
  };
  const snapshot: Extract<KnownAgentControllerEvent, { type: 'session_snapshot' }> = {
    type: 'session_snapshot',
    messages: [message],
    streamingMessageId: null,
    displayState: {
      ...defaultDisplayState(),
      currentMessage: message,
      activeTools: {
        'denied-call': {
          name: 'execute_command',
          args: { command: 'rm x' },
          status: 'completed',
          result: 'Rejected by user',
        },
      },
      toolInputBuffers: {},
      pendingSuspensions: {},
      activeSubagents: {},
      modifiedFiles: {},
    },
  };
  const attached = transcriptReducer(initialTranscript, { type: 'event', event: snapshot });
  const updated = transcriptReducer(attached, {
    type: 'event',
    event: { type: 'display_state_changed', displayState: snapshot.displayState },
  });
  for (const state of [attached, updated]) {
    const entry = state.entries[0];
    if (entry.kind !== 'message') throw new Error('Missing message');
    const part = entry.message.content.parts[0];
    if (part.type !== 'tool-invocation') throw new Error('Missing tool');
    expect(toolFromInvocationPart(part, entry.runtimeTools?.['denied-call']).status).toBe('error');
    expect(part).toEqual(message.content.parts[0]);
  }
});

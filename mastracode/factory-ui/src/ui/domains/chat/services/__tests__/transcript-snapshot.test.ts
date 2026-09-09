import type { KnownAgentControllerEvent } from '@mastra/client-js';
import { defaultDisplayState } from '@mastra/core/agent-controller';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import { createInitialTranscript, initialTranscript, transcriptReducer } from '../transcript';

type SessionSnapshot = Extract<KnownAgentControllerEvent, { type: 'session_snapshot' }>;

const promptText = 'Check out this pull request';
const prompt: MastraDBMessage = {
  id: 'checkout-prompt',
  role: 'signal',
  createdAt: new Date('2026-09-08T10:00:00Z'),
  content: {
    format: 2,
    parts: [{ type: 'data-user-message', data: { type: 'user', contents: promptText } }],
    metadata: { signal: { type: 'user' } },
  },
};
const assistant: MastraDBMessage = {
  id: 'checkout-message',
  role: 'assistant',
  createdAt: new Date('2026-09-08T10:00:01Z'),
  content: { format: 2, parts: [{ type: 'text', text: 'Checking out the pull request.' }] },
};
const persistedPrompt: MastraDBMessage = {
  ...prompt,
  content: { ...prompt.content, parts: [{ type: 'text', text: promptText }] },
};
const suspension = {
  toolCallId: 'ask-1',
  toolName: 'ask_user',
  args: { question: 'Which branch?' },
  suspendPayload: { question: 'Which branch?', options: [{ label: 'main' }, { label: 'release' }] },
} satisfies SessionSnapshot['displayState']['pendingSuspensions'][string];
const suspendedAssistant: MastraDBMessage = {
  ...assistant,
  id: 'ask-message',
  content: {
    format: 2,
    parts: [
      {
        type: 'tool-invocation',
        toolInvocation: {
          state: 'call',
          toolCallId: suspension.toolCallId,
          toolName: suspension.toolName,
          args: suspension.args,
        },
      },
    ],
    metadata: { suspendedTools: { 'ask-1': suspension } },
  },
};

function displayState(overrides: Partial<SessionSnapshot['displayState']> = {}): SessionSnapshot['displayState'] {
  return {
    ...defaultDisplayState(),
    activeTools: {},
    toolInputBuffers: {},
    pendingSuspensions: {},
    activeSubagents: {},
    modifiedFiles: {},
    currentMessage: assistant,
    isRunning: true,
    ...overrides,
  };
}

function sessionSnapshot(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    type: 'session_snapshot',
    displayState: displayState(),
    messages: [prompt, assistant],
    streamingMessageId: assistant.id,
    ...overrides,
  };
}

describe('controller session snapshots', () => {
  it('draws the prompt before the running assistant once across snapshot and history reapplication', () => {
    const snapshot = sessionSnapshot();
    const attached = transcriptReducer(initialTranscript, { type: 'event', event: snapshot });
    const hydrated = transcriptReducer(attached, { type: 'mergeWindow', messages: [persistedPrompt, assistant] });
    const reapplied = transcriptReducer(hydrated, { type: 'event', event: snapshot });

    expect(reapplied.entries).toMatchObject([
      {
        id: prompt.id,
        message: { role: 'user', content: { parts: [{ type: 'text', text: promptText }] } },
        streaming: false,
      },
      { id: assistant.id, message: assistant, streaming: true },
    ]);

    const finished = transcriptReducer(reapplied, { type: 'event', event: { type: 'agent_end', reason: 'complete' } });
    expect(finished.entries).toMatchObject([{ streaming: false }, { streaming: false }]);
  });

  it('matches the server prompt to its local optimistic row', () => {
    const local = transcriptReducer(initialTranscript, { type: 'localUser', id: 'local-checkout', text: promptText });
    const attached = transcriptReducer(local, { type: 'event', event: sessionSnapshot() });
    const hydrated = transcriptReducer(attached, { type: 'mergeWindow', messages: [persistedPrompt, assistant] });

    expect(hydrated.entries).toMatchObject([
      { id: 'local-checkout', message: { id: prompt.id, role: 'user' } },
      { id: assistant.id },
    ]);
    expect(hydrated.pending).toBe(false);
  });

  it('inserts a missing prompt before an assistant already loaded from the history window', () => {
    const history = transcriptReducer(initialTranscript, { type: 'mergeWindow', messages: [assistant] });
    const attached = transcriptReducer(history, { type: 'event', event: sessionSnapshot() });

    expect(attached.entries.map(entry => entry.id)).toEqual([prompt.id, assistant.id]);
  });

  it('clears pending when an idle snapshot contains the local prompt and its completed response', () => {
    const local = transcriptReducer(initialTranscript, { type: 'localUser', id: 'local-checkout', text: promptText });
    const attached = transcriptReducer(local, {
      type: 'event',
      event: sessionSnapshot({ displayState: displayState({ isRunning: false }), streamingMessageId: null }),
    });
    const reapplied = transcriptReducer(attached, {
      type: 'event',
      event: sessionSnapshot({ displayState: displayState({ isRunning: false }), streamingMessageId: null }),
    });

    expect(reapplied.pending).toBe(false);
    expect(reapplied.entries).toMatchObject([
      { id: 'local-checkout', streaming: false },
      { id: assistant.id, streaming: false },
    ]);
  });

  it.each(['Now review the tests', promptText])(
    'keeps the later local submission "%s" pending when an old completed snapshot arrives',
    text => {
      const completedSnapshot = sessionSnapshot({
        displayState: displayState({ isRunning: false }),
        streamingMessageId: null,
      });
      const completed = transcriptReducer(initialTranscript, { type: 'event', event: completedSnapshot });
      const local = transcriptReducer(completed, { type: 'localUser', id: 'local-later', text });
      const reattached = transcriptReducer(local, { type: 'event', event: completedSnapshot });

      expect(reattached.pending).toBe(true);
      expect(reattached.entries.map(entry => entry.id)).toEqual([prompt.id, assistant.id, 'local-later']);
    },
  );

  it('uses the explicit streaming id when the last message has already completed', () => {
    const attached = transcriptReducer(initialTranscript, {
      type: 'event',
      event: sessionSnapshot({ streamingMessageId: null }),
    });

    expect(attached.entries).toMatchObject([{ streaming: false }, { id: assistant.id, streaming: false }]);
  });

  it('keeps only the active assistant streaming after rotation and a later signal', () => {
    const rotatedAssistant: MastraDBMessage = {
      ...assistant,
      id: 'review-message',
      content: { format: 2, parts: [{ type: 'text', text: 'Reviewing the tests.' }] },
    };
    const signal: MastraDBMessage = {
      ...prompt,
      id: 'task-update',
      content: {
        format: 2,
        parts: [{ type: 'text', text: 'The checkout is ready.' }],
        metadata: { signal: { type: 'system-reminder' } },
      },
    };
    const attached = transcriptReducer(initialTranscript, {
      type: 'event',
      event: sessionSnapshot({
        messages: [prompt, assistant, rotatedAssistant, signal],
        streamingMessageId: rotatedAssistant.id,
        displayState: displayState({ currentMessage: signal }),
      }),
    });

    expect(attached.entries).toMatchObject([
      { id: prompt.id, streaming: false },
      { id: assistant.id, streaming: false },
      { id: rotatedAssistant.id, streaming: true },
      { id: signal.id, streaming: false },
    ]);
  });

  it('restores approvals and shell output idempotently before appending future output', () => {
    const approval = { toolCallId: 'write-1', toolName: 'write_file', args: { path: 'result.md' } };
    const shellState = displayState({
      activeTools: {
        'checkout-1': {
          name: 'execute_command',
          args: { command: 'gh pr checkout 42' },
          status: 'running',
          shellOutput: '\u001b[32mFetching\u001b[0m\n',
        },
      },
      pendingApproval: approval,
    });
    const snapshot = sessionSnapshot({ displayState: shellState });
    const attached = transcriptReducer(initialTranscript, { type: 'event', event: snapshot });
    const reapplied = transcriptReducer(attached, { type: 'event', event: snapshot });
    const updated = transcriptReducer(reapplied, {
      type: 'event',
      event: { type: 'shell_output', toolCallId: 'checkout-1', output: 'Checked out\n' },
    });
    expect(updated.entries.find(entry => entry.id === assistant.id)).toMatchObject({
      runtimeTools: { 'checkout-1': { output: 'Fetching\nChecked out\n' } },
    });
    const synchronized = transcriptReducer(updated, {
      type: 'event',
      event: {
        type: 'display_state_changed',
        displayState: displayState({
          activeTools: {
            'checkout-1': { ...shellState.activeTools['checkout-1'], shellOutput: 'Fetching\nChecked out\n' },
          },
          pendingApproval: approval,
        }),
      },
    });

    expect(synchronized.entries.filter(entry => entry.kind === 'approval')).toEqual([
      { kind: 'approval', id: 'approval-write-1', ...approval },
    ]);
    expect(synchronized.entries.find(entry => entry.id === assistant.id)).toMatchObject({
      runtimeTools: {
        'checkout-1': {
          toolName: 'execute_command',
          args: { command: 'gh pr checkout 42' },
          status: 'running',
          output: 'Fetching\nChecked out\n',
        },
      },
    });
    expect(synchronized.entries.filter(entry => entry.kind === 'message')).toHaveLength(2);
  });

  it('draws streamed tool arguments before there is a current assistant message', () => {
    const snapshot = sessionSnapshot({
      messages: [],
      streamingMessageId: null,
      displayState: displayState({
        currentMessage: null,
        activeTools: { 'checkout-1': { name: 'execute_command', args: {}, status: 'streaming_input' } },
        toolInputBuffers: { 'checkout-1': { toolName: 'execute_command', text: '{"command":"gh pr checkout' } },
      }),
    });
    const attached = transcriptReducer(initialTranscript, { type: 'event', event: snapshot });
    const reapplied = transcriptReducer(attached, { type: 'event', event: snapshot });

    expect(reapplied.entries).toMatchObject([
      {
        kind: 'message',
        runtimeTools: {
          'checkout-1': { toolName: 'execute_command', argsText: '{"command":"gh pr checkout', status: 'running' },
        },
        message: {
          content: {
            parts: [
              { type: 'tool-invocation', toolInvocation: { toolCallId: 'checkout-1', toolName: 'execute_command' } },
            ],
          },
        },
      },
    ]);
  });

  it('preserves a completed null tool result instead of restoring earlier progress', () => {
    const attached = transcriptReducer(initialTranscript, {
      type: 'event',
      event: sessionSnapshot({
        streamingMessageId: null,
        displayState: displayState({
          isRunning: false,
          activeTools: {
            'checkout-1': {
              name: 'execute_command',
              args: { command: 'gh pr checkout 42' },
              status: 'completed',
              partialResult: 'Fetching the branch',
              result: null,
            },
          },
        }),
      }),
    });

    expect(attached.entries.find(entry => entry.id === assistant.id)).toMatchObject({
      runtimeTools: { 'checkout-1': { status: 'done', result: null } },
    });
  });

  it('restores a retained suspension prompt only once when the session is idle', () => {
    const snapshot = sessionSnapshot({
      messages: [prompt, suspendedAssistant],
      streamingMessageId: null,
      displayState: displayState({
        currentMessage: suspendedAssistant,
        isRunning: false,
        pendingSuspensions: { 'ask-1': suspension },
      }),
    });
    const attached = transcriptReducer(initialTranscript, { type: 'event', event: snapshot });
    const reapplied = transcriptReducer(attached, { type: 'event', event: snapshot });

    expect(reapplied.entries.filter(entry => entry.kind === 'suspension')).toEqual([
      { kind: 'suspension', id: 'suspension-ask-1', ...suspension },
    ]);
    expect(reapplied.entries.filter(entry => entry.kind === 'message')).toHaveLength(2);
  });

  it('removes a cancelled live suspension when the snapshot still contains its tool message', () => {
    const waiting = transcriptReducer(initialTranscript, {
      type: 'event',
      event: { type: 'tool_suspended', ...suspension },
    });
    const reattached = transcriptReducer(waiting, {
      type: 'event',
      event: sessionSnapshot({
        messages: [suspendedAssistant],
        streamingMessageId: null,
        displayState: displayState({ currentMessage: suspendedAssistant, isRunning: false }),
      }),
    });

    expect(reattached.entries.filter(entry => entry.kind === 'suspension')).toEqual([]);
    expect(reattached.entries.filter(entry => entry.kind === 'message')).toHaveLength(1);
  });

  it('preserves a persisted suspension when a fresh controller has no live messages', () => {
    const history = createInitialTranscript({ messages: [suspendedAssistant] });
    const attached = transcriptReducer(history, {
      type: 'event',
      event: sessionSnapshot({
        messages: [],
        streamingMessageId: null,
        displayState: displayState({ currentMessage: null, isRunning: false }),
      }),
    });

    expect(attached.entries.filter(entry => entry.kind === 'suspension')).toEqual([
      { kind: 'suspension', id: 'suspension-ask-1', ...suspension },
    ]);
  });
});

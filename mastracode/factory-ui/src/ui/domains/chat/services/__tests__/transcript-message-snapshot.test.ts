import type { KnownAgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import { defaultDisplayState } from '@mastra/core/agent-controller';
import { expect, it } from 'vitest';

import { createInitialTranscript, transcriptReducer } from '../transcript';

type Snapshot = Extract<KnownAgentControllerEvent, { type: 'display_state_changed' }>;

const prompt: MastraDBMessage = {
  id: 'prompt',
  role: 'signal',
  createdAt: new Date(),
  content: {
    format: 2,
    parts: [{ type: 'data-user-message', data: { id: 'prompt', type: 'user', contents: 'Review this PR' } }],
    metadata: { signal: { id: 'prompt', type: 'user' } },
  },
};
const reply: MastraDBMessage = {
  id: 'reply',
  role: 'assistant',
  createdAt: new Date(),
  content: { format: 2, parts: [{ type: 'text', text: 'Checking out the PR.' }] },
};

function snapshot(overrides: Partial<Snapshot['displayState']> = {}): Snapshot {
  return {
    type: 'display_state_changed',
    displayState: {
      ...defaultDisplayState(),
      isRunning: true,
      currentMessage: reply,
      messages: [
        { message: prompt, streaming: false },
        { message: reply, streaming: true },
      ],
      activeTools: {},
      toolInputBuffers: {},
      pendingSuspensions: {},
      activeSubagents: {},
      modifiedFiles: {},
      ...overrides,
    },
  };
}

it('restores the prompt before an already visible reply and deduplicates repeated snapshots and history', () => {
  let state = createInitialTranscript({ messages: [reply] });
  state = transcriptReducer(state, { type: 'event', event: snapshot() });
  state = transcriptReducer(state, { type: 'event', event: snapshot() });
  state = transcriptReducer(state, { type: 'mergeWindow', messages: [prompt, reply] });
  expect(state.entries).toMatchObject([
    { kind: 'message', message: { role: 'user', content: { parts: [{ type: 'text', text: 'Review this PR' }] } } },
    { kind: 'message', message: { id: 'reply' } },
  ]);
});

it.each(['', 'Checking out'])('fills a known reply whose text was %j without waiting for another live event', text => {
  const partial: MastraDBMessage = { ...reply, content: { format: 2, parts: [{ type: 'text', text }] } };
  const state = transcriptReducer(createInitialTranscript({ messages: [partial] }), {
    type: 'event',
    event: snapshot(),
  });
  expect(state.entries).toContainEqual(
    expect.objectContaining({
      message: expect.objectContaining({ content: reply.content }),
    }),
  );
});

it('preserves newer live text when an older snapshot arrives', () => {
  const newer: MastraDBMessage = {
    ...reply,
    content: { format: 2, parts: [{ type: 'text', text: 'Checking out the PR. Done.' }] },
  };
  let state = transcriptReducer(createInitialTranscript(), {
    type: 'event',
    event: { type: 'message_update', message: newer },
  });
  state = transcriptReducer(state, { type: 'event', event: snapshot() });
  expect(state.entries).toContainEqual(expect.objectContaining({ message: newer, streaming: true }));
});

it('settles a reply when its completion was missed, including after history reconciliation', () => {
  let state = transcriptReducer(createInitialTranscript(), {
    type: 'event',
    event: { type: 'message_update', message: reply },
  });
  state = transcriptReducer(state, { type: 'event', event: snapshot({ isRunning: false }) });
  state = transcriptReducer(state, { type: 'mergeWindow', messages: [prompt, reply] });
  expect(state.entries.filter(entry => entry.kind === 'message').every(entry => !entry.streaming)).toBe(true);
});

it('keeps a finished message settled when another message in the run is still streaming', () => {
  const nextReply: MastraDBMessage = { ...reply, id: 'next-reply' };
  const state = transcriptReducer(createInitialTranscript(), {
    type: 'event',
    event: snapshot({
      currentMessage: nextReply,
      messages: [
        { message: prompt, streaming: false },
        { message: reply, streaming: false },
        { message: nextReply, streaming: true },
      ],
    }),
  });
  expect(state.entries).toMatchObject([{ streaming: false }, { streaming: false }, { streaming: true }]);
});

it('reconciles the composer echo with the restored prompt and its later live echo', () => {
  let state = transcriptReducer(createInitialTranscript(), { type: 'localUser', text: 'Review this PR' });
  state = transcriptReducer(state, { type: 'event', event: snapshot() });
  state = transcriptReducer(state, { type: 'event', event: { type: 'message_end', message: prompt } });
  state = transcriptReducer(state, { type: 'mergeWindow', messages: [prompt, reply] });
  const userEntries = state.entries.filter(entry => entry.kind === 'message' && entry.message.role === 'user');
  expect(userEntries).toHaveLength(1);
  expect(userEntries[0]).toMatchObject({
    message: { id: 'prompt', content: { parts: [{ type: 'text', text: 'Review this PR' }] } },
  });
});

it('accepts snapshots from older servers without the run messages field', () => {
  const state = transcriptReducer(createInitialTranscript(), {
    type: 'event',
    event: snapshot({ messages: undefined, isRunning: false }),
  });
  expect(state.entries).toMatchObject([{ message: reply, streaming: false }]);
});

it('keeps repeated prompts and replies from separate runs as separate messages', () => {
  const previousPrompt: MastraDBMessage = { ...prompt, id: 'previous-prompt' };
  const previousReply: MastraDBMessage = { ...reply, id: 'previous-reply' };
  let state = createInitialTranscript({ messages: [previousPrompt, previousReply] });
  state = transcriptReducer(state, { type: 'event', event: snapshot() });
  state = transcriptReducer(state, { type: 'event', event: snapshot() });
  expect(state.entries.map(entry => entry.kind === 'message' && entry.message.id)).toEqual([
    'previous-prompt',
    'previous-reply',
    'prompt',
    'reply',
  ]);
});

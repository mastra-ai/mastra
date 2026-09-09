import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { SessionDisplayState } from './session';
import { createEmptyTokenUsage } from './types';

function createDisplayState() {
  return new SessionDisplayState({
    getTokenUsage: createEmptyTokenUsage,
    getSubagentDisplayName: () => undefined,
    getThreadId: () => 'thread-1',
    clearFollowUps: () => {},
  });
}

function createMessage(id: string, role: MastraDBMessage['role'] = 'assistant'): MastraDBMessage {
  return {
    id,
    role,
    createdAt: new Date('2026-09-09T00:00:00Z'),
    content: { format: 2, parts: [{ type: 'text', text: id }] },
  };
}

describe('session display snapshot', () => {
  it('includes the initiating prompt and earlier responses in order when joining a running tool', () => {
    const displayState = createDisplayState();
    const prompt = createMessage('Check out this pull request', 'signal');
    const earlierResponse = createMessage('Checking the branch');
    const currentResponse = createMessage('Running checkout');
    currentResponse.content.parts.push({
      type: 'tool-invocation',
      toolInvocation: { state: 'call', toolCallId: 'checkout-1', toolName: 'checkout', args: {} },
    });

    displayState.apply({ type: 'agent_start' });
    displayState.apply({ type: 'message_start', message: prompt });
    displayState.apply({ type: 'message_end', message: prompt });
    displayState.apply({ type: 'message_update', message: earlierResponse });
    displayState.apply({ type: 'message_end', message: earlierResponse });
    displayState.apply({ type: 'message_update', message: currentResponse });
    displayState.apply({ type: 'message_update', message: currentResponse });
    displayState.apply({ type: 'tool_start', toolCallId: 'checkout-1', toolName: 'checkout', args: {} });

    const snapshot = displayState.snapshot();
    expect(snapshot.messages).toEqual([prompt, earlierResponse, currentResponse]);
    expect(snapshot.messages[2]).toBe(displayState.get().currentMessage);
    expect(snapshot.streamingMessageId).toBe(currentResponse.id);
    expect(snapshot.displayState.activeTools.get('checkout-1')?.status).toBe('running');
  });

  it('marks an ended message complete before the agent finishes', () => {
    const displayState = createDisplayState();
    const response = createMessage('Checkout complete');
    displayState.apply({ type: 'agent_start' });
    displayState.apply({ type: 'message_update', message: response });
    displayState.apply({ type: 'message_end', message: response });
    displayState.apply({ type: 'message_end', message: response });

    expect(displayState.snapshot()).toMatchObject({
      displayState: { isRunning: true },
      messages: [response],
      streamingMessageId: null,
    });
  });

  it('preserves a streaming assistant when an interleaved signal becomes the latest message', () => {
    const displayState = createDisplayState();
    const response = createMessage('Working');
    const signal = createMessage('Updated context', 'signal');
    displayState.apply({ type: 'agent_start' });
    displayState.apply({ type: 'message_update', message: response });
    displayState.apply({ type: 'message_start', message: signal });
    displayState.apply({ type: 'message_end', message: signal });

    expect(displayState.snapshot()).toMatchObject({
      messages: [response, signal],
      streamingMessageId: response.id,
    });
    expect(displayState.get().currentMessage).toBe(signal);
  });

  it.each(['complete', 'error', 'suspended'] as const)(
    'retains completed messages after %s until the next run starts',
    reason => {
      const displayState = createDisplayState();
      const prompt = createMessage('Prompt', 'signal');
      const response = createMessage('Response');
      displayState.apply({ type: 'agent_start' });
      displayState.apply({ type: 'message_end', message: prompt });
      displayState.apply({ type: 'message_update', message: response });
      displayState.apply({ type: 'message_end', message: response });
      displayState.apply({ type: 'agent_end', reason });

      expect(displayState.snapshot()).toMatchObject({
        displayState: { isRunning: false },
        messages: [prompt, response],
        streamingMessageId: null,
      });

      displayState.apply({ type: 'agent_start' });
      expect(displayState.snapshot()).toMatchObject({
        displayState: { currentMessage: null },
        messages: [],
        streamingMessageId: null,
      });
    },
  );

  it('does not expose the previous thread transcript after switching threads', () => {
    const displayState = createDisplayState();
    displayState.apply({ type: 'agent_start' });
    displayState.apply({ type: 'message_end', message: createMessage('Old prompt', 'signal') });
    displayState.apply({ type: 'message_update', message: createMessage('Old response') });
    displayState.apply({ type: 'thread_changed', threadId: 'thread-2', previousThreadId: 'thread-1' });

    expect(displayState.snapshot()).toMatchObject({
      displayState: { currentMessage: null },
      messages: [],
      streamingMessageId: null,
    });
  });
});

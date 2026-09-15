import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { createSignal } from '@mastra/core/signals';
import { describe, expect, it } from 'vitest';

import {
  getAssistantRenderParts,
  getMessageText,
  getNotificationSummaryView,
  getNotificationView,
  getReactiveSignalView,
  getReminderView,
  getSignalContentsText,
  getSignalKind,
  getSignalView,
  getStateSignalView,
  isSignalMessage,
} from './db-message-parts.js';

function signalMessage(input: Parameters<typeof createSignal>[0]): MastraDBMessage {
  return createSignal(input).toDBMessage();
}

function assistantMessage(parts: MastraDBMessage['content']['parts']): MastraDBMessage {
  return {
    id: 'a1',
    role: 'assistant',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    content: { format: 2, parts },
  } as MastraDBMessage;
}

describe('getMessageText', () => {
  it('joins text parts and ignores non-text parts', () => {
    const message = assistantMessage([
      { type: 'text', text: 'hello' },
      { type: 'reasoning', reasoning: 'thinking', details: [] } as never,
      { type: 'text', text: 'world' },
    ]);

    expect(getMessageText(message)).toBe('hello\nworld');
  });
});

describe('getAssistantRenderParts', () => {
  it('maps a text part to a text render item', () => {
    const message = assistantMessage([{ type: 'text', text: 'hi' }]);
    expect(getAssistantRenderParts(message)).toEqual([{ kind: 'text', text: 'hi' }]);
  });

  it('maps a reasoning part to a thinking render item', () => {
    const message = assistantMessage([{ type: 'reasoning', reasoning: 'why', details: [] } as never]);
    expect(getAssistantRenderParts(message)).toEqual([{ kind: 'thinking', text: 'why' }]);
  });

  it('maps a tool-invocation part to a tool render item with result', () => {
    const message = assistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-1',
          toolName: 'view',
          args: { path: 'a.ts' },
          state: 'result',
          result: 'ok',
        },
      } as never,
    ]);

    expect(getAssistantRenderParts(message)).toEqual([
      {
        kind: 'tool',
        toolCallId: 'call-1',
        toolName: 'view',
        args: { path: 'a.ts' },
        result: 'ok',
        hasResult: true,
        isError: false,
      },
    ]);
  });

  it('uses canonical tool error metadata for completed tool render items', () => {
    const message = assistantMessage([
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-1',
          toolName: 'view',
          args: { path: 'a.ts' },
          state: 'result',
          result: 'ok',
          isError: true,
        },
      } as never,
    ]);

    expect(getAssistantRenderParts(message)).toEqual([
      {
        kind: 'tool',
        toolCallId: 'call-1',
        toolName: 'view',
        args: { path: 'a.ts' },
        result: 'ok',
        hasResult: true,
        isError: true,
      },
    ]);
  });

  it('maps a data-om-observation-end part to an om render item', () => {
    const message = assistantMessage([
      {
        type: 'data-om-observation-end',
        data: { operationType: 'observation', observations: 'obs', durationMs: 5 },
      } as never,
    ]);

    const parts = getAssistantRenderParts(message);
    expect(parts).toEqual([
      {
        kind: 'om',
        event: 'end',
        operationType: 'observation',
        data: { operationType: 'observation', observations: 'obs', durationMs: 5 },
      },
    ]);
  });
});

describe('signal messages', () => {
  it('detects signal-role messages', () => {
    const signal = createSignal({ type: 'reactive', tagName: 'system-reminder', contents: 'continue' });
    const dbMessage = signal.toDBMessage();
    expect(isSignalMessage(dbMessage)).toBe(true);
  });

  it('reconstructs the signal view from a signal DB message', () => {
    const signal = createSignal({
      type: 'reactive',
      tagName: 'system-reminder',
      contents: 'continue',
      attributes: { status: 'pending' },
      metadata: { reminderType: 'anthropic-prefill-processor-retry' },
    });
    const dbMessage = signal.toDBMessage();

    const view = getSignalView(dbMessage);
    expect(view).toMatchObject({
      type: 'reactive',
      tagName: 'system-reminder',
      attributes: { status: 'pending' },
      metadata: { reminderType: 'anthropic-prefill-processor-retry' },
    });
  });

  it('reads the text contents of a signal message', () => {
    const dbMessage = signalMessage({ type: 'reactive', tagName: 'system-reminder', contents: 'continue please' });
    expect(getSignalContentsText(dbMessage)).toBe('continue please');
  });
});

describe('getSignalKind', () => {
  it.each([
    [{ type: 'state', tagName: 'x', contents: 'v', metadata: { state: { id: 'x' } } } as never, 'state'],
    [{ type: 'reactive', tagName: 'system-reminder', contents: 'r' }, 'reminder'],
    [{ type: 'notification', tagName: 'notification-summary', contents: 's' } as never, 'notification-summary'],
    [{ type: 'notification', tagName: 'notification', contents: 'n' } as never, 'notification'],
    [{ type: 'reactive', tagName: 'custom-tag', contents: 'c' }, 'reactive'],
    [{ type: 'user', tagName: 'user', contents: 'hi' }, 'user'],
  ])('classifies %o as %s', (input, expected) => {
    const dbMessage = signalMessage(input as Parameters<typeof createSignal>[0]);
    expect(getSignalKind(dbMessage)).toBe(expected);
  });
});

describe('getReminderView', () => {
  it('extracts reminder fields from a system-reminder signal', () => {
    const dbMessage = signalMessage({
      type: 'reactive',
      tagName: 'system-reminder',
      contents: 'File changed on disk',
      attributes: { type: 'file-changed', path: 'src/a.ts' },
    });

    expect(getReminderView(dbMessage)).toMatchObject({
      reminderType: 'file-changed',
      path: 'src/a.ts',
      message: 'File changed on disk',
    });
  });

  it('reads goal-judge evaluation from metadata', () => {
    const dbMessage = signalMessage({
      type: 'reactive',
      tagName: 'system-reminder',
      contents: '',
      attributes: { type: 'goal-judge' },
      metadata: { goalMaxTurns: 12, judgeModelId: 'anthropic/claude-x' },
    });

    expect(getReminderView(dbMessage)).toMatchObject({
      reminderType: 'goal-judge',
      goalMaxTurns: 12,
      judgeModelId: 'anthropic/claude-x',
    });
  });
});

describe('getStateSignalView', () => {
  it('extracts stateId/mode/version from state signal metadata', () => {
    const dbMessage = signalMessage({
      type: 'state',
      tagName: 'my-state',
      contents: '<current-task-list />',
      metadata: { state: { id: 'my-state', mode: 'snapshot', version: 3 } },
    } as never);

    expect(getStateSignalView(dbMessage)).toMatchObject({
      stateId: 'my-state',
      mode: 'snapshot',
      version: 3,
      message: '<current-task-list />',
    });
  });
});

describe('getReactiveSignalView', () => {
  it('extracts tagName and message from a reactive signal', () => {
    const dbMessage = signalMessage({
      type: 'reactive',
      tagName: 'my-tag',
      contents: 'hello reactive',
    });

    expect(getReactiveSignalView(dbMessage)).toMatchObject({
      tagName: 'my-tag',
      message: 'hello reactive',
    });
  });
});

describe('getNotificationView', () => {
  it('extracts notification fields from attributes', () => {
    const dbMessage = signalMessage({
      type: 'reactive',
      tagName: 'notification',
      contents: 'Build finished',
      attributes: { source: 'ci', kind: 'build', priority: 'high', status: 'delivered' },
    });

    expect(getNotificationView(dbMessage)).toMatchObject({
      message: 'Build finished',
      source: 'ci',
      kind: 'build',
      priority: 'high',
      status: 'delivered',
    });
  });
});

describe('getNotificationSummaryView', () => {
  it('extracts pending count and bySource from metadata', () => {
    const dbMessage = signalMessage({
      type: 'reactive',
      tagName: 'notification-summary',
      contents: '2 pending notifications',
      metadata: { notificationSummary: { pending: 2, bySource: { ci: 1, chat: 1 } } },
    });

    expect(getNotificationSummaryView(dbMessage)).toMatchObject({
      message: '2 pending notifications',
      pending: 2,
      bySource: { ci: 1, chat: 1 },
    });
  });
});

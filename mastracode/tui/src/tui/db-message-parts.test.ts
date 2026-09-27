import { accountSwitchNoticeText } from '@mastra/code-sdk/auth/account-rotation-processor';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { createSignal } from '@mastra/core/signals';
import { describe, expect, it } from 'vitest';

import {
  collectCommandExits,
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

  it('renders a persisted account-switch part with a malformed to endpoint as unknown, not pool exhaustion', () => {
    const message = assistantMessage([
      {
        type: 'data-mastracode-account-switch',
        data: {
          provider: 'kimi-for-coding',
          from: { id: 'kimi-for-coding:aaaa', label: 'Work' },
          to: { id: 'kimi-for-coding:bbbb' }, // label lost to schema drift
          reason: 'rate-limit',
          at: '2026-09-17T00:00:00.000Z',
        },
      } as never,
    ]);

    const parts = getAssistantRenderParts(message);
    expect(parts).toEqual([
      {
        kind: 'account-switch',
        provider: 'kimi-for-coding',
        from: { id: 'kimi-for-coding:aaaa', label: 'Work' },
        to: { id: 'unknown', label: 'unknown' },
        reason: 'rate-limit',
        at: '2026-09-17T00:00:00.000Z',
      },
    ]);
  });

  it.each([
    ['a string', 'kimi-for-coding:bbbb'],
    ['a number', 7],
    ['a boolean', true],
  ])('renders a non-object to endpoint (%s) as unknown, not pool exhaustion', (_label, to) => {
    const message = assistantMessage([
      {
        type: 'data-mastracode-account-switch',
        data: {
          provider: 'kimi-for-coding',
          from: { id: 'kimi-for-coding:aaaa', label: 'Work' },
          to,
          reason: 'rate-limit',
          at: '2026-09-17T00:00:00.000Z',
        },
      } as never,
    ]);

    const parts = getAssistantRenderParts(message);
    expect(parts).toEqual([
      {
        kind: 'account-switch',
        provider: 'kimi-for-coding',
        from: { id: 'kimi-for-coding:aaaa', label: 'Work' },
        to: { id: 'unknown', label: 'unknown' },
        reason: 'rate-limit',
        at: '2026-09-17T00:00:00.000Z',
      },
    ]);
    // `null` alone means "no usable account" — an unknown endpoint must not
    // read as pool exhaustion.
    expect(accountSwitchNoticeText(parts[0] as never)).not.toMatch(/unavailable/);
  });

  it('re-renders a persisted pinned-account exhaustion as pinned, not the whole pool', () => {
    const message = assistantMessage([
      {
        type: 'data-mastracode-account-switch',
        data: {
          provider: 'kimi-for-coding',
          from: { id: 'kimi-for-coding:bbbb', label: 'Personal' },
          to: null,
          reason: 'pool-exhausted',
          at: '2026-09-17T00:00:00.000Z',
          exclusive: true,
        },
      } as never,
    ]);

    const parts = getAssistantRenderParts(message);
    // The flag must survive history parsing: dropping it would re-render a
    // route that consulted one account as if the pool had been walked (A12).
    expect(parts).toEqual([
      {
        kind: 'account-switch',
        provider: 'kimi-for-coding',
        from: { id: 'kimi-for-coding:bbbb', label: 'Personal' },
        to: null,
        reason: 'pool-exhausted',
        at: '2026-09-17T00:00:00.000Z',
        exclusive: true,
      },
    ]);
    expect(accountSwitchNoticeText(parts[0] as never)).toBe('Pinned Kimi account unavailable (pool exhausted)');
  });

  it('keeps an explicit null to endpoint rendering as pool exhaustion', () => {
    const message = assistantMessage([
      {
        type: 'data-mastracode-account-switch',
        data: {
          provider: 'kimi-for-coding',
          from: { id: 'kimi-for-coding:aaaa', label: 'Work' },
          to: null,
          reason: 'rate-limit',
          at: '2026-09-17T00:00:00.000Z',
        },
      } as never,
    ]);

    const parts = getAssistantRenderParts(message);
    expect(parts).toEqual([
      {
        kind: 'account-switch',
        provider: 'kimi-for-coding',
        from: { id: 'kimi-for-coding:aaaa', label: 'Work' },
        to: null,
        reason: 'rate-limit',
        at: '2026-09-17T00:00:00.000Z',
      },
    ]);
  });

  it('drops a persisted pack-fallback part whose reason is not a pack-fallback reason', () => {
    const message = assistantMessage([
      {
        type: 'data-mastracode-pack-fallback',
        data: {
          from: { packId: 'custom:Daily', label: 'Daily' },
          to: { packId: 'anthropic', label: 'Anthropic' },
          // A valid *account-switch* reason that this part must not accept —
          // `packFallbackNoticeText` would render it as "rate limit".
          reason: 'rate-limit',
          at: '2026-09-17T00:00:00.000Z',
        },
      } as never,
    ]);

    expect(getAssistantRenderParts(message)).toEqual([]);
  });

  it.each(['pool-exhausted', 'persistent-outage'] as const)(
    'keeps a persisted pack-fallback part with reason %s',
    reason => {
      const message = assistantMessage([
        {
          type: 'data-mastracode-pack-fallback',
          data: {
            from: { packId: 'custom:Daily', label: 'Daily' },
            to: { packId: 'anthropic', label: 'Anthropic' },
            reason,
            at: '2026-09-17T00:00:00.000Z',
          },
        } as never,
      ]);

      expect(getAssistantRenderParts(message)).toEqual([
        {
          kind: 'pack-fallback',
          from: { packId: 'custom:Daily', label: 'Daily' },
          to: { packId: 'anthropic', label: 'Anthropic' },
          reason,
          at: '2026-09-17T00:00:00.000Z',
        },
      ]);
    },
  );

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

  it('recovers tool run time from the parts around an unstamped tool invocation', () => {
    const tool = (toolCallId: string) =>
      ({
        type: 'tool-invocation',
        toolInvocation: { toolCallId, toolName: 'execute_command', args: {}, state: 'result', result: 'ok' },
      }) as never;
    // Shape of a real persisted shell call: tool data parts stream while it runs, the next step starts after it.
    const message = assistantMessage([
      tool('call-1'),
      { type: 'data-workspace-metadata', data: {}, createdAt: 1_000 } as never,
      { type: 'data-sandbox-exit', data: {}, createdAt: 4_028 } as never,
      { type: 'step-start', createdAt: 4_078 } as never,
      tool('call-2'),
      { type: 'text', text: 'done', createdAt: 4_500 } as never,
      tool('call-3'),
    ]);

    const tools = getAssistantRenderParts(message).filter(part => part.kind === 'tool');
    expect(tools.map(part => [part.startedAt, part.endedAt])).toEqual([
      [1_000, 4_078],
      [4_078, 4_500],
      [undefined, undefined],
    ]);
  });

  it('collects sandbox exit records across the thread, including ones saved in a later message', () => {
    const exit = (toolCallId: string, data: Record<string, unknown>) =>
      ({ type: 'data-sandbox-exit', data: { toolCallId, ...data }, createdAt: 1 }) as never;
    const exits = collectCommandExits([
      assistantMessage([exit('call-1', { exitCode: 0, success: true, executionTimeMs: 8_746 })]),
      assistantMessage([
        { type: 'step-start' } as never,
        exit('call-2', { exitCode: -1, success: false, executionTimeMs: 12 }),
        exit('call-3', { exitCode: 2 }),
        exit('call-4', { success: true }),
      ]),
    ]);
    expect(Object.fromEntries(exits)).toEqual({
      'call-1': { exitCode: 0, success: true, executionTimeMs: 8_746 },
      'call-2': { exitCode: -1, success: false, executionTimeMs: 12 },
      'call-3': { exitCode: 2, success: false },
    });
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

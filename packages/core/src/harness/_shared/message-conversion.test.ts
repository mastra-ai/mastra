import { describe, expect, it } from 'vitest';

import { signalToMastraDBMessage } from '../../agent/signals';
import { convertStoredMessageToHarnessMessage } from './message-conversion';
import type { StoredMessageRow } from './message-conversion';

function convert(message: StoredMessageRow) {
  return convertStoredMessageToHarnessMessage(message);
}

describe('convertStoredMessageToHarnessMessage', () => {
  it('normalizes persisted user-message signal rows into user Harness messages', () => {
    const message = signalToMastraDBMessage(
      {
        id: 'signal-user-1',
        type: 'user-message',
        contents: {
          role: 'user',
          content: [
            { type: 'text', text: 'hello from signal' },
            { type: 'file', data: 'data:image/png;base64,abc', mediaType: 'image/png' },
          ],
        },
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
      },
      { threadId: 'thread-1', resourceId: 'resource-1' },
    );

    expect(convert(message)).toEqual({
      id: 'signal-user-1',
      role: 'user',
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
      content: [
        { type: 'text', text: 'hello from signal' },
        { type: 'image', data: 'data:image/png;base64,abc', mimeType: 'image/png' },
      ],
    });
  });

  it('normalizes persisted system-reminder signal rows into user Harness messages', () => {
    const message = signalToMastraDBMessage(
      {
        id: 'signal-reminder-1',
        type: 'system-reminder',
        contents: 'continue after gap',
        attributes: { reminderType: 'temporal-gap', path: '/tmp/project', gapMs: 2500 },
        metadata: { goalMaxTurns: 5, judgeModelId: '__GATEWAY_OPENAI_MODEL_MINI__' },
        createdAt: new Date('2026-05-01T00:00:01.000Z'),
      },
      { threadId: 'thread-1', resourceId: 'resource-1' },
    );

    expect(convert(message)).toEqual({
      id: 'signal-reminder-1',
      role: 'user',
      createdAt: new Date('2026-05-01T00:00:01.000Z'),
      content: [
        {
          type: 'system_reminder',
          message: 'continue after gap',
          reminderType: 'temporal-gap',
          path: '/tmp/project',
          precedesMessageId: undefined,
          gapText: undefined,
          gapMs: 2500,
          timestamp: undefined,
          goalMaxTurns: 5,
          judgeModelId: '__GATEWAY_OPENAI_MODEL_MINI__',
        },
      ],
    });
  });

  it('falls back to stored text parts for legacy metadata-only system-reminder signal rows', () => {
    const message: StoredMessageRow = {
      id: 'legacy-reminder-signal',
      role: 'signal',
      createdAt: new Date('2026-05-01T00:00:01.500Z'),
      content: {
        parts: [{ type: 'text', text: 'legacy reminder text' }],
        metadata: {
          signal: {
            type: 'system-reminder',
            attributes: { reminderType: 'legacy-reminder' },
          },
        },
      },
    };

    expect(convertStoredMessageToHarnessMessage(message)).toEqual({
      id: 'legacy-reminder-signal',
      role: 'user',
      createdAt: new Date('2026-05-01T00:00:01.500Z'),
      content: [
        {
          type: 'system_reminder',
          message: 'legacy reminder text',
          reminderType: 'legacy-reminder',
          path: undefined,
          precedesMessageId: undefined,
          gapText: undefined,
          gapMs: undefined,
          timestamp: undefined,
          goalMaxTurns: undefined,
          judgeModelId: undefined,
        },
      ],
    });
  });

  it('reads data-system-reminder contents and attributes from UI data parts', () => {
    const message: StoredMessageRow = {
      id: 'message-with-reminder-part',
      role: 'assistant',
      createdAt: new Date('2026-05-01T00:00:02.000Z'),
      content: {
        parts: [
          {
            type: 'data-system-reminder',
            data: {
              id: 'data-reminder-1',
              type: 'system-reminder',
              contents: 'remember this constraint',
              attributes: {
                type: 'dynamic-agents-md',
                path: '/tmp/AGENTS.md',
                precedesMessageId: 'next-message',
              },
              metadata: { reminderType: 'metadata-reminder', judgeModelId: '__GATEWAY_OPENAI_MODEL_MINI__' },
            },
          },
        ],
      },
    };

    expect(convertStoredMessageToHarnessMessage(message)).toEqual({
      id: 'message-with-reminder-part',
      role: 'assistant',
      createdAt: new Date('2026-05-01T00:00:02.000Z'),
      content: [
        {
          type: 'system_reminder',
          message: 'remember this constraint',
          reminderType: 'dynamic-agents-md',
          path: '/tmp/AGENTS.md',
          precedesMessageId: 'next-message',
          gapText: undefined,
          gapMs: undefined,
          timestamp: undefined,
          goalMaxTurns: undefined,
          judgeModelId: '__GATEWAY_OPENAI_MODEL_MINI__',
        },
      ],
    });
  });

  it('uses system-reminder metadata reminderType when attributes do not name one', () => {
    const message: StoredMessageRow = {
      id: 'metadata-reminder-part',
      role: 'assistant',
      createdAt: new Date('2026-05-01T00:00:02.500Z'),
      content: {
        parts: [
          {
            type: 'data-system-reminder',
            data: {
              type: 'system-reminder',
              contents: 'metadata reminder text',
              metadata: { reminderType: 'metadata-reminder' },
            },
          },
        ],
      },
    };

    expect(convertStoredMessageToHarnessMessage(message).content).toEqual([
      {
        type: 'system_reminder',
        message: 'metadata reminder text',
        reminderType: 'metadata-reminder',
        path: undefined,
        precedesMessageId: undefined,
        gapText: undefined,
        gapMs: undefined,
        timestamp: undefined,
        goalMaxTurns: undefined,
        judgeModelId: undefined,
      },
    ]);
  });

  it('emits completed tool invocation results even when the result payload is omitted', () => {
    const message: StoredMessageRow = {
      id: 'assistant-tool-resultless',
      role: 'assistant',
      createdAt: new Date('2026-05-01T00:00:03.000Z'),
      content: {
        parts: [
          {
            type: 'tool-invocation',
            providerMetadata: { provider: { traceId: 'trace-1' } },
            toolInvocation: {
              state: 'result',
              toolCallId: 'call-1',
              toolName: 'lookup',
              args: { query: 'x' },
            },
          },
        ],
      },
    };

    expect(convertStoredMessageToHarnessMessage(message).content).toEqual([
      { type: 'tool_call', id: 'call-1', name: 'lookup', args: { query: 'x' } },
      {
        type: 'tool_result',
        id: 'call-1',
        name: 'lookup',
        result: undefined,
        isError: false,
        providerMetadata: { provider: { traceId: 'trace-1' } },
      },
    ]);
  });

  it('preserves provider metadata on tool-result parts', () => {
    const message: StoredMessageRow = {
      id: 'assistant-tool-result',
      role: 'assistant',
      createdAt: new Date('2026-05-01T00:00:04.000Z'),
      content: {
        parts: [
          {
            type: 'tool-result',
            toolCallId: 'call-2',
            toolName: 'lookup',
            result: { ok: true },
            providerMetadata: { provider: { traceId: 'trace-2' } },
          },
        ],
      },
    };

    expect(convertStoredMessageToHarnessMessage(message).content).toEqual([
      {
        type: 'tool_result',
        id: 'call-2',
        name: 'lookup',
        result: { ok: true },
        isError: false,
        providerMetadata: { provider: { traceId: 'trace-2' } },
      },
    ]);
  });
});

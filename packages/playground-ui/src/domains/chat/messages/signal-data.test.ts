import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { describe, expect, it } from 'vitest';

import {
  formatSignalValue,
  getNotificationMetadata,
  getSignalType,
  isRecord,
  isSignalData,
  isUserSignalType,
  signalContentsToText,
  toReactiveSignalData,
} from './signal-data';

const buildSignalMessage = (overrides: Partial<MastraDBMessage> = {}): MastraDBMessage =>
  ({
    id: 'msg-1',
    role: 'signal',
    type: 'top-level-type',
    createdAt: new Date('2026-01-01'),
    content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
    ...overrides,
  }) as MastraDBMessage;

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe('signalContentsToText', () => {
  it('returns a string as-is', () => {
    expect(signalContentsToText('plain')).toBe('plain');
  });

  it('joins non-empty text parts with newlines and ignores other parts', () => {
    expect(
      signalContentsToText([
        { type: 'text', text: 'a' },
        { type: 'text', text: '' },
        { type: 'file', data: 'x' },
        'not a record',
        { type: 'text', text: 'b' },
      ]),
    ).toBe('a\nb');
  });

  it('returns an empty string for anything else', () => {
    expect(signalContentsToText(undefined)).toBe('');
    expect(signalContentsToText({ type: 'text', text: 'a' })).toBe('');
  });
});

describe('formatSignalValue', () => {
  it('formats strings, numbers and booleans', () => {
    expect(formatSignalValue('s')).toBe('s');
    expect(formatSignalValue(3)).toBe('3');
    expect(formatSignalValue(false)).toBe('false');
  });

  it('returns undefined for other values', () => {
    expect(formatSignalValue(null)).toBeUndefined();
    expect(formatSignalValue({})).toBeUndefined();
  });
});

describe('isSignalData', () => {
  it.each(['notification', 'state', 'reactive'])('accepts type %s', type => {
    expect(isSignalData({ type })).toBe(true);
  });

  it('rejects other types and non-records', () => {
    expect(isSignalData({ type: 'user' })).toBe(false);
    expect(isSignalData({})).toBe(false);
    expect(isSignalData('state')).toBe(false);
  });
});

describe('getSignalType', () => {
  it('prefers content.metadata.signal.type', () => {
    const message = buildSignalMessage({
      content: { format: 2, parts: [], metadata: { signal: { type: 'reactive' } } },
    } as Partial<MastraDBMessage>);
    expect(getSignalType(message)).toBe('reactive');
  });

  it('falls back to the top-level message type', () => {
    expect(getSignalType(buildSignalMessage())).toBe('top-level-type');
    const nonString = buildSignalMessage({
      content: { format: 2, parts: [], metadata: { signal: { type: 1 } } },
    } as Partial<MastraDBMessage>);
    expect(getSignalType(nonString)).toBe('top-level-type');
  });
});

describe('isUserSignalType', () => {
  it('is true only for user and user-message', () => {
    expect(isUserSignalType('user')).toBe(true);
    expect(isUserSignalType('user-message')).toBe(true);
    expect(isUserSignalType('reactive')).toBe(false);
    expect(isUserSignalType(undefined)).toBe(false);
  });
});

describe('toReactiveSignalData', () => {
  describe('when the message has no signal metadata', () => {
    it('derives id, type and tagName from the message and flattens a single text part', () => {
      expect(toReactiveSignalData(buildSignalMessage())).toEqual({
        id: 'msg-1',
        type: 'top-level-type',
        tagName: 'top-level-type',
        contents: 'hello',
      });
    });
  });

  describe('when the message carries signal metadata', () => {
    it('uses the metadata id, tagName, attributes and metadata', () => {
      const message = buildSignalMessage({
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'a' },
            { type: 'file', data: 'ZmlsZQ==', mimeType: 'text/plain' },
            { type: 'file', data: 'ZmlsZQ==' },
            { type: 'reasoning', reasoning: 'ignored' },
          ],
          metadata: {
            signal: {
              id: 'sig-1',
              type: 'reactive',
              tagName: 'deploy',
              attributes: { env: 'prod' },
              metadata: { value: 1 },
            },
          },
        },
      } as Partial<MastraDBMessage>);

      expect(toReactiveSignalData(message)).toEqual({
        id: 'sig-1',
        type: 'reactive',
        tagName: 'deploy',
        contents: [
          { type: 'text', text: 'a' },
          { type: 'file', data: 'ZmlsZQ==', mediaType: 'text/plain' },
          { type: 'file', data: 'ZmlsZQ==', mediaType: 'application/octet-stream' },
        ],
        attributes: { env: 'prod' },
        metadata: { value: 1 },
      });
    });

    it('omits attributes and metadata when they are not records', () => {
      const message = buildSignalMessage({
        content: { format: 2, parts: [], metadata: { signal: { attributes: 'x', metadata: [] } } },
      } as Partial<MastraDBMessage>);

      const data = toReactiveSignalData(message);
      expect('attributes' in data).toBe(false);
      expect('metadata' in data).toBe(false);
      expect(data.contents).toEqual([]);
    });
  });
});

describe('getNotificationMetadata', () => {
  it('returns undefined without a notification record', () => {
    expect(getNotificationMetadata({})).toBeUndefined();
    expect(getNotificationMetadata({ metadata: { notification: 'x' } })).toBeUndefined();
  });

  it('picks only well-typed fields', () => {
    expect(
      getNotificationMetadata({
        metadata: {
          notification: {
            signal: 'summary',
            recordId: 'r1',
            source: 'github',
            kind: 'issue',
            priority: 'high',
            status: 'delivered',
            pending: 2,
          },
        },
      }),
    ).toEqual({
      signal: 'summary',
      recordId: 'r1',
      source: 'github',
      kind: 'issue',
      priority: 'high',
      status: 'delivered',
      pending: 2,
    });
  });

  it('drops fields with the wrong type', () => {
    expect(
      getNotificationMetadata({
        metadata: { notification: { signal: 'other', recordId: 1, pending: '2', source: null } },
      }),
    ).toEqual({
      signal: undefined,
      recordId: undefined,
      source: undefined,
      kind: undefined,
      priority: undefined,
      status: undefined,
      pending: undefined,
    });
  });
});

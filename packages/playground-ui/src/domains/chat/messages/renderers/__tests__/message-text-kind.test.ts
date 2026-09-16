import { describe, expect, it } from 'vitest';

import { errorMessage, messageTextKind } from '../message-text-kind';

describe('messageTextKind', () => {
  describe('when metadata carries an explicit status', () => {
    it.each([
      ['tripwire', 'tripwire'],
      ['warning', 'warning'],
      ['error', 'error'],
    ] as const)('maps status %s to kind %s', (status, kind) => {
      expect(messageTextKind('any text', { status })).toBe(kind);
    });

    it('lets an explicit status win over a completion result', () => {
      expect(messageTextKind('done', { status: 'warning', completionResult: { passed: true } })).toBe('warning');
    });

    it('treats a pending status as prose', () => {
      expect(messageTextKind('thinking', { status: 'pending' })).toBe('prose');
    });
  });

  describe('when metadata carries a completion result', () => {
    it('returns completion', () => {
      expect(messageTextKind('All good', { completionResult: { passed: true } })).toBe('completion');
    });
  });

  describe('when the text starts with an error prefix', () => {
    it.each(['__ERROR__: boom', 'Error: boom', '  Error: boom with leading spaces'])(
      'returns error for %j without metadata',
      text => {
        expect(messageTextKind(text, undefined)).toBe('error');
      },
    );

    it('does not treat a prefix in the middle of the text as an error', () => {
      expect(messageTextKind('Here is an Error: example', undefined)).toBe('prose');
    });
  });

  describe('when there is no status, completion result or error prefix', () => {
    it('returns prose', () => {
      expect(messageTextKind('Hello world', {})).toBe('prose');
      expect(messageTextKind('Hello world', undefined)).toBe('prose');
    });
  });
});

describe('errorMessage', () => {
  describe('when the text starts with an error prefix', () => {
    it.each([
      ['__ERROR__: boom', 'boom'],
      ['Error: boom', 'boom'],
      ['  __ERROR__:   padded  ', 'padded'],
    ])('strips the prefix and trims %j', (text, expected) => {
      expect(errorMessage(text)).toBe(expected);
    });
  });

  describe('when the text has no error prefix', () => {
    it('returns the original text untouched', () => {
      expect(errorMessage('  plain text  ')).toBe('  plain text  ');
    });
  });
});

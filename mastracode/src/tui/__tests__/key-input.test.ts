import { describe, expect, it } from 'vitest';

import { decodePrintableShortcut } from '../key-input.js';

describe('decodePrintableShortcut', () => {
  describe('literal single-character input', () => {
    it.each([['y'], ['n'], ['a'], ['Y'], ['c'], ['r'], ['0'], ['?']])('returns the literal %j unchanged', input => {
      expect(decodePrintableShortcut(input)).toBe(input);
    });

    it('rejects control characters', () => {
      expect(decodePrintableShortcut('\x03')).toBeUndefined();
      expect(decodePrintableShortcut('\x1b')).toBeUndefined();
    });
  });

  describe('Kitty CSI-u printables', () => {
    it.each([
      ['\x1b[121u', 'y'],
      ['\x1b[110u', 'n'],
      ['\x1b[97u', 'a'],
      ['\x1b[99u', 'c'],
      ['\x1b[114u', 'r'],
    ])('decodes %j as %j', (input, expected) => {
      expect(decodePrintableShortcut(input)).toBe(expected);
    });

    it('returns undefined for non-letter keys parseKey resolves to a name (e.g. space)', () => {
      // `parseKey(' ')` returns the semantic name `'space'`, not the byte;
      // callers that care about space should use pi-tui's `matchesKey`
      // primitive instead of this helper.
      expect(decodePrintableShortcut(' ')).toBeUndefined();
      expect(decodePrintableShortcut('\x1b[32u')).toBeUndefined();
    });

    it('decodes plain CSI-u with explicit no-modifier (mod=1)', () => {
      expect(decodePrintableShortcut('\x1b[121;1u')).toBe('y');
    });

    it.each([
      // Base codepoint + shift modifier — terminals without alternate-keys flag.
      ['\x1b[121;2u', 'Y'],
      // Shifted codepoint reported directly.
      ['\x1b[89;2u', 'Y'],
      // Alternate-keys form: codepoint:shifted:base ; modifier.
      ['\x1b[121:89:121;2u', 'Y'],
    ])('decodes Shift+y form %j as %j', (input, expected) => {
      expect(decodePrintableShortcut(input)).toBe(expected);
    });

    it('rejects Ctrl-modified printables', () => {
      expect(decodePrintableShortcut('\x1b[121;5u')).toBeUndefined();
    });

    it('rejects Alt-modified printables', () => {
      expect(decodePrintableShortcut('\x1b[121;3u')).toBeUndefined();
    });

    it('rejects Ctrl+Shift-modified printables', () => {
      expect(decodePrintableShortcut('\x1b[121;6u')).toBeUndefined();
    });

    it.each([
      // Kitty event-type suffix: ":1" = press, ":2" = repeat, ":3" = release.
      // The TUI filters releases above the component layer; press/repeat
      // arrive here and must still decode.
      ['\x1b[121;2:1u', 'Y', 'Shift+y press with explicit event type'],
      ['\x1b[121;2:2u', 'Y', 'Shift+y repeat'],
    ])('decodes Kitty event-suffix form %j as %j (%s)', (input, expected) => {
      expect(decodePrintableShortcut(input)).toBe(expected);
    });

    it.each([
      // pi-tui keeps shifted digits/symbols as their semantic key id, not as
      // the resulting glyph. Callers that need them must use matchesKey.
      ['\x1b[49;2u', 'Shift+1 base codepoint'],
      ['\x1b[33;2u', 'Shift+1 shifted codepoint (!)'],
    ])('returns undefined for shifted non-letter %j (%s)', input => {
      expect(decodePrintableShortcut(input)).toBeUndefined();
    });
  });

  describe('xterm modifyOtherKeys printables', () => {
    it.each([
      ['\x1b[27;1;121~', 'y'],
      ['\x1b[27;1;110~', 'n'],
      ['\x1b[27;1;97~', 'a'],
      ['\x1b[27;1;99~', 'c'],
      ['\x1b[27;1;114~', 'r'],
    ])('decodes %j as %j (no modifier)', (input, expected) => {
      expect(decodePrintableShortcut(input)).toBe(expected);
    });

    it.each([
      // Shift+y with the base codepoint.
      ['\x1b[27;2;121~', 'Y'],
      // Shift+y with the shifted codepoint.
      ['\x1b[27;2;89~', 'Y'],
    ])('decodes Shift+y form %j as %j', (input, expected) => {
      expect(decodePrintableShortcut(input)).toBe(expected);
    });

    it('rejects Ctrl-modified modifyOtherKeys printables', () => {
      expect(decodePrintableShortcut('\x1b[27;5;121~')).toBeUndefined();
    });

    it('rejects Alt-modified modifyOtherKeys printables', () => {
      expect(decodePrintableShortcut('\x1b[27;3;121~')).toBeUndefined();
    });
  });

  describe('non-printable and malformed input', () => {
    it.each([['\x1b[A'], ['\x1b[B'], ['\r'], ['\t']])('returns undefined for navigation/whitespace key %j', input => {
      expect(decodePrintableShortcut(input)).toBeUndefined();
    });

    it.each([['\x1b[u'], ['\x1b[abcu'], [''], ['yes']])(
      'returns undefined for malformed/multi-byte input %j',
      input => {
        expect(decodePrintableShortcut(input)).toBeUndefined();
      },
    );
  });
});

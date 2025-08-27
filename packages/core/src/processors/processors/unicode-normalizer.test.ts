import { describe, it, expect } from 'vitest';
import type { MastraMessageV2 } from '../../agent/message-list';
import { UnicodeNormalizer } from './unicode-normalizer';

function createTestMessage(text: string, id = 'test-id'): MastraMessageV2 {
  return {
    id,
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

function createTestMessageWithContent(text: string, content: string, id = 'test-id'): MastraMessageV2 {
  return {
    id,
    role: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
      content,
    },
    createdAt: new Date(),
  };
}

describe('UnicodeNormalizer', () => {
  describe('constructor and default options', () => {
    it('should use default options when none provided', () => {
      const normalizer = new UnicodeNormalizer();
      expect(normalizer.name).toBe('unicode-normalizer');
    });

    it('should accept custom options', () => {
      const normalizer = new UnicodeNormalizer({
        stripControlChars: true,
        preserveEmojis: false,
        collapseWhitespace: false,
        trim: false,
      });
      expect(normalizer.name).toBe('unicode-normalizer');
    });
  });

  describe('NFKC normalization', () => {
    it('should normalize unicode characters to NFKC form', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      // Test with ligature fi (ﬁ) which should be normalized to separate f and i
      const input = createTestMessage('ﬁle'); // Contains ligature
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      // The ligature should be normalized to separate characters
      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'file' });
    });

    it('should handle fullwidth characters', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      // Test with fullwidth characters
      const input = createTestMessage('Ｈｅｌｌｏ'); // Fullwidth Hello
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'Hello' });
    });

    it('should handle composed/decomposed characters', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      // Test with decomposed character (e + combining acute accent)
      const input = createTestMessage('e\u0301'); // e + combining acute
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      // Should be normalized to composed form
      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'é' });
    });
  });

  describe('whitespace handling', () => {
    it('should collapse multiple spaces by default', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('hello    world     test');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'hello world test' });
    });

    it('should collapse multiple newlines', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('line1\n\n\n\nline2');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'line1\nline2' });
    });

    it('should normalize mixed line endings', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('line1\r\nline2\rline3\nline4');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'line1\nline2\nline3\nline4' });
    });

    it('should trim leading and trailing whitespace by default', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('   hello world   \n\t');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'hello world' });
    });

    it('should not collapse whitespace when disabled', () => {
      const normalizer = new UnicodeNormalizer({ collapseWhitespace: false });
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('hello    world');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'hello    world' });
    });

    it('should not trim when disabled', () => {
      const normalizer = new UnicodeNormalizer({ trim: false });
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('  hello world  ');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: ' hello world ' });
    });
  });

  describe('control character handling', () => {
    it('should not strip control characters by default', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('hello\x00\x01world\x7F');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      const resultText = (result[0].content.parts?.[0] as any)?.text;
      // Control characters should be preserved by default
      expect(resultText).toContain('\x00');
      expect(resultText).toContain('\x01');
      expect(resultText).toContain('\x7F');
    });

    it('should strip problematic control characters when enabled with emoji preservation', () => {
      const normalizer = new UnicodeNormalizer({
        stripControlChars: true,
        preserveEmojis: true,
      });
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('hello\x00\x01world\x7F\x9F');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'helloworld' });
    });

    it('should preserve tab, newline, and carriage return when stripping control chars', () => {
      const normalizer = new UnicodeNormalizer({
        stripControlChars: true,
        collapseWhitespace: false, // Don't collapse to see the original chars
      });
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('hello\tworld\ntest\rline\x00bad');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      const resultText = (result[0].content.parts?.[0] as any)?.text;
      expect(resultText).toContain('\t');
      expect(resultText).toContain('\n');
      expect(resultText).toContain('\r');
      expect(resultText).not.toContain('\x00');
    });
  });

  describe('emoji handling', () => {
    it('should preserve emojis by default', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('Hello 👋 World 🌍 Test 🚀');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'Hello 👋 World 🌍 Test 🚀' });
    });

    it('should preserve emojis when stripping control chars with preserveEmojis enabled', () => {
      const normalizer = new UnicodeNormalizer({
        stripControlChars: true,
        preserveEmojis: true,
      });
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('Hello\x00👋\x01World🌍\x7F');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'Hello👋World🌍' });
    });

    it('should handle complex emojis with modifiers', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('👨‍👩‍👧‍👦 👋🏽 🏳️‍🌈');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      const resultText = (result[0].content.parts?.[0] as any)?.text;
      expect(resultText).toContain('👨‍👩‍👧‍👦');
      expect(resultText).toContain('👋🏽');
      expect(resultText).toContain('🏳️‍🌈');
    });
  });

  describe('message structure handling', () => {
    it('should handle messages with content field', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const message = createTestMessageWithContent('  part text  ', '  content text  ');
      const result = normalizer.processInput({ messages: [message], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: 'part text' });
      expect(result[0].content.content).toBe('content text');
    });

    it('should preserve message metadata', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const message: MastraMessageV2 = {
        id: 'test-id',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: '  hello  ' }],
          metadata: { custom: 'data' },
        },
        createdAt: new Date('2023-01-01'),
        threadId: 'thread-123',
        resourceId: 'resource-456',
        type: 'user-input',
      };

      const result = normalizer.processInput({ messages: [message], abort: mockAbort });

      expect(result[0]).toEqual({
        id: 'test-id',
        role: 'user',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'hello' }],
          metadata: { custom: 'data' },
        },
        createdAt: new Date('2023-01-01'),
        threadId: 'thread-123',
        resourceId: 'resource-456',
        type: 'user-input',
      });
    });
  });

  describe('error handling', () => {
    it('should handle malformed input gracefully', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = (() => {
        throw new Error('aborted');
      }) as any;

      // Test with message containing null text (should be handled gracefully)
      const message: any = createTestMessage('test');
      message.content.parts[0].text = null;

      // Should not throw, but handle gracefully
      expect(() => {
        normalizer.processInput({ messages: [message], abort: mockAbort });
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: '' });
    });

    it('should handle whitespace-only strings', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const input = createTestMessage('   \t\n\r   ');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect(result[0].content.parts?.[0]).toEqual({ type: 'text', text: '' });
    });

    it('should handle very long strings', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      const longText = 'a'.repeat(10000) + '   ' + 'b'.repeat(10000);
      const input = createTestMessage(longText);
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      expect((result[0].content.parts?.[0] as any)?.text).toBe('a'.repeat(10000) + ' ' + 'b'.repeat(10000));
    });

    it('should handle mixed unicode categories', () => {
      const normalizer = new UnicodeNormalizer();
      const mockAbort = () => {
        throw new Error('abort');
      };

      // Mix of different unicode categories
      const input = createTestMessage('English 中文 العربية ελληνικά 🌍');
      const result = normalizer.processInput({ messages: [input], abort: mockAbort });

      const resultText = (result[0].content.parts?.[0] as any)?.text;
      // Should preserve all valid unicode while normalizing
      expect(resultText).toContain('English');
      expect(resultText).toContain('中文');
      expect(resultText).toContain('العربية');
      expect(resultText).toContain('ελληνικά');
      expect(resultText).toContain('🌍');
    });
  });
});

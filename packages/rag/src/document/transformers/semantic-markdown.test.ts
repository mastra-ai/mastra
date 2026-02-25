import { getEncoding, encodingForModel } from 'js-tiktoken';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SemanticMarkdownTransformer } from './semantic-markdown';

let totalCharsEncoded = 0;

vi.mock('js-tiktoken', () => {
  const createMockTokenizer = () => ({
    encode: (text: string) => {
      totalCharsEncoded += text.length;
      return Array.from({ length: Math.ceil(text.length / 4) }, (_, i) => i);
    },
    decode: (tokens: number[]) => 'x'.repeat(tokens.length * 4),
  });

  return {
    getEncoding: vi.fn(() => createMockTokenizer()),
    encodingForModel: vi.fn(() => createMockTokenizer()),
  };
});

describe('SemanticMarkdownTransformer', () => {
  beforeEach(() => {
    vi.mocked(getEncoding).mockClear();
    vi.mocked(encodingForModel).mockClear();
    totalCharsEncoded = 0;
  });

  describe('fromTikToken', () => {
    it('should create only one encoder when using encodingName', () => {
      SemanticMarkdownTransformer.fromTikToken({
        encodingName: 'cl100k_base',
        options: {},
      });

      expect(getEncoding).toHaveBeenCalledTimes(1);
      expect(encodingForModel).not.toHaveBeenCalled();
    });

    it('should create only one encoder when using modelName', () => {
      SemanticMarkdownTransformer.fromTikToken({
        modelName: 'gpt-4',
        options: {},
      });

      expect(encodingForModel).toHaveBeenCalledTimes(1);
      expect(getEncoding).not.toHaveBeenCalled();
    });
  });

  describe('token counting efficiency', () => {
    it('should not re-encode merged content during section merging', () => {
      // Generate markdown with many small sections that will all be merged
      const sections = [];
      for (let i = 0; i < 10; i++) {
        sections.push(`## Section ${i}\nShort content ${i}.`);
      }
      const markdown = `# Main\n\n${sections.join('\n\n')}`;

      const transformer = SemanticMarkdownTransformer.fromTikToken({
        encodingName: 'cl100k_base',
        options: { joinThreshold: 10000 },
      });

      // Reset counter after construction (construction may call encode internally)
      totalCharsEncoded = 0;

      const chunks = transformer.splitText({ text: markdown });

      // Verify merging actually occurred — all sections should merge into one chunk
      expect(chunks).toHaveLength(1);

      // mergeSemanticSections should encode only short header strings during merging,
      // NOT re-encode the entire growing merged content on every merge.
      // Total chars encoded should stay proportional to input size, not grow quadratically.
      expect(totalCharsEncoded).toBeLessThan(markdown.length * 2);
    });
  });
});

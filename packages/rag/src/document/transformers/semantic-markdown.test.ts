import { getEncoding, encodingForModel } from 'js-tiktoken';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SemanticMarkdownTransformer } from './semantic-markdown';

let totalEncodeCallCount = 0;

vi.mock('js-tiktoken', () => {
  const createMockTokenizer = () => ({
    encode: (text: string) => {
      totalEncodeCallCount++;
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
    totalEncodeCallCount = 0;
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
      totalEncodeCallCount = 0;

      transformer.splitText({ text: markdown });

      // splitMarkdownByHeaders calls countTokens once per section (11 sections total).
      // mergeSemanticSections should combine token counts arithmetically,
      // NOT re-encode the entire growing merged content on every merge.
      const sectionCount = 11; // 1 main + 10 subsections
      expect(totalEncodeCallCount).toBeLessThanOrEqual(sectionCount);
    });
  });
});

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

  describe('header parsing', () => {
    it('parses headers with space or tab separators, up to depth 6', () => {
      const transformer = SemanticMarkdownTransformer.fromTikToken({
        encodingName: 'cl100k_base',
        options: { joinThreshold: 10000 },
      });
      // Each header has body content so it survives merging and chunk output.
      const md = [
        '# One\nBody one.',
        '## Two\nBody two.',
        '###\tThree\nBody three.',
        '#### Four\nBody four.',
        '##### Five\nBody five.',
        '###### Six\nBody six.',
      ].join('\n\n');
      const chunks = transformer.splitText({ text: md });
      const joined = chunks.join('\n');
      expect(joined).toContain('One');
      expect(joined).toContain('Two');
      expect(joined).toContain('Three');
      expect(joined).toContain('Four');
      expect(joined).toContain('Five');
      expect(joined).toContain('Six');
    });

    it('runs in linear time on pathological header-like input (no ReDoS)', () => {
      const transformer = SemanticMarkdownTransformer.fromTikToken({
        encodingName: 'cl100k_base',
        options: { joinThreshold: 10000 },
      });
      // Many '#' followed by tabs with no trailing content — the shape
      // CodeQL flagged on the previous `^(#+)\s+(.+)$` regex.
      const pathological = '#'.repeat(1000) + '\t'.repeat(5000);
      transformer.splitText({ text: '#'.repeat(10) + '\t'.repeat(10) }); // warm up
      const start = performance.now();
      transformer.splitText({ text: pathological });
      const elapsed = performance.now() - start;
      // Generous budget — linear implementation finishes in a few ms;
      // a quadratic implementation would take multiple seconds.
      expect(elapsed).toBeLessThan(2000);
    });
  });
});

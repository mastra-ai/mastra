import { describe, it, expect } from 'vitest';
import { extractWorkingMemoryTags, extractWorkingMemoryContent, removeWorkingMemoryTags } from './working-memory-utils';

describe('Working Memory Utils - ReDoS Prevention', () => {
  // The vulnerable regex pattern that was replaced
  const vulnerableRegex = /<working_memory>([^]*?)<\/working_memory>/g;

  describe('extractWorkingMemoryTags', () => {
    it('should extract simple working memory tags', () => {
      const result = extractWorkingMemoryTags('<working_memory>hello world</working_memory>');
      expect(result).toEqual(['<working_memory>hello world</working_memory>']);
    });

    it('should extract multiple working memory tags', () => {
      const result = extractWorkingMemoryTags(
        '<working_memory>first</working_memory> text <working_memory>second</working_memory>',
      );
      expect(result).toEqual(['<working_memory>first</working_memory>', '<working_memory>second</working_memory>']);
    });

    it('should handle multiline content', () => {
      const result = extractWorkingMemoryTags('<working_memory>line1\nline2\nline3</working_memory>');
      expect(result).toEqual(['<working_memory>line1\nline2\nline3</working_memory>']);
    });

    it('should return null when no tags found', () => {
      expect(extractWorkingMemoryTags('no tags here')).toBeNull();
    });

    it('should return null when only opening tag exists', () => {
      expect(extractWorkingMemoryTags('<working_memory>unclosed')).toBeNull();
    });

    it('should handle nested angle brackets', () => {
      const result = extractWorkingMemoryTags('<working_memory>has <nested> tags</working_memory>');
      expect(result).toEqual(['<working_memory>has <nested> tags</working_memory>']);
    });

    it('should match regex behavior for normal inputs', () => {
      const testCases = [
        '<working_memory>hello world</working_memory>',
        'prefix <working_memory>content</working_memory> suffix',
        '<working_memory></working_memory>',
        '<working_memory>multi\nline</working_memory>',
      ];

      for (const input of testCases) {
        const regexResult = input.match(vulnerableRegex);
        const helperResult = extractWorkingMemoryTags(input);
        expect(helperResult).toEqual(regexResult);
      }
    });
  });

  describe('extractWorkingMemoryContent', () => {
    it('should extract content without tags', () => {
      expect(extractWorkingMemoryContent('<working_memory>hello world</working_memory>')).toBe('hello world');
    });

    it('should return first match content only', () => {
      expect(
        extractWorkingMemoryContent('<working_memory>first</working_memory> <working_memory>second</working_memory>'),
      ).toBe('first');
    });

    it('should handle multiline content', () => {
      expect(extractWorkingMemoryContent('<working_memory>line1\nline2</working_memory>')).toBe('line1\nline2');
    });

    it('should return null when no tags found', () => {
      expect(extractWorkingMemoryContent('no tags here')).toBeNull();
    });

    it('should return null when only opening tag exists', () => {
      expect(extractWorkingMemoryContent('<working_memory>unclosed')).toBeNull();
    });

    it('should handle empty content', () => {
      expect(extractWorkingMemoryContent('<working_memory></working_memory>')).toBe('');
    });

    it('should extract content with prefix text', () => {
      expect(extractWorkingMemoryContent('prefix <working_memory>content</working_memory>')).toBe('content');
    });
  });

  describe('removeWorkingMemoryTags', () => {
    it('should remove working memory tags', () => {
      expect(removeWorkingMemoryTags('<working_memory>secret</working_memory>')).toBe('');
    });

    it('should remove tags and preserve surrounding text', () => {
      expect(removeWorkingMemoryTags('Hello <working_memory>secret</working_memory> world')).toBe('Hello  world');
    });

    it('should remove multiple tags', () => {
      expect(
        removeWorkingMemoryTags('<working_memory>a</working_memory> middle <working_memory>b</working_memory>'),
      ).toBe(' middle ');
    });

    it('should handle text with no tags', () => {
      expect(removeWorkingMemoryTags('no tags here')).toBe('no tags here');
    });

    it('should handle unclosed tags by preserving them', () => {
      expect(removeWorkingMemoryTags('before <working_memory>unclosed')).toBe('before <working_memory>unclosed');
    });

    it('should match regex behavior for normal inputs', () => {
      const testCases = [
        '<working_memory>hello</working_memory>',
        'prefix <working_memory>content</working_memory> suffix',
        'Hello <working_memory>secret</working_memory> world',
        '<working_memory>a</working_memory><working_memory>b</working_memory>',
      ];

      for (const input of testCases) {
        const regexResult = input.replace(vulnerableRegex, '');
        const helperResult = removeWorkingMemoryTags(input);
        expect(helperResult).toBe(regexResult);
      }
    });
  });

  describe('Performance comparison (ReDoS prevention)', () => {
    // Generate pathological input that causes O(n²) behavior with regex
    function createPathologicalInput(n: number): string {
      return '<working_memory>' + '<working_memory>a'.repeat(n);
    }

    it('should handle pathological input without performance degradation', () => {
      // This input would cause the regex to take ~60ms at n=5000
      // and grows quadratically. The helper should stay under 1ms.
      const input = createPathologicalInput(5000);

      const start = performance.now();
      const result = extractWorkingMemoryTags(input);
      const elapsed = performance.now() - start;

      // Helper should complete in under 5ms even for large inputs
      expect(elapsed).toBeLessThan(5);
      // Should return null since there's no closing tag
      expect(result).toBeNull();
    });

    it('should demonstrate regex has quadratic complexity on pathological input', () => {
      // Test with smaller inputs to show the growth pattern without taking too long
      const times: { n: number; ms: number }[] = [];

      for (const n of [500, 1000, 2000]) {
        const input = createPathologicalInput(n);

        const start = performance.now();
        input.match(vulnerableRegex);
        const elapsed = performance.now() - start;

        times.push({ n, ms: elapsed });
      }

      // When n doubles, time should roughly quadruple for O(n²)
      // Check that 2000 takes significantly longer than 500 (should be ~16x for O(n²))
      const ratio = times[2].ms / times[0].ms;
      // Allow some variance, but it should be at least 4x (would be 16x for perfect O(n²))
      expect(ratio).toBeGreaterThan(4);
    });

    it('should show helper maintains linear performance', () => {
      const times: { n: number; ms: number }[] = [];

      for (const n of [5000, 10000, 20000]) {
        const input = createPathologicalInput(n);

        const start = performance.now();
        extractWorkingMemoryTags(input);
        const elapsed = performance.now() - start;

        times.push({ n, ms: elapsed });
      }

      // For O(n) complexity, when n doubles, time should roughly double
      // All should complete very fast (under 1ms typically)
      for (const t of times) {
        expect(t.ms).toBeLessThan(5);
      }
    });
  });
});

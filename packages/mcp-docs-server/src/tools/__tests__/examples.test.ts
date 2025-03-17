import { describe, it, expect } from 'vitest';
import { examplesTool } from '../examples';

describe('examplesTool', () => {
  const mockContext = {} as any;

  describe('execute', () => {
    it('should list all available examples when no example is specified', async () => {
      const result = await examplesTool.execute({}, mockContext);

      // Check for some known examples that should be in the list
      expect(result).toContain('Available code examples:');
      expect(result).toContain('quick-start');
      expect(result).toContain('agent');
    });

    it('should return example content for a specific example', async () => {
      const result = await examplesTool.execute({ example: 'quick-start' }, mockContext);

      // The example should contain package.json and index.ts files
      expect(result).toContain('### package.json');
      expect(result).toContain('### index.ts');
      expect(result).toContain('```typescript');
    });

    it('should handle examples with or without .md extension', async () => {
      const result1 = await examplesTool.execute({ example: 'quick-start' }, mockContext);
      const result2 = await examplesTool.execute({ example: 'quick-start.md' }, mockContext);

      expect(result1).toBe(result2);
    });

    it('should handle non-existent examples gracefully', async () => {
      const result = await examplesTool
        .execute({ example: 'non-existent-example' }, mockContext)
        .catch(error => error.message);

      expect(result).toContain('Example "non-existent-example.md" not found');
      expect(result).toContain('Available examples:');
      expect(result).toContain('quick-start'); // Should list available examples
    });

    it('should return examples in alphabetical order', async () => {
      const result = (await examplesTool.execute({}, mockContext)) as string;
      const lines = result.split('\n').filter((line: string) => line.startsWith('- '));
      const examples = lines.map((line: string) => line.replace('- ', ''));

      // Check if the array is sorted
      const sortedExamples = [...examples].sort();
      expect(examples).toEqual(sortedExamples);
    });

    it('should handle examples with special characters in names', async () => {
      const result = await examplesTool.execute({ example: 'bird-checker-with-express' }, mockContext);
      expect(result).toContain('### package.json');
      expect(result).toContain('### index.ts');
      expect(result).toContain('```typescript');
    });

    it('should handle examples with multiple code blocks', async () => {
      const result = (await examplesTool.execute({ example: 'agent' }, mockContext)) as string;
      const codeBlockCount = (result.match(/```typescript/g) || []).length;
      expect(codeBlockCount).toBeGreaterThan(1);
    });
  });
});

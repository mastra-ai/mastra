import { describe, it, expect } from 'vitest';
import { docsTool } from '../docs';

describe('docsTool', () => {
  const mockContext = {} as any;

  describe('execute', () => {
    it('should list directory contents when no specific path is requested', async () => {
      const result = await docsTool.execute({ paths: [''] }, mockContext);
      expect(result).toContain('Directory contents of :');
      expect(result).toContain('Subdirectories:');
      expect(result).toContain('Files in this directory:');
      expect(result).toContain('index.mdx');
    });

    it('should return content for index.mdx', async () => {
      const result = await docsTool.execute({ paths: ['index.mdx'] }, mockContext);
      expect(result).toContain('## index.mdx');
      expect(result).toContain('# About Mastra');
    });

    it('should handle directory listings', async () => {
      const result = await docsTool.execute({ paths: ['reference'] }, mockContext);
      expect(result).toContain('Directory contents of reference');
      expect(result).toContain('Subdirectories:');
      expect(result).toContain('Files in this directory:');
    });

    it('should handle non-existent paths gracefully', async () => {
      const result = await docsTool.execute({ paths: ['non-existent-path'] }, mockContext);
      expect(result).toContain('Path "non-existent-path" not found');
      expect(result).toContain('Here are all available paths');
    });

    it('should handle multiple paths in a single request', async () => {
      const result = await docsTool.execute(
        {
          paths: ['index.mdx', 'reference/tools'],
        },
        mockContext,
      );

      expect(result).toContain('## index.mdx');
      expect(result).toContain('## reference/tools');
    });

    it('should find nearest directory when path is partially correct', async () => {
      const result = await docsTool.execute({ paths: ['reference/tools/non-existent'] }, mockContext);
      expect(result).toContain('Path "reference/tools/non-existent" not found');
      expect(result).toContain('Here are the available paths in "reference/tools"');
    });

    it('should handle paths with special characters', async () => {
      const result = await docsTool.execute({ paths: ['reference/tools/'] }, mockContext);
      expect(result).toContain('Directory contents of reference/tools');
    });
  });
});

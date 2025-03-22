import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { callTool, mcp } from './test-setup';

describe('docsTool', () => {
  let tools: any;

  beforeAll(async () => {
    tools = await mcp.getTools();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  describe('execute', () => {
    it('should list directory contents when no specific path is requested', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: [''] });
      expect(result).toContain('Directory contents of :');
      expect(result).toContain('Subdirectories:');
      expect(result).toContain('Files in this directory:');
      expect(result).toContain('index.mdx');
    });

    it('should return content for index.mdx', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['index.mdx'] });
      expect(result).toContain('## index.mdx');
      expect(result).toContain('# About Mastra');
    });

    it('should handle directory listings', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['reference'] });
      expect(result).toContain('Directory contents of reference');
      expect(result).toContain('Subdirectories:');
      expect(result).toContain('Files in this directory:');
    });

    it('should handle non-existent paths gracefully', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['non-existent-path'] });
      expect(result).toContain('Path "non-existent-path" not found');
      expect(result).toContain('Here are all available paths');
    });

    it('should handle multiple paths in a single request', async () => {
      const result = await callTool(tools.mastra_mastraDocs, {
        paths: ['index.mdx', 'reference/tools'],
      });

      expect(result).toContain('## index.mdx');
      expect(result).toContain('## reference/tools');
    });

    it('should find nearest directory when path is partially correct', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['reference/tools/non-existent'] });
      expect(result).toContain('Path "reference/tools/non-existent" not found');
      expect(result).toContain('Here are the available paths in "reference/tools"');
    });

    it('should handle paths with special characters', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['reference/tools/'] });
      expect(result).toContain('Directory contents of reference/tools');
    });
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { callTool, mcp } from './test-setup';

describe('docsTool', () => {
  let tools: any;

  beforeAll(async () => {
    tools = await mcp.listTools();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  describe('execute', () => {
    it('should list top-level directories when root path is requested', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: [''] });
      // The root should list docs/, reference/, guides/
      expect(result).toContain('docs/');
      expect(result).toContain('reference/');
    });

    it('should return content for a specific documentation path', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['docs/agents/overview'] });
      expect(result).toContain('## docs/agents/overview');
      // Should contain documentation about agents
      expect(result.toLowerCase()).toContain('agent');
    });

    it('should handle directory listings when no index.md exists', async () => {
      // When there's no index.md in a directory, it should list subdirectories
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['docs/rag'] });
      // The rag folder has subdirectories with index.md files
      expect(result).toContain('Available documentation paths');
    });

    it('should handle non-existent paths gracefully', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['non-existent-path'] });
      expect(result).toContain('Path "non-existent-path" not found');
      expect(result).toContain('Here are all available paths');
    });

    it('should handle multiple paths in a single request', async () => {
      const result = await callTool(tools.mastra_mastraDocs, {
        paths: ['docs/agents/overview', 'docs/memory/overview'],
      });

      expect(result).toContain('## docs/agents/overview');
      expect(result).toContain('## docs/memory/overview');
    });

    it('should find nearest directory when path is partially correct', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['docs/agents/non-existent'] });
      expect(result).toContain('Path "docs/agents/non-existent" not found');
      expect(result).toContain('Here are the available paths in "docs/agents"');
    });

    it('should handle paths with trailing slashes', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['docs/agents/'] });
      // Should still find content or list subdirectories
      expect(result).toBeDefined();
    });

    it('should work when queryKeywords is an empty array', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['docs/agents'], queryKeywords: [] });
      expect(result).toBeDefined();
    });

    it('should normalize whitespace and case in queryKeywords', async () => {
      const result = await callTool(tools.mastra_mastraDocs, {
        paths: ['docs/agents'],
        queryKeywords: ['  Rag ', '  meMory   ', 'rag'], // intentional spaces and case
      });
      // Should not throw, and should dedupe/normalize keywords
      expect(result).toBeDefined();
    });

    it('should return directory contents when given a valid path', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['docs/agents'], queryKeywords: ['rag'] });
      expect(result).toBeDefined();
    });

    it('should use queryKeywords to find relevant content when path is invalid', async () => {
      const result = await callTool(tools.mastra_mastraDocs, {
        paths: ['non-existent-path'],
        queryKeywords: ['memory'],
      });
      // Should not throw, and should suggest or return content related to 'memory'
      expect(result.toLowerCase()).toMatch(/memory/);
    });

    it('should access reference documentation', async () => {
      const result = await callTool(tools.mastra_mastraDocs, { paths: ['reference/agents/agent'] });
      expect(result).toContain('## reference/agents/agent');
      // Reference docs should have content
      expect(result.length).toBeGreaterThan(100);
    });
  });
});

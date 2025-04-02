import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { callTool, mcp } from './test-setup';

describe('changesTool', () => {
  let tools: any;

  beforeAll(async () => {
    tools = await mcp.getTools();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  describe(`execute`, () => {
    it('should list all package changelogs when no package is specified', async () => {
      const result = await callTool(tools.mastra_mastraChanges, {});

      // Check for some known packages that should be in the list
      expect(result).toContain('@mastra/core');
      expect(result).toContain('@mastra/deployer');
      expect(result).toContain('mastra');
    });

    it('should return changelog content for a specific package', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/core' });

      // The changelog should be a markdown file with package name as header
      expect(result).toContain('# @mastra/core');
      expect(result).toMatch(/##\s+v?\d+\.\d+\.\d+/); // Should contain version headers
    });

    it('should handle packages with slashes in names correctly', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/deployer-vercel' });
      expect(result).toContain('# @mastra/deployer-vercel');
    });

    it('should handle non-existent package gracefully', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: 'non-existent-package' });
      expect(result).toContain('Changelog for "non-existent-package" not found');
      expect(result).toContain('Available packages:');
      expect(result).toContain('@mastra/core'); // Should list available packages
    });

    it('should properly handle special characters in package names', async () => {
      // Test with a package name containing special characters that need URL encoding
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/client-js' });
      expect(result).toContain('# @mastra/client-js');
    });
  });
});

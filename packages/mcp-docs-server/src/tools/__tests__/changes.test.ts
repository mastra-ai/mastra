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

    it('should have versions in descending order', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/core' });
      const versionMatches = result.match(/##\s+v?\d+\.\d+\.\d+/g) || [];
      expect(versionMatches.length).toBeGreaterThan(1); // Should have multiple versions

      // Extract version numbers and compare
      const versions = versionMatches.map((v: string) => v.match(/\d+\.\d+\.\d+/)?.[0] || '');
      const sortedVersions = [...versions].sort((a, b) => {
        const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
        const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
        if (aMajor !== bMajor) return bMajor - aMajor;
        if (aMinor !== bMinor) return bMinor - aMinor;
        return bPatch - aPatch;
      });
      expect(versions).toEqual(sortedVersions);
    });

    it('should include multiple versions with their changes', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/core' });
      const versions = result.match(/##\s+v?\d+\.\d+\.\d+/g) || [];
      expect(versions.length).toBeGreaterThan(1);

      // Each version should have some content
      const sections = result.split(/##\s+v?\d+\.\d+\.\d+/);
      sections.slice(1).forEach((section: string) => {
        expect(section.trim()).not.toBe('');
      });
    });

    it('should handle non-standard sections in changelog', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/core' });

      // Look for common changelog sections
      const hasNonStandardSection =
        result.includes('Minor Changes') || result.includes('Patch Changes') || result.includes('Breaking Changes');

      expect(hasNonStandardSection).toBe(true);
    });

    it('should properly format changelog content with markdown elements', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/core' });

      // Check for common markdown elements that exist in the changelog
      expect(result).toMatch(/^#\s+@mastra\/core/m); // Package header
      expect(result).toMatch(/^##\s+\d+\.\d+\.\d+/m); // Version headers
      expect(result).toMatch(/^###\s+[A-Za-z\s]+/m); // Change type headers
      expect(result).toMatch(/^-\s+.+/m); // List items (may have PR links or descriptions)
    });

    it('should handle alpha and beta versions correctly', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/core' });

      // Check for alpha/beta version formats
      const hasPreReleaseVersion = /##\s+v?\d+\.\d+\.\d+-(alpha|beta)\.\d+/.test(result);
      expect(hasPreReleaseVersion).toBe(true);
    });

    it('should handle well-structured changelog entries', async () => {
      const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/core' });

      // Split into version sections
      const sections = result.split(/##\s+v?\d+\.\d+\.\d+\n/);
      sections.slice(1).forEach((section: string) => {
        if (!section.includes('more lines hidden')) {
          // Each section should have at least one category and entry
          expect(section).toMatch(/###\s+.+/); // Category header
          expect(section).toMatch(/- .+/); // Entry

          // Entries should be properly formatted
          const entries = section.match(/^- .+/gm) || [];
          entries.forEach((entry: string) => {
            // Skip the truncation message if it exists
            // Entries should start with a dash and have content (PR links or descriptions)
            expect(entry).toMatch(/^- .+/);
          });
        }
      });
    });

    it('should handle empty changelog files gracefully', async () => {
      // Mock the filesystem response for an empty changelog
      const originalGetChangelog = tools.mastra_mastraChanges.getChangelog;
      tools.mastra_mastraChanges.getChangelog = async () => '';

      try {
        const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/test-empty' });
        expect(result).toContain('Changelog for "@mastra/test-empty" not found');
      } finally {
        // Restore original function
        tools.mastra_mastraChanges.getChangelog = originalGetChangelog;
      }
    });

    it('should handle changelog files with only header', async () => {
      // Mock the filesystem response for a changelog with only header
      const originalGetChangelog = tools.mastra_mastraChanges.getChangelog;
      tools.mastra_mastraChanges.getChangelog = async () => '# @mastra/test-header-only\n';

      try {
        const result = await callTool(tools.mastra_mastraChanges, { package: '@mastra/test-header-only' });
        expect(result).toContain('Changelog for "@mastra/test-header-only" not found');
      } finally {
        // Restore original function
        tools.mastra_mastraChanges.getChangelog = originalGetChangelog;
      }
    });
  });
});

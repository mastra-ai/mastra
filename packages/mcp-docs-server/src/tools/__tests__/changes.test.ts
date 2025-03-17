import { describe, it, expect } from 'vitest';
import { changesTool } from '../changes';

describe('changesTool', () => {
  const mockContext = {} as any;

  describe('execute', () => {
    it('should list all package changelogs when no package is specified', async () => {
      const result = await changesTool.execute({}, mockContext);
      
      // Check for some known packages that should be in the list
      expect(result).toContain('@mastra/core');
      expect(result).toContain('@mastra/deployer');
      expect(result).toContain('mastra');
    });

    it('should return changelog content for a specific package', async () => {
      const result = await changesTool.execute({ package: '@mastra/core' }, mockContext);
      
      // The changelog should be a markdown file with package name as header
      expect(result).toContain('# @mastra/core');
      expect(result).toMatch(/##\s+v?\d+\.\d+\.\d+/); // Should contain version headers
    });

    it('should handle packages with slashes in names correctly', async () => {
      const result = await changesTool.execute({ package: '@mastra/deployer-vercel' }, mockContext);
      expect(result).toContain('# @mastra/deployer-vercel');
    });

    it('should handle non-existent package gracefully', async () => {
      const result = await changesTool.execute({ package: 'non-existent-package' }, mockContext)
        .catch(error => error.message);
      
      expect(result).toContain('Changelog for "non-existent-package" not found');
      expect(result).toContain('Available packages:');
      expect(result).toContain('@mastra/core'); // Should list available packages
    });

    it('should properly handle special characters in package names', async () => {
      // Test with a package name containing special characters that need URL encoding
      const result = await changesTool.execute({ package: '@mastra/client-js' }, mockContext);
      expect(result).toContain('# @mastra/client-js');
    });
  });
}); 
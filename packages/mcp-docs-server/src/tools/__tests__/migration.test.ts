import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { callTool, mcp } from './test-setup';

describe('migrationTool', () => {
  let tools: any;

  beforeAll(async () => {
    tools = await mcp.listTools();
  });

  afterAll(async () => {
    await mcp.disconnect();
  });

  describe('list all migrations (default behavior)', () => {
    it('should list top-level directory when called with no parameters', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {});

      expect(result).toContain('# migrations');
      expect(result).toContain('**Actions:**');
    });

    it('should include both root-level files and directories', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {});

      // Should show root-level migration guides
      expect(result).toContain('agentnetwork');
      expect(result).toContain('vnext-to-standard-apis');

      // Should show upgrade-to-v1 subdirectory
      expect(result).toContain('**Directories:**');
      expect(result).toContain('upgrade-to-v1');
    });

    it('should show proper path format for directories with trailing slash', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {});

      expect(result).toContain('Explore with `{ path: "upgrade-to-v1/" }`');
    });

    it('should navigate into a directory with trailing slash', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/',
      });

      expect(result).toContain('# upgrade-to-v1');
      expect(result).toContain('**Migration Guides:**');
      expect(result).toContain('agent');
      expect(result).toContain('tools');
    });
  });

  describe('explore migration guide sections', () => {
    it('should list section headers when listSections is true', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/agent',
        listSections: true,
      });

      expect(result).toContain('# upgrade-to-v1/agent - Section Headers');
      expect(result).toContain('Available sections in this migration guide:');
      expect(result).toContain('To get specific sections, provide their titles in the "sections" parameter');
    });

    it('should show proper heading hierarchy with ## and ###', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/agent',
        listSections: true,
      });

      // Should contain H2 sections (Changed, Removed)
      expect(result).toContain('## Changed');
      expect(result).toContain('## Removed');

      // Should contain H3 sections (specific changes)
      expect(result).toMatch(/###\s+/);
    });

    it('should handle non-existent migration path gracefully', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'non-existent-migration',
        listSections: true,
      });

      expect(result).toContain('# migrations');
    });

    it('should list sections for root-level migrations', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'agentnetwork',
        listSections: true,
      });

      expect(result).toContain('# agentnetwork - Section Headers');
      expect(result).toContain('Available sections in this migration guide:');
    });

    it('should list sections for nested migrations', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
        listSections: true,
      });

      expect(result).toContain('# upgrade-to-v1/tools - Section Headers');
      expect(result).toContain('Available sections in this migration guide:');
    });
  });

  describe('fetch full migration guide', () => {
    it('should return full content when only path is provided', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/agent',
      });

      expect(result).toContain('# upgrade-to-v1/agent');
      expect(result).toContain('title:');
      expect(result).toContain('description:');
      // Should contain actual migration content
      expect(result.length).toBeGreaterThan(500);
    });

    it('should include frontmatter in full migration guide', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
      });

      expect(result).toContain('---');
      expect(result).toContain('title:');
      expect(result).toContain('description:');
    });

    it('should include code blocks with diff syntax', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
      });

      expect(result).toContain('```diff');
      expect(result).toMatch(/[+-]\s+/); // Should have + or - diff markers
    });

    it('should handle paths with .mdx extension', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/agent.mdx',
      });

      expect(result).toContain('# upgrade-to-v1/agent.mdx');
      expect(result.length).toBeGreaterThan(500);
    });
  });

  describe('fetch specific sections', () => {
    it('should return only requested sections', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
        sections: ['RuntimeContext'],
      });

      expect(result).toContain('# upgrade-to-v1/tools');
      expect(result).toContain('RuntimeContext');
      expect(result).toContain('RequestContext');
    });

    it('should handle multiple section requests', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
        sections: ['RuntimeContext', 'Context properties'],
      });

      expect(result).toContain('RuntimeContext');
      expect(result).toContain('RequestContext');
      expect(result).toContain('---'); // Separator between sections
    });

    it('should handle partial section title matches', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
        sections: ['execute'],
      });

      // Should match section containing 'execute' in the title
      expect(result).toContain('execute');
    });

    it('should show available sections when requested section not found', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
        sections: ['NonExistentSection'],
      });

      expect(result).toContain('Requested sections not found');
      expect(result).toContain('Available sections:');
      expect(result).toContain('##'); // Should list available section headers
    });

    it('should be case-insensitive when matching section titles', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
        sections: ['runtimecontext'], // lowercase
      });

      expect(result).toContain('RuntimeContext');
    });
  });

  describe('search by keywords', () => {
    it('should search across all migrations when queryKeywords provided', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        queryKeywords: ['RuntimeContext'],
      });

      expect(result).toContain('# Migration Guide Search Results');
    });

    it('should handle multiple keywords', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        queryKeywords: ['RuntimeContext', 'RequestContext'],
      });

      expect(result).toContain('# Migration Guide Search Results');
    });

    it('should suggest relevant migration paths based on keywords', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        queryKeywords: ['agent', 'voice'],
      });

      expect(result).toContain('# Migration Guide Search Results');
      // Should use the getMatchingPaths utility to find relevant guides
    });

    it('should handle keywords with no matches gracefully', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        queryKeywords: ['xyzabc123nonexistent'],
      });

      expect(result).toContain('# Migration Guide Search Results');
      expect(result).toContain('To see all available migrations');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid path gracefully', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'completely/invalid/path',
      });

      expect(result).toContain('Migration "completely/invalid/path" not found');
      expect(result).toContain('Available migrations:');
    });

    it('should prevent path traversal attacks', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: '../../../etc/passwd',
      });

      expect(result).toContain('Migration "../../../etc/passwd" not found');
    });

    it('should handle empty sections array', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/agent',
        sections: [],
      });

      // Should return full guide when sections is empty
      expect(result).toContain('# upgrade-to-v1/agent');
      expect(result.length).toBeGreaterThan(500);
    });

    it('should handle empty queryKeywords array', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        queryKeywords: [],
      });

      // Should list top-level migrations when queryKeywords is empty
      expect(result).toContain('# migrations');
    });
  });

  describe('content validation', () => {
    it('should preserve markdown formatting in migration content', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
      });

      expect(result).toMatch(/^#+ /m); // Should have markdown headers
      expect(result).toContain('```'); // Should have code blocks
    });

    it('should include before/after code examples', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/tools',
        sections: ['execute'],
      });

      expect(result).toContain('```diff');
      expect(result).toMatch(/^[+-]/m); // Should have diff markers
    });

    it('should not include _template.mdx in listings', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {});

      expect(result).not.toContain('_template');
    });

    it('should strip .mdx extension from file listings', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {});

      // Should show clean names without .mdx
      expect(result).toContain('agentnetwork');
      expect(result).not.toContain('agentnetwork.mdx');
    });
  });

  describe('integration with all migration types', () => {
    it('should handle upgrade-to-v1 migrations', async () => {
      const migrations = [
        'agent',
        'tools',
        'workflows',
        'memory',
        'storage',
        'evals',
        'cli',
        'client',
        'voice',
        'mastra',
      ];

      for (const migration of migrations) {
        const result = await callTool(tools.mastra_mastraMigration, {
          path: `upgrade-to-v1/${migration}`,
          listSections: true,
        });

        expect(result).toContain(`# upgrade-to-v1/${migration} - Section Headers`);
      }
    });

    it('should handle overview migration', async () => {
      const result = await callTool(tools.mastra_mastraMigration, {
        path: 'upgrade-to-v1/overview',
      });

      expect(result).toContain('# upgrade-to-v1/overview');
      expect(result).toContain('Upgrade to Mastra v1');
    });
  });
});

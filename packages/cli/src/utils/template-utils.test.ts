import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  isCancel: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

// Mock fetch for API calls
global.fetch = vi.fn();

describe('template-utils', () => {
  describe('loadTemplates', () => {
    it('should load templates from API', async () => {
      const mockTemplates = [
        {
          githubUrl: 'https://github.com/mastra-ai/template-test',
          title: 'Test Template',
          slug: 'template-test',
          agents: ['test-agent'],
          mcp: [],
          tools: ['test-tool'],
          networks: [],
          workflows: [],
        },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTemplates,
      } as Response);

      const { loadTemplates } = await import('./template-utils');
      const templates = await loadTemplates();

      expect(templates).toEqual(mockTemplates);
      expect(fetch).toHaveBeenCalledWith('https://mastra.ai/api/templates.json');
    });

    it('should use custom API URL from environment variable', async () => {
      const originalEnv = process.env.MASTRA_TEMPLATES_API_URL;
      process.env.MASTRA_TEMPLATES_API_URL = 'http://localhost:3000/api/templates.json';

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      // Re-import to get fresh module with new env var
      vi.resetModules();
      const { loadTemplates } = await import('./template-utils');
      await loadTemplates();

      expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/templates.json');

      // Restore original env
      if (originalEnv === undefined) {
        delete process.env.MASTRA_TEMPLATES_API_URL;
      } else {
        process.env.MASTRA_TEMPLATES_API_URL = originalEnv;
      }
    });

    it('should throw error when API request fails', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      } as Response);

      const { loadTemplates } = await import('./template-utils');
      await expect(loadTemplates()).rejects.toThrow('Failed to load templates');
    });
  });

  describe('findTemplateByName', () => {
    const mockTemplates = [
      {
        githubUrl: 'https://github.com/mastra-ai/template-browsing-agent',
        title: 'Browsing Agent',
        slug: 'template-browsing-agent',
        agents: ['web-agent'],
        mcp: [],
        tools: ['search-tool'],
        networks: [],
        workflows: [],
      },
      {
        githubUrl: 'https://github.com/mastra-ai/template-data-analyst',
        title: 'Data Analyst Agent',
        slug: 'template-data-analyst',
        agents: ['analyst-agent'],
        mcp: [],
        tools: ['query-tool'],
        networks: [],
        workflows: [],
      },
    ];

    it('should find template by exact slug match', async () => {
      const { findTemplateByName } = await import('./template-utils');
      const result = findTemplateByName(mockTemplates, 'template-browsing-agent');
      expect(result).toEqual(mockTemplates[0]);
    });

    it('should find template by slug without template- prefix', async () => {
      const { findTemplateByName } = await import('./template-utils');
      const result = findTemplateByName(mockTemplates, 'browsing-agent');
      expect(result).toEqual(mockTemplates[0]);
    });

    it('should find template by case-insensitive name match', async () => {
      const { findTemplateByName } = await import('./template-utils');
      const result = findTemplateByName(mockTemplates, 'browsing agent');
      expect(result).toEqual(mockTemplates[0]);
    });

    it('should return null if template not found', async () => {
      const { findTemplateByName } = await import('./template-utils');
      const result = findTemplateByName(mockTemplates, 'non-existent-template');
      expect(result).toBeNull();
    });
  });

  describe('getDefaultProjectName', () => {
    it('should remove template- prefix from slug', async () => {
      const mockTemplate = {
        githubUrl: 'https://github.com/mastra-ai/template-browsing-agent',
        title: 'Browsing Agent',
        slug: 'template-browsing-agent',
        agents: [],
        mcp: [],
        tools: [],
        networks: [],
        workflows: [],
      };

      const { getDefaultProjectName } = await import('./template-utils');
      const result = getDefaultProjectName(mockTemplate);
      expect(result).toBe('browsing-agent');
    });

    it('should return slug as-is if no template- prefix', async () => {
      const mockTemplate = {
        githubUrl: 'https://github.com/mastra-ai/custom-agent',
        title: 'Custom Agent',
        slug: 'custom-agent',
        agents: [],
        mcp: [],
        tools: [],
        networks: [],
        workflows: [],
      };

      const { getDefaultProjectName } = await import('./template-utils');
      const result = getDefaultProjectName(mockTemplate);
      expect(result).toBe('custom-agent');
    });
  });

  describe('selectTemplate', () => {
    it('should return selected template when user selects one', async () => {
      const mockTemplates = [
        {
          githubUrl: 'https://github.com/mastra-ai/template-test',
          title: 'Test Template',
          slug: 'template-test',
          agents: ['test-agent'],
          mcp: [],
          tools: ['test-tool'],
          networks: [],
          workflows: ['test-workflow'],
        },
      ];

      const { select, isCancel } = await import('@clack/prompts');
      vi.mocked(select).mockResolvedValue(mockTemplates[0]);
      vi.mocked(isCancel).mockReturnValue(false);

      const { selectTemplate } = await import('./template-utils');
      const result = await selectTemplate(mockTemplates);

      expect(result).toEqual(mockTemplates[0]);
      expect(select).toHaveBeenCalledWith({
        message: 'Select a template:',
        options: [
          {
            value: mockTemplates[0],
            label: 'Test Template',
            hint: '1 agent, 1 tool, 1 workflow',
          },
        ],
      });
    });

    it('should return null when user cancels selection', async () => {
      const mockTemplates = [
        {
          githubUrl: 'https://github.com/mastra-ai/template-test',
          title: 'Test Template',
          slug: 'template-test',
          agents: [],
          mcp: [],
          tools: [],
          networks: [],
          workflows: [],
        },
      ];

      const { select, isCancel } = await import('@clack/prompts');
      vi.mocked(select).mockResolvedValue('cancelled');
      vi.mocked(isCancel).mockReturnValue(true);

      const { selectTemplate } = await import('./template-utils');
      const result = await selectTemplate(mockTemplates);

      expect(result).toBeNull();
    });

    it('should correctly pluralize component counts', async () => {
      const mockTemplates = [
        {
          githubUrl: 'https://github.com/mastra-ai/template-single',
          title: 'Single Components',
          slug: 'template-single',
          agents: ['agent1'],
          mcp: [],
          tools: ['tool1'],
          networks: [],
          workflows: ['workflow1'],
        },
        {
          githubUrl: 'https://github.com/mastra-ai/template-multiple',
          title: 'Multiple Components',
          slug: 'template-multiple',
          agents: ['agent1', 'agent2'],
          mcp: [],
          tools: ['tool1', 'tool2', 'tool3'],
          networks: [],
          workflows: ['workflow1', 'workflow2'],
        },
        {
          githubUrl: 'https://github.com/mastra-ai/template-full',
          title: 'Full Template',
          slug: 'template-full',
          agents: ['agent1'],
          mcp: ['server1'],
          tools: ['tool1', 'tool2'],
          networks: ['network1', 'network2'],
          workflows: ['workflow1'],
        },
      ];

      const { select, isCancel } = await import('@clack/prompts');
      vi.mocked(select).mockResolvedValue(mockTemplates[0]);
      vi.mocked(isCancel).mockReturnValue(false);

      const { selectTemplate } = await import('./template-utils');
      await selectTemplate(mockTemplates);

      expect(select).toHaveBeenCalledWith({
        message: 'Select a template:',
        options: [
          {
            value: mockTemplates[0],
            label: 'Single Components',
            hint: '1 agent, 1 tool, 1 workflow',
          },
          {
            value: mockTemplates[1],
            label: 'Multiple Components',
            hint: '2 agents, 3 tools, 2 workflows',
          },
          {
            value: mockTemplates[2],
            label: 'Full Template',
            hint: '1 agent, 2 tools, 1 workflow, 1 MCP server, 2 agent networks',
          },
        ],
      });
    });

    it('should handle templates with no components gracefully', async () => {
      const mockTemplates = [
        {
          githubUrl: 'https://github.com/mastra-ai/template-empty',
          title: 'Empty Template',
          slug: 'template-empty',
          agents: [],
          mcp: [],
          tools: [],
          networks: [],
          workflows: [],
        },
      ];

      const { select, isCancel } = await import('@clack/prompts');
      vi.mocked(select).mockResolvedValue(mockTemplates[0]);
      vi.mocked(isCancel).mockReturnValue(false);

      const { selectTemplate } = await import('./template-utils');
      const result = await selectTemplate(mockTemplates);

      expect(result).toEqual(mockTemplates[0]);
      expect(select).toHaveBeenCalledWith({
        message: 'Select a template:',
        options: [
          {
            value: mockTemplates[0],
            label: 'Empty Template',
            hint: 'Template components',
          },
        ],
      });
    });
  });
});

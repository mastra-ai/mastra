/**
 * Tests for integration provider implementations
 *
 * This test suite covers the ComposioProvider and ArcadeProvider implementations,
 * testing their API interactions with mocked responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComposioProvider } from './composio';
import { ArcadeProvider } from './arcade';
import { getProvider, listProviders, registerProvider, hasProvider, getProviderNames } from './registry';
import type { ToolProvider, ProviderToolkit, ProviderTool } from './types';

// Mock fetch globally
const originalFetch = global.fetch;

describe('ComposioProvider', () => {
  let provider: ComposioProvider;
  const mockApiKey = 'test-composio-api-key';

  beforeEach(() => {
    provider = new ComposioProvider(mockApiKey);
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getStatus', () => {
    it('should return connected status when API key is configured', () => {
      const status = provider.getStatus();
      expect(status).toEqual({
        provider: 'composio',
        connected: true,
        name: 'Composio',
        description: '500+ managed integrations with built-in auth',
        icon: '/icons/composio.svg',
      });
    });

    it('should return disconnected status when API key is missing', () => {
      const providerWithoutKey = new ComposioProvider('');
      const status = providerWithoutKey.getStatus();
      expect(status.connected).toBe(false);
    });
  });

  describe('listToolkits', () => {
    it('should successfully list toolkits', async () => {
      const mockResponse = {
        items: [
          {
            name: 'GitHub',
            slug: 'github',
            meta: {
              description: 'GitHub integration',
              logo: 'https://example.com/github.png',
              categories: [
                { id: 'dev', name: 'development' },
                { id: 'vcs', name: 'vcs' },
              ],
              tools_count: 50,
            },
          },
          {
            name: 'Slack',
            slug: 'slack',
            meta: {
              description: 'Slack integration',
              logo: 'https://example.com/slack.png',
              categories: [{ id: 'comm', name: 'communication' }],
              tools_count: 30,
            },
          },
        ],
        cursor: 'next-page-cursor',
        hasMore: true,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listToolkits();

      expect(result.toolkits).toHaveLength(2);
      expect(result.toolkits[0]).toEqual({
        slug: 'github',
        name: 'GitHub',
        description: 'GitHub integration',
        icon: 'https://example.com/github.png',
        category: 'development',
        toolCount: 50,
        metadata: {
          categories: ['development', 'vcs'],
        },
      });
      expect(result.nextCursor).toBe('next-page-cursor');
      expect(result.hasMore).toBe(true);
    });

    it('should handle search and category filters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], cursor: undefined, hasMore: false }),
      });

      await provider.listToolkits({
        search: 'github',
        category: 'development',
        limit: 10,
        cursor: 'page-2',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=github'),
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('category=development'),
        expect.any(Object),
      );
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('limit=10'), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('cursor=page-2'), expect.any(Object));
    });

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new ComposioProvider('');
      await expect(providerWithoutKey.listToolkits()).rejects.toThrow('COMPOSIO_API_KEY is not configured');
    });

    it('should throw error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(provider.listToolkits()).rejects.toThrow('Composio API error: 401 Unauthorized');
    });

    it('should handle toolkits without categories', async () => {
      const mockResponse = {
        items: [
          {
            name: 'Custom App',
            slug: 'custom-app',
            meta: {
              description: 'Custom integration',
              logo: 'https://example.com/custom.png',
            },
          },
        ],
        hasMore: false,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listToolkits();
      expect(result.toolkits[0]?.category).toBeUndefined();
      expect(result.toolkits[0]?.toolCount).toBeUndefined();
    });
  });

  describe('listTools', () => {
    it('should successfully list tools', async () => {
      const mockResponse = {
        items: [
          {
            name: 'Create Issue',
            slug: 'github_create_issue',
            description: 'Create a new GitHub issue',
            input_parameters: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                body: { type: 'string' },
              },
            },
            output_parameters: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                url: { type: 'string' },
              },
            },
            toolkit: {
              slug: 'github',
              name: 'GitHub',
            },
          },
        ],
        cursor: 'tools-cursor',
        hasMore: false,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listTools({ toolkitSlug: 'github' });

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toEqual({
        slug: 'github_create_issue',
        name: 'Create Issue',
        description: 'Create a new GitHub issue',
        inputSchema: mockResponse.items[0]!.input_parameters,
        outputSchema: mockResponse.items[0]!.output_parameters,
        toolkit: 'github',
        metadata: {
          toolkitName: 'GitHub',
          toolkitLogo: undefined,
        },
      });
      expect(result.nextCursor).toBe('tools-cursor');
      expect(result.hasMore).toBe(false);
    });

    it('should handle toolkitSlug filter', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], hasMore: false }),
      });

      await provider.listTools({ toolkitSlug: 'github' });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('toolkit_slug=github'),
        expect.any(Object),
      );
    });

    it('should handle toolkitSlugs array filter', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], hasMore: false }),
      });

      await provider.listTools({ toolkitSlugs: ['github', 'slack'] });

      // Should use the first toolkit as primary filter
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('toolkit_slug=github'),
        expect.any(Object),
      );
    });

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new ComposioProvider('');
      await expect(providerWithoutKey.listTools()).rejects.toThrow('COMPOSIO_API_KEY is not configured');
    });

    it('should throw error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(provider.listTools()).rejects.toThrow('Composio API error: 500 Internal Server Error');
    });

    it('should handle tools without parameters or response schemas', async () => {
      const mockResponse = {
        items: [
          {
            name: 'Simple Tool',
            slug: 'simple_tool',
            description: 'A simple tool',
          },
        ],
        hasMore: false,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listTools();
      expect(result.tools[0]?.inputSchema).toEqual({});
      expect(result.tools[0]?.outputSchema).toBeUndefined();
    });
  });

  describe('getTool', () => {
    it('should successfully get tool details', async () => {
      const mockTool = {
        name: 'Create Issue',
        slug: 'github_create_issue',
        description: 'Create a new GitHub issue',
        input_parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
        output_parameters: {
          type: 'object',
          properties: {
            id: { type: 'number' },
          },
        },
        toolkit: {
          slug: 'github',
          name: 'GitHub',
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTool,
      });

      const result = await provider.getTool('github_create_issue');

      expect(result).toEqual({
        slug: 'github_create_issue',
        name: 'Create Issue',
        description: 'Create a new GitHub issue',
        inputSchema: mockTool.input_parameters,
        outputSchema: mockTool.output_parameters,
        toolkit: 'github',
        metadata: {
          toolkitName: 'GitHub',
          toolkitLogo: undefined,
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://backend.composio.dev/api/v3/tools/github_create_issue',
        expect.objectContaining({
          headers: {
            'x-api-key': mockApiKey,
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new ComposioProvider('');
      await expect(providerWithoutKey.getTool('test-tool')).rejects.toThrow('COMPOSIO_API_KEY is not configured');
    });

    it('should throw error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(provider.getTool('nonexistent-tool')).rejects.toThrow('Composio API error: 404 Not Found');
    });
  });
});

describe('ArcadeProvider', () => {
  let provider: ArcadeProvider;
  const mockApiKey = 'test-arcade-api-key';

  beforeEach(() => {
    provider = new ArcadeProvider(mockApiKey);
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getStatus', () => {
    it('should return connected status when API key is configured', () => {
      const status = provider.getStatus();
      expect(status).toEqual({
        provider: 'arcade',
        connected: true,
        name: 'Arcade.dev',
        description: 'Tool calling platform with auth management',
        icon: '/icons/arcade.svg',
      });
    });

    it('should return disconnected status when API key is missing', () => {
      const providerWithoutKey = new ArcadeProvider('');
      const status = providerWithoutKey.getStatus();
      expect(status.connected).toBe(false);
    });
  });

  describe('listToolkits', () => {
    it('should derive toolkits from tool toolkit field', async () => {
      const mockResponse = {
        items: [
          {
            fully_qualified_name: 'tool-1',
            name: 'GitHub Create Issue',
            description: 'Create an issue',
            toolkit: { name: 'github' },
          },
          {
            fully_qualified_name: 'tool-2',
            name: 'GitHub Close Issue',
            description: 'Close an issue',
            toolkit: { name: 'github' },
          },
          {
            fully_qualified_name: 'tool-3',
            name: 'Slack Send Message',
            description: 'Send a message',
            toolkit: { name: 'slack' },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listToolkits();

      expect(result.toolkits).toHaveLength(2);
      expect(result.toolkits).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            slug: 'github',
            name: 'Github',
            description: 'Github tools',
            toolCount: 2,
          }),
          expect.objectContaining({
            slug: 'slack',
            name: 'Slack',
            description: 'Slack tools',
            toolCount: 1,
          }),
        ]),
      );
    });

    it('should handle tools without toolkit field', async () => {
      const mockResponse = {
        items: [
          {
            fully_qualified_name: 'tool-1',
            name: 'Generic Tool',
            description: 'A generic tool',
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listToolkits();

      expect(result.toolkits).toHaveLength(1);
      expect(result.toolkits[0]?.slug).toBe('general');
      expect(result.toolkits[0]?.name).toBe('General');
    });

    it('should apply search filter to toolkit names', async () => {
      const mockResponse = {
        items: [
          {
            fully_qualified_name: 'tool-1',
            name: 'GitHub Tool',
            description: 'GitHub tool',
            toolkit: { name: 'github' },
          },
          {
            fully_qualified_name: 'tool-2',
            name: 'Slack Tool',
            description: 'Slack tool',
            toolkit: { name: 'slack' },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listToolkits({ search: 'git' });

      expect(result.toolkits).toHaveLength(1);
      expect(result.toolkits[0]?.slug).toBe('github');
    });

    it('should handle pagination for derived toolkits', async () => {
      const mockResponse = {
        items: Array.from({ length: 50 }, (_, i) => ({
          fully_qualified_name: `tool-${i}`,
          name: `Tool ${i}`,
          description: `Tool ${i}`,
          toolkit: { name: `toolkit-${i}` },
        })),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listToolkits({ limit: 10 });

      expect(result.toolkits.length).toBeLessThanOrEqual(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBeDefined();
    });

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new ArcadeProvider('');
      await expect(providerWithoutKey.listToolkits()).rejects.toThrow('ARCADE_API_KEY is not configured');
    });

    it('should throw error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(provider.listToolkits()).rejects.toThrow('Arcade API error: 401 Unauthorized');
    });
  });

  describe('listTools', () => {
    it('should successfully list tools', async () => {
      const mockResponse = {
        items: [
          {
            fully_qualified_name: 'tool-1',
            name: 'Create Issue',
            description: 'Create a GitHub issue',
            toolkit: { name: 'github' },
            input: {
              type: 'object',
              properties: {
                title: { type: 'string' },
              },
            },
            output: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
            },
          },
        ],
        total_count: 1,
        limit: 20,
        offset: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listTools();

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toEqual({
        slug: 'tool-1',
        name: 'Create Issue',
        description: 'Create a GitHub issue',
        inputSchema: mockResponse.items[0]!.input,
        outputSchema: mockResponse.items[0]!.output,
        toolkit: 'github',
        metadata: {
          arcadeId: 'tool-1',
          qualifiedName: undefined,
        },
      });
    });

    it('should handle toolkit filter', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], total_count: 0 }),
      });

      await provider.listTools({ toolkitSlug: 'github' });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('toolkit=github'), expect.any(Object));
    });

    it('should handle client-side filtering for multiple toolkits', async () => {
      const mockResponse = {
        items: [
          {
            fully_qualified_name: 'tool-1',
            name: 'GitHub Tool',
            description: 'GitHub tool',
            toolkit: { name: 'github' },
          },
          {
            fully_qualified_name: 'tool-2',
            name: 'Slack Tool',
            description: 'Slack tool',
            toolkit: { name: 'slack' },
          },
        ],
        total_count: 2,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listTools({ toolkitSlugs: ['github', 'slack'] });

      expect(result.tools).toHaveLength(2);
    });

    it('should handle offset-based pagination', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ items: [], total_count: 0, limit: 20, offset: 0 }),
      });

      await provider.listTools({ limit: 10, cursor: '20' });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('limit=10'), expect.any(Object));
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('offset=20'), expect.any(Object));
    });

    it('should calculate hasMore based on total and returned count', async () => {
      const mockResponse = {
        items: Array.from({ length: 20 }, (_, i) => ({
          fully_qualified_name: `tool-${i}`,
          name: `Tool ${i}`,
          description: `Tool ${i}`,
        })),
        total_count: 50,
        limit: 20,
        offset: 0,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await provider.listTools({ limit: 20 });

      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('20');
    });

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new ArcadeProvider('');
      await expect(providerWithoutKey.listTools()).rejects.toThrow('ARCADE_API_KEY is not configured');
    });

    it('should throw error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(provider.listTools()).rejects.toThrow('Arcade API error: 500 Internal Server Error');
    });
  });

  describe('getTool', () => {
    it('should successfully get tool details', async () => {
      const mockTool = {
        fully_qualified_name: 'tool-1',
        name: 'Create Issue',
        description: 'Create a GitHub issue',
        toolkit: { name: 'github' },
        input: {
          type: 'object',
          properties: {
            title: { type: 'string' },
          },
        },
        output: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTool,
      });

      const result = await provider.getTool('tool-1');

      expect(result).toEqual({
        slug: 'tool-1',
        name: 'Create Issue',
        description: 'Create a GitHub issue',
        inputSchema: mockTool.input,
        outputSchema: mockTool.output,
        toolkit: 'github',
        metadata: {
          arcadeId: 'tool-1',
          qualifiedName: undefined,
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.arcade.dev/v1/tools/tool-1',
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json',
          },
        }),
      );
    });

    it('should throw error when API key is not configured', async () => {
      const providerWithoutKey = new ArcadeProvider('');
      await expect(providerWithoutKey.getTool('test-tool')).rejects.toThrow('ARCADE_API_KEY is not configured');
    });

    it('should throw error on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(provider.getTool('nonexistent-tool')).rejects.toThrow('Arcade API error: 404 Not Found');
    });
  });
});

describe('Provider Registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProvider', () => {
    it('should return composio provider', () => {
      const provider = getProvider('composio');
      expect(provider).toBeInstanceOf(ComposioProvider);
      expect(provider.name).toBe('composio');
    });

    it('should return arcade provider', () => {
      const provider = getProvider('arcade');
      expect(provider).toBeInstanceOf(ArcadeProvider);
      expect(provider.name).toBe('arcade');
    });
  });

  describe('listProviders', () => {
    it('should list all registered providers with their status', async () => {
      const providers = await listProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: 'composio',
            name: 'Composio',
          }),
          expect.objectContaining({
            provider: 'arcade',
            name: 'Arcade.dev',
          }),
        ]),
      );
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered providers', () => {
      expect(hasProvider('composio')).toBe(true);
      expect(hasProvider('arcade')).toBe(true);
    });
  });

  describe('getProviderNames', () => {
    it('should return all registered provider names', () => {
      const names = getProviderNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('composio');
      expect(names).toContain('arcade');
    });
  });

  describe('registerProvider', () => {
    it('should allow registering custom providers', () => {
      class MockProvider implements ToolProvider {
        readonly name = 'composio' as const;

        getStatus() {
          return {
            provider: 'composio' as const,
            connected: true,
            name: 'Mock Provider',
            description: 'Test provider',
          };
        }

        async listToolkits() {
          return { toolkits: [], hasMore: false };
        }

        async listTools() {
          return { tools: [], hasMore: false };
        }

        async getTool(): Promise<ProviderTool> {
          return {
            slug: 'test',
            name: 'Test Tool',
            description: 'Test',
            inputSchema: {},
            toolkit: 'test',
          };
        }
      }

      const mockProvider = new MockProvider();
      registerProvider('composio', mockProvider);

      const provider = getProvider('composio');
      expect(provider).toBe(mockProvider);
    });
  });
});

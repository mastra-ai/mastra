import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type {
  ToolProvider,
  ToolProviderListResult,
  ToolProviderToolkit,
  ToolProviderToolInfo,
  ListToolProviderToolsOptions,
  ResolveToolProviderToolsOptions,
} from '@mastra/core/tool-provider';
import type { StorageToolConfig } from '@mastra/core/storage';
import type { ToolAction } from '@mastra/core/tools';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { MastraEditor } from './index';
import { ComposioToolProvider } from './providers/composio';
import { ArcadeToolProvider } from './providers/arcade';

/**
 * A mock tool provider for tests. Implements the full ToolProvider interface.
 */
function createMockToolProvider(
  id: string,
  toolkits: ToolProviderToolkit[],
  toolMap: Record<string, { name: string; description: string; toolkit?: string }>,
): ToolProvider {
  return {
    info: { id, name: `${id} provider`, description: `Provider ${id}` },
    listToolkits: vi.fn(
      async (): Promise<ToolProviderListResult<ToolProviderToolkit>> => ({
        data: toolkits,
      }),
    ),
    listTools: vi.fn(
      async (options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>> => {
        let tools = Object.entries(toolMap).map(([slug, t]) => ({
          slug,
          name: t.name,
          description: t.description,
          toolkit: t.toolkit,
        }));
        if (options?.toolkit) {
          tools = tools.filter(t => t.toolkit === options.toolkit);
        }
        if (options?.search) {
          const q = options.search.toLowerCase();
          tools = tools.filter(t => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
        }
        return { data: tools };
      },
    ),
    getToolSchema: vi.fn(async (slug: string) => {
      const t = toolMap[slug];
      if (!t) return null;
      return { type: 'object', properties: { input: { type: 'string' } } };
    }),
    resolveTools: vi.fn(
      async (
        toolSlugs: string[],
        toolConfigs?: Record<string, StorageToolConfig>,
        _options?: ResolveToolProviderToolsOptions,
      ): Promise<Record<string, ToolAction<any, any, any>>> => {
        const result: Record<string, ToolAction<any, any, any>> = {};
        for (const slug of toolSlugs) {
          const t = toolMap[slug];
          if (!t) continue;
          const desc = toolConfigs?.[slug]?.description ?? t.description;
          result[slug] = {
            id: slug,
            description: desc,
            execute: vi.fn(async () => ({ result: `executed ${slug}` })),
          } as any;
        }
        return result;
      },
    ),
  };
}

const createTestStorage = () => {
  return new LibSQLStore({
    id: `test-${randomUUID()}`,
    url: ':memory:',
  });
};

describe('Integration Tools (tool providers)', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;
  let mockProvider: ToolProvider;

  const TOOL_MAP = {
    GITHUB_CREATE_ISSUE: { name: 'Create Issue', description: 'Create a GitHub issue', toolkit: 'GITHUB' },
    GITHUB_LIST_REPOS: { name: 'List Repos', description: 'List GitHub repos', toolkit: 'GITHUB' },
    SLACK_SEND_MESSAGE: { name: 'Send Message', description: 'Send a Slack message', toolkit: 'SLACK' },
  };

  const TOOLKITS = [
    { slug: 'GITHUB', name: 'GitHub', description: 'GitHub integration' },
    { slug: 'SLACK', name: 'Slack', description: 'Slack integration' },
  ];

  beforeEach(async () => {
    storage = createTestStorage();
    mockProvider = createMockToolProvider('composio', TOOLKITS, TOOL_MAP);
    editor = new MastraEditor({
      toolProviders: { composio: mockProvider },
    });
    mastra = new Mastra({ storage, editor });
    await storage.init();
  });

  afterEach(async () => {
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.dangerouslyClearAll();
  });

  describe('MastraEditor tool provider config', () => {
    it('should register and retrieve tool providers', () => {
      expect(editor.getToolProvider('composio')).toBe(mockProvider);
      expect(editor.getToolProvider('nonexistent')).toBeUndefined();
    });

    it('should list all registered providers', () => {
      const providers = editor.getToolProviders();
      expect(Object.keys(providers)).toEqual(['composio']);
      expect(providers.composio).toBe(mockProvider);
    });

    it('should handle no tool providers configured', () => {
      const emptyEditor = new MastraEditor();
      expect(emptyEditor.getToolProviders()).toEqual({});
      expect(emptyEditor.getToolProvider('composio')).toBeUndefined();
    });
  });

  describe('Agent hydration with integrationTools', () => {
    it('should resolve integration tools from a registered provider', async () => {
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({
        agent: {
          id: 'agent-with-integration',
          name: 'Integration Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          integrationTools: {
            composio: {
              tools: {
                GITHUB_CREATE_ISSUE: {},
                SLACK_SEND_MESSAGE: {},
              },
            },
          },
        },
      });

      const agent = await editor.agent.getById('agent-with-integration');
      expect(agent).toBeInstanceOf(Agent);

      const tools = await agent!.listTools();
      expect(tools['GITHUB_CREATE_ISSUE']).toBeDefined();
      expect(tools['SLACK_SEND_MESSAGE']).toBeDefined();
      expect(tools['GITHUB_LIST_REPOS']).toBeUndefined();

      expect(mockProvider.resolveTools).toHaveBeenCalledWith(
        expect.arrayContaining(['GITHUB_CREATE_ISSUE', 'SLACK_SEND_MESSAGE']),
        expect.objectContaining({
          GITHUB_CREATE_ISSUE: {},
          SLACK_SEND_MESSAGE: {},
        }),
        { requestContext: undefined },
      );
    });

    it('should apply description overrides from integrationTools config', async () => {
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({
        agent: {
          id: 'agent-override-integration',
          name: 'Override Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          integrationTools: {
            composio: {
              tools: {
                GITHUB_CREATE_ISSUE: { description: 'Custom create issue desc' },
                SLACK_SEND_MESSAGE: {},
              },
            },
          },
        },
      });

      const agent = await editor.agent.getById('agent-override-integration');
      const tools = await agent!.listTools();

      // Agent-level override should take precedence
      expect(tools['GITHUB_CREATE_ISSUE'].description).toBe('Custom create issue desc');
      // No override — provider's description used
      expect(tools['SLACK_SEND_MESSAGE'].description).toBe('Send a Slack message');
    });

    it('should include no tools when tools key is omitted (provider registered only)', async () => {
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({
        agent: {
          id: 'agent-no-tools',
          name: 'No Tools Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          integrationTools: {
            composio: {},
          },
        },
      });

      const agent = await editor.agent.getById('agent-no-tools');
      const tools = await agent!.listTools();

      // composio: {} (no tools key) = provider registered but no tools selected
      expect(mockProvider.resolveTools).not.toHaveBeenCalled();
      expect(Object.keys(tools).length).toBe(0);
    });

    it('should include all provider tools when tools is an empty object', async () => {
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({
        agent: {
          id: 'agent-all-integration',
          name: 'All Tools Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          integrationTools: {
            composio: { tools: {} },
          },
        },
      });

      const agent = await editor.agent.getById('agent-all-integration');
      const tools = await agent!.listTools();

      // composio: { tools: {} } = all tools from provider
      // Should first call listTools() to discover all slugs, then resolveTools with those slugs
      expect(mockProvider.listTools).toHaveBeenCalled();
      expect(mockProvider.resolveTools).toHaveBeenCalledWith(
        expect.arrayContaining(['GITHUB_CREATE_ISSUE', 'GITHUB_LIST_REPOS', 'SLACK_SEND_MESSAGE']),
        {},
        { requestContext: undefined },
      );
      // All 3 tools should be resolved
      expect(Object.keys(tools).length).toBe(3);
    });

    it('should warn when referenced provider is not registered', async () => {
      const warnSpy = vi.fn();
      const freshStorage = createTestStorage();
      const editorWithLogger = new MastraEditor({
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });
      const _mastra = new Mastra({ storage: freshStorage, editor: editorWithLogger });
      await freshStorage.init();

      const agentsStore = await freshStorage.getStore('agents');
      await agentsStore?.create({
        agent: {
          id: 'agent-missing-provider',
          name: 'Missing Provider Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          integrationTools: {
            nonexistent_provider: {
              tools: { SOME_TOOL: {} },
            },
          },
        },
      });

      const agent = await editorWithLogger.agent.getById('agent-missing-provider');
      expect(agent).toBeInstanceOf(Agent);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent_provider'));
    });

    it('should combine integration tools with regular tools', async () => {
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({
        agent: {
          id: 'agent-combined',
          name: 'Combined Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: {
            myRegularTool: {},
          },
          integrationTools: {
            composio: {
              tools: {
                GITHUB_CREATE_ISSUE: {},
              },
            },
          },
        },
      });

      // Register a code-defined tool on Mastra
      mastra.addTool({
        id: 'myRegularTool',
        description: 'A regular tool',
        execute: async () => ({ ok: true }),
      });

      const agent = await editor.agent.getById('agent-combined');
      const tools = await agent!.listTools();

      expect(tools['myRegularTool']).toBeDefined();
      expect(tools['GITHUB_CREATE_ISSUE']).toBeDefined();
    });

    it('should combine integration tools from multiple providers', async () => {
      const secondProvider = createMockToolProvider('another', [], {
        JIRA_CREATE_TICKET: { name: 'Create Ticket', description: 'Create a Jira ticket', toolkit: 'JIRA' },
      });

      const multiEditor = new MastraEditor({
        toolProviders: {
          composio: mockProvider,
          another: secondProvider,
        },
      });
      const freshStorage = createTestStorage();
      const _mastra = new Mastra({ storage: freshStorage, editor: multiEditor });
      await freshStorage.init();

      const agentsStore = await freshStorage.getStore('agents');
      await agentsStore?.create({
        agent: {
          id: 'agent-multi-provider',
          name: 'Multi Provider Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          integrationTools: {
            composio: {
              tools: { GITHUB_CREATE_ISSUE: {} },
            },
            another: {
              tools: { JIRA_CREATE_TICKET: {} },
            },
          },
        },
      });

      const agent = await multiEditor.agent.getById('agent-multi-provider');
      const tools = await agent!.listTools();

      expect(tools['GITHUB_CREATE_ISSUE']).toBeDefined();
      expect(tools['JIRA_CREATE_TICKET']).toBeDefined();
    });
  });

  describe.skipIf(!process.env.COMPOSIO_API_KEY)(
    'ComposioToolProvider e2e (real API, requires COMPOSIO_API_KEY)',
    () => {
      let composioProvider: ComposioToolProvider;

      beforeEach(() => {
        composioProvider = new ComposioToolProvider({ apiKey: process.env.COMPOSIO_API_KEY! });
      });

      it('should list toolkits including GitHub', async () => {
        const result = await composioProvider.listToolkits();
        expect(result.data.length).toBeGreaterThan(0);
        const github = result.data.find(tk => tk.slug.toLowerCase() === 'github');
        expect(github).toBeDefined();
        expect(github!.name).toBeTruthy();
      });

      it('should list tools for a toolkit', async () => {
        const result = await composioProvider.listTools({ toolkit: 'GITHUB', perPage: 50 });
        expect(result.data.length).toBeGreaterThan(0);
        const slugs = result.data.map(t => t.slug);
        expect(slugs.some(s => s.includes('GITHUB'))).toBe(true);
      });

      it('should get a tool schema', async () => {
        const schema = await composioProvider.getToolSchema('GITHUB_LIST_REPOSITORY_ISSUES');
        expect(schema).not.toBeNull();
        expect(schema!.properties).toBeDefined();
        expect((schema!.properties as any).owner).toBeDefined();
        expect((schema!.properties as any).repo).toBeDefined();
      });

      it('should fetch executable tools and execute GITHUB_LIST_REPOSITORY_ISSUES', async () => {
        const tools = await composioProvider.resolveTools(['GITHUB_LIST_REPOSITORY_ISSUES'], undefined, {
          userId: 'default',
        });

        expect(tools['GITHUB_LIST_REPOSITORY_ISSUES']).toBeDefined();
        const tool = tools['GITHUB_LIST_REPOSITORY_ISSUES']!;
        expect(tool.id).toBe('GITHUB_LIST_REPOSITORY_ISSUES');
        expect(typeof tool.execute).toBe('function');

        const result = await tool.execute!(
          { owner: 'mastra-ai', repo: 'mastra', per_page: 2, state: 'open' },
          {} as any,
        );
        expect(result).toBeDefined();
        expect(result.successful).not.toBe(false);
        expect(result.data?.issues?.length).toBeGreaterThan(0);
      }, 30_000);

      it('should apply description overrides via resolveTools', async () => {
        const tools = await composioProvider.resolveTools(
          ['GITHUB_LIST_REPOSITORY_ISSUES'],
          { GITHUB_LIST_REPOSITORY_ISSUES: { description: 'Custom description for test' } },
          { userId: 'default' },
        );

        expect(tools['GITHUB_LIST_REPOSITORY_ISSUES']!.description).toBe('Custom description for test');
      });

      it('should hydrate a stored agent with Composio integration tools', async () => {
        const freshStorage = createTestStorage();
        const composioEditor = new MastraEditor({
          toolProviders: { composio: composioProvider },
        });
        const _mastra = new Mastra({ storage: freshStorage, editor: composioEditor });
        await freshStorage.init();

        const agentsStore = await freshStorage.getStore('agents');
        await agentsStore?.create({
          agent: {
            id: 'composio-e2e-agent',
            name: 'Composio E2E Agent',
            instructions: 'You list GitHub issues',
            model: { provider: 'openai', name: 'gpt-4' },
            integrationTools: {
              composio: {
                tools: {
                  GITHUB_LIST_REPOSITORY_ISSUES: { description: 'Lists issues from a repo (e2e override)' },
                },
              },
            },
          },
        });

        const agent = await composioEditor.agent.getById('composio-e2e-agent');
        expect(agent).toBeInstanceOf(Agent);

        const tools = await agent!.listTools();
        expect(tools['GITHUB_LIST_REPOSITORY_ISSUES']).toBeDefined();
        expect(tools['GITHUB_LIST_REPOSITORY_ISSUES'].description).toBe('Lists issues from a repo (e2e override)');
        expect(typeof tools['GITHUB_LIST_REPOSITORY_ISSUES'].execute).toBe('function');

        // Actually execute the tool through the hydrated agent
        const result = await tools['GITHUB_LIST_REPOSITORY_ISSUES'].execute!(
          {
            owner: 'mastra-ai',
            repo: 'mastra',
            per_page: 1,
            state: 'open',
          },
          {} as any,
        );
        expect(result).toBeDefined();
        expect(result.successful).not.toBe(false);
        expect(result.data?.issues?.length).toBeGreaterThan(0);

        await agentsStore?.dangerouslyClearAll();
      }, 30_000);
    },
  );

  describe('Conditional integrationTools', () => {
    it('should resolve conditional integrationTools based on request context', async () => {
      const agentsStore = await storage.getStore('agents');
      await agentsStore?.create({
        agent: {
          id: 'agent-conditional-integration',
          name: 'Conditional Integration Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          integrationTools: [
            {
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'tier', operator: 'equals' as const, value: 'premium' }],
              },
              value: {
                composio: {
                  tools: {
                    GITHUB_CREATE_ISSUE: {},
                    SLACK_SEND_MESSAGE: {},
                    GITHUB_LIST_REPOS: {},
                  },
                },
              },
            },
            {
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'tier', operator: 'equals' as const, value: 'free' }],
              },
              value: {
                composio: {
                  tools: {
                    GITHUB_CREATE_ISSUE: {},
                  },
                },
              },
            },
          ],
        },
      });

      // Premium tier: should get all 3 tools
      const premiumAgent = await editor.agent.getById('agent-conditional-integration');
      expect(premiumAgent).toBeInstanceOf(Agent);

      const premiumTools = await premiumAgent!.listTools({
        requestContext: new RequestContext([['tier', 'premium']]),
      });
      expect(premiumTools['GITHUB_CREATE_ISSUE']).toBeDefined();
      expect(premiumTools['SLACK_SEND_MESSAGE']).toBeDefined();
      expect(premiumTools['GITHUB_LIST_REPOS']).toBeDefined();

      // Free tier: should get only 1 tool
      const freeTools = await premiumAgent!.listTools({
        requestContext: new RequestContext([['tier', 'free']]),
      });
      expect(freeTools['GITHUB_CREATE_ISSUE']).toBeDefined();
      expect(freeTools['SLACK_SEND_MESSAGE']).toBeUndefined();
      expect(freeTools['GITHUB_LIST_REPOS']).toBeUndefined();
    });

    it('should combine conditional integrationTools with static tools', async () => {
      const agentsStore = await storage.getStore('agents');

      mastra.addTool({
        id: 'staticTool',
        description: 'A static tool',
        execute: async () => ({ ok: true }),
      } as any);

      await agentsStore?.create({
        agent: {
          id: 'agent-mixed-conditional',
          name: 'Mixed Conditional Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          tools: {
            staticTool: {},
          },
          integrationTools: [
            {
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'env', operator: 'equals' as const, value: 'production' }],
              },
              value: {
                composio: {
                  tools: {
                    GITHUB_CREATE_ISSUE: {},
                    SLACK_SEND_MESSAGE: {},
                  },
                },
              },
            },
            {
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'env', operator: 'equals' as const, value: 'development' }],
              },
              value: {
                composio: {
                  tools: {
                    GITHUB_CREATE_ISSUE: {},
                  },
                },
              },
            },
          ],
        },
      });

      const agent = await editor.agent.getById('agent-mixed-conditional');
      expect(agent).toBeInstanceOf(Agent);

      // Production: static tool + 2 integration tools
      const prodTools = await agent!.listTools({
        requestContext: new RequestContext([['env', 'production']]),
      });
      expect(prodTools['staticTool']).toBeDefined();
      expect(prodTools['GITHUB_CREATE_ISSUE']).toBeDefined();
      expect(prodTools['SLACK_SEND_MESSAGE']).toBeDefined();

      // Development: static tool + 1 integration tool
      const devTools = await agent!.listTools({
        requestContext: new RequestContext([['env', 'development']]),
      });
      expect(devTools['staticTool']).toBeDefined();
      expect(devTools['GITHUB_CREATE_ISSUE']).toBeDefined();
      expect(devTools['SLACK_SEND_MESSAGE']).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Arcade e2e tests — skipped unless ARCADE_API_KEY is set
// ---------------------------------------------------------------------------
describe.skipIf(!process.env.ARCADE_API_KEY)('ArcadeToolProvider e2e (real API)', () => {
  let provider: InstanceType<typeof ArcadeToolProvider>;

  beforeEach(() => {
    provider = new ArcadeToolProvider({ apiKey: process.env.ARCADE_API_KEY! });
  });

  it('should list toolkits from cached catalog', async () => {
    const result = await provider.listToolkits();
    // Seeded with 93 known toolkits
    expect(result.data.length).toBeGreaterThanOrEqual(90);
    const github = result.data.find(t => t.slug === 'Github');
    expect(github).toBeDefined();
    expect(github!.name).toBe('GitHub');
  });

  it('should list tools for a toolkit', async () => {
    const result = await provider.listTools({ toolkit: 'Github', perPage: 5 });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.length).toBeLessThanOrEqual(5);
    expect(result.data[0]!.toolkit).toBe('Github');
    expect(result.pagination?.total).toBeGreaterThan(5);
  }, 30_000);

  it('should absorb new toolkits into cache from listTools', async () => {
    const before = (await provider.listToolkits()).data.length;
    // Listing tools may discover new toolkits not in the seed catalog
    await provider.listTools({ perPage: 100 });
    const after = (await provider.listToolkits()).data.length;
    // Should be >= before (never lose toolkits)
    expect(after).toBeGreaterThanOrEqual(before);
  }, 30_000);

  it('should get a tool schema', async () => {
    const schema = await provider.getToolSchema('Github.GetRepository');
    expect(schema).toBeDefined();
    expect(schema!.type).toBe('object');
    expect(schema!.properties).toBeDefined();
    const props = schema!.properties as Record<string, any>;
    expect(props.owner).toBeDefined();
    expect(props.repo).toBeDefined();
  }, 30_000);

  it('should fetch executable tools with description overrides', async () => {
    const tools = await provider.resolveTools(['Github.GetRepository'], {
      'Github.GetRepository': { description: 'Custom Arcade desc' },
    });
    const tool = tools['Github.GetRepository'];
    expect(tool).toBeDefined();
    expect(tool.id).toBe('Github.GetRepository');
    expect(tool.description).toBe('Custom Arcade desc');
    expect(typeof tool.execute).toBe('function');
    expect(tool.inputSchema).toBeDefined();
  }, 30_000);

  it('should execute a tool (returns auth-required or data)', async () => {
    const tools = await provider.resolveTools(['Github.GetRepository']);
    const tool = tools['Github.GetRepository'];
    expect(tool).toBeDefined();

    const result: any = await tool.execute!({ owner: 'mastra-ai', repo: 'mastra' }, {} as any);
    expect(result).toBeDefined();
    // Either auth-required or actual data
    if (result.authorization_required) {
      expect(result.url).toBeTruthy();
    } else {
      expect(typeof result).toBe('object');
    }
  }, 30_000);

  it('should hydrate a stored agent with Arcade integration tools', async () => {
    const _storage = new LibSQLStore({ id: `arcade-e2e-${randomUUID()}`, url: ':memory:' });
    const _editor = new MastraEditor({ toolProviders: { arcade: provider } });
    const _mastra = new Mastra({ storage: _storage, editor: _editor });
    await _storage.init();

    const agentsStore = await _storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'arcade-e2e-agent',
        name: 'Arcade E2E Agent',
        instructions: 'Test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        integrationTools: {
          arcade: {
            tools: {
              'Github.GetRepository': { description: 'Arcade hydrated override' },
            },
          },
        },
      },
    });

    const agent = await _editor.agent.getById('arcade-e2e-agent');
    expect(agent).toBeInstanceOf(Agent);

    const tools = await agent!.listTools();
    expect(tools['Github.GetRepository']).toBeDefined();
    expect(tools['Github.GetRepository'].description).toBe('Arcade hydrated override');
  }, 60_000);
});

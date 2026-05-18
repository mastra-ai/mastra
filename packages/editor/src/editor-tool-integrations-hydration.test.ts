import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { BaseToolIntegration } from '@mastra/core/tool-integration';
import type {
  AuthFlowStatus,
  AuthorizeOpts,
  ListToolsResult,
  ResolveToolsOpts,
  ToolIntegrationCapabilities,
  ToolService,
} from '@mastra/core/tool-integration';
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
import { LibSQLStore } from '@mastra/libsql';
import { MastraEditor } from './index';

/**
 * Phase 4 coexistence: legacy `integrationTools` storage and new
 * `toolIntegrations` storage hydrate side-by-side without colliding.
 */

function createLegacyToolProvider(id: string): ToolProvider {
  const toolkits: ToolProviderToolkit[] = [{ slug: 'GITHUB', name: 'GitHub', description: 'GitHub' }];
  const toolMap: Record<string, { name: string; description: string }> = {
    GITHUB_CREATE_ISSUE: { name: 'Create Issue', description: 'Create a GitHub issue' },
  };
  return {
    info: { id, name: id, description: id },
    listToolkits: vi.fn(
      async (): Promise<ToolProviderListResult<ToolProviderToolkit>> => ({ data: toolkits }),
    ),
    listTools: vi.fn(
      async (_options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>> => ({
        data: Object.entries(toolMap).map(([slug, t]) => ({
          slug,
          name: t.name,
          description: t.description,
          toolkit: 'GITHUB',
        })),
      }),
    ),
    getToolSchema: vi.fn(async () => null),
    resolveTools: vi.fn(
      async (
        toolSlugs: string[],
        _toolConfigs?: Record<string, StorageToolConfig>,
        _options?: ResolveToolProviderToolsOptions,
      ) => {
        const out: Record<string, ToolAction<any, any, any>> = {};
        for (const slug of toolSlugs) {
          const t = toolMap[slug];
          if (!t) continue;
          out[slug] = {
            id: slug,
            description: t.description,
            execute: vi.fn(async () => ({ ok: true })),
          } as any;
        }
        return out;
      },
    ),
  };
}

class FakeComposio extends BaseToolIntegration {
  readonly id = 'composio';
  readonly displayName = 'Composio';
  readonly capabilities: ToolIntegrationCapabilities = {
    multipleConnectionsPerService: true,
    batchConnectionStatus: true,
    reauthorizeReusesConnectionId: true,
  };

  protected async listAllToolServices(): Promise<ToolService[]> {
    return [{ slug: 'gmail', name: 'Gmail' }];
  }
  protected async listAllTools(): Promise<ListToolsResult> {
    return {
      data: [
        { slug: 'gmail.fetch_emails', name: 'Fetch emails', toolService: 'gmail' },
        { slug: 'gmail.send_email', name: 'Send email', toolService: 'gmail' },
      ],
      pagination: { page: 1, hasMore: false },
    };
  }
  async resolveTools(opts: ResolveToolsOpts) {
    const out: Record<string, ToolAction<any, any, any>> = {};
    for (const slug of opts.toolSlugs) {
      out[slug] = {
        id: slug,
        description: `desc for ${slug} via ${opts.connectionId}`,
        execute: vi.fn(async () => ({ ok: true })),
      } as any;
    }
    return out;
  }
  async authorize(_opts: AuthorizeOpts) {
    return { url: 'about:blank', authId: 'a' };
  }
  async getAuthStatus(_authId: string): Promise<AuthFlowStatus> {
    return 'completed';
  }
  async getConnectionStatus(opts: { items: Array<{ connectionId: string; toolService: string }> }) {
    return Object.fromEntries(opts.items.map(i => [i.connectionId, { connected: true }]));
  }
}

const createTestStorage = () =>
  new LibSQLStore({ id: `test-${randomUUID()}`, url: ':memory:' });

describe('Agent hydration with toolIntegrations (Phase 4 coexistence)', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let _mastra: Mastra;
  let legacyProvider: ToolProvider;
  let composioIntegration: FakeComposio;

  beforeEach(async () => {
    storage = createTestStorage();
    legacyProvider = createLegacyToolProvider('legacy');
    composioIntegration = new FakeComposio();
    editor = new MastraEditor({
      toolProviders: { legacy: legacyProvider },
      toolIntegrations: [composioIntegration],
    });
    _mastra = new Mastra({ storage, editor });
    await storage.init();
  });

  afterEach(async () => {
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.dangerouslyClearAll();
  });

  it('hydrates an agent that uses only the new toolIntegrations field', async () => {
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-new-only',
        name: 'New Only',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        toolIntegrations: {
          composio: {
            tools: { 'gmail.fetch_emails': {} },
            connections: {
              gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' }],
            },
          },
        },
      },
    });

    const agent = await editor.agent.getById('agent-new-only');
    expect(agent).toBeInstanceOf(Agent);

    const tools = await agent!.listTools();
    expect(tools['gmail.fetch_emails']).toBeDefined();
  });

  it('renames tools with __<LABEL> when multiple connections share a tool service', async () => {
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-multi-conn',
        name: 'Multi conn',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        toolIntegrations: {
          composio: {
            tools: { 'gmail.fetch_emails': {} },
            connections: {
              gmail: [
                { kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' },
                { kind: 'author', toolService: 'gmail', connectionId: 'ca_2', label: 'Personal' },
              ],
            },
          },
        },
      },
    });

    const agent = await editor.agent.getById('agent-multi-conn');
    const tools = await agent!.listTools();

    expect(tools['gmail.fetch_emails__WORK']).toBeDefined();
    expect(tools['gmail.fetch_emails__PERSONAL']).toBeDefined();
    expect(tools['gmail.fetch_emails']).toBeUndefined();
    expect(tools['gmail.fetch_emails__WORK']!.description).toContain('Routes through connection: Work');
  });

  it('coexists with legacy integrationTools without key collision', async () => {
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-both',
        name: 'Both',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        integrationTools: {
          legacy: { tools: { GITHUB_CREATE_ISSUE: {} } },
        },
        toolIntegrations: {
          composio: {
            tools: { 'gmail.fetch_emails': {} },
            connections: {
              gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' }],
            },
          },
        },
      },
    });

    const agent = await editor.agent.getById('agent-both');
    const tools = await agent!.listTools();

    expect(tools['GITHUB_CREATE_ISSUE']).toBeDefined();
    expect(tools['gmail.fetch_emails']).toBeDefined();
  });
});

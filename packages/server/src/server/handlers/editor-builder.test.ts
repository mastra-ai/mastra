import type { IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE,
  GET_EDITOR_BUILDER_SETTINGS_ROUTE,
  GET_INFRASTRUCTURE_STATUS_ROUTE,
} from './editor-builder';

// Minimal mock mastra for handler testing
const createMockMastra = (
  editor?: Partial<IMastraEditor>,
  registry?: { tools?: Record<string, unknown>; agents?: Record<string, unknown>; workflows?: Record<string, unknown> },
) =>
  ({
    getEditor: () => editor,
    // buildProvidersList() reads gateways; an empty map keeps it to PROVIDER_REGISTRY.
    listGateways: () => ({}),
    listTools: () => registry?.tools ?? {},
    listAgents: () => registry?.agents ?? {},
    listWorkflows: () => registry?.workflows ?? {},
  }) as any;

describe('GET /editor/builder/settings', () => {
  it('returns enabled: false + inactive modelPolicy when no editor configured', async () => {
    const mastra = createMockMastra();
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({ enabled: false, modelPolicy: { active: false } });
  });

  it('returns enabled: false + inactive modelPolicy when editor lacks resolveBuilder', async () => {
    const mastra = createMockMastra({});
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({ enabled: false, modelPolicy: { active: false } });
  });

  it('returns enabled: false + inactive modelPolicy when hasEnabledBuilderConfig returns false', async () => {
    const resolveBuilder = vi.fn();
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => false,
      resolveBuilder,
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({ enabled: false, modelPolicy: { active: false } });
    expect(resolveBuilder).not.toHaveBeenCalled();
  });

  it('returns enabled: false + inactive modelPolicy when resolveBuilder returns undefined', async () => {
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(undefined),
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({ enabled: false, modelPolicy: { active: false } });
  });

  it('returns builder settings + derived modelPolicy when builder is enabled (no model slice)', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true, memory: true } }),
      getConfiguration: () => ({ agent: { maxTokens: 4096 } }),
    };
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({
      enabled: true,
      features: { agent: { tools: true, memory: true } },
      configuration: { agent: { maxTokens: 4096 } },
      modelPolicy: { active: false },
      picker: {
        visibleTools: null,
        visibleAgents: null,
        visibleWorkflows: null,
      },
    });
  });

  it('returns active modelPolicy with allowed + default when configured', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { model: true } }),
      getConfiguration: () => ({
        agent: {
          models: {
            allowed: [{ provider: 'openai' }],
            default: { provider: 'openai', modelId: 'gpt-4o-mini' },
          },
        },
      }),
    };
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toMatchObject({
      enabled: true,
      modelPolicy: {
        active: true,
        pickerVisible: true,
        allowed: [{ provider: 'openai' }],
        default: { provider: 'openai', modelId: 'gpt-4o-mini' },
      },
    });
  });

  it('returns enabled: false + inactive modelPolicy when builder.enabled is false', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: false,
      getFeatures: () => ({ agent: { tools: true } }),
      getConfiguration: () => ({ agent: { maxTokens: 4096 } }),
    };
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
    });
    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    // Should NOT expose features/config when disabled
    expect(result).toEqual({ enabled: false, modelPolicy: { active: false } });
  });

  it('throws HTTPException when resolveBuilder throws', async () => {
    const mastra = createMockMastra({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockRejectedValue(new Error('License check failed')),
    });

    await expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)).rejects.toThrow('License check failed');
  });

  it('resolves picker with allowlists filtered against the registry', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true } }),
      getConfiguration: () => ({
        agent: {
          tools: { allowed: ['weather', 'search'] },
          agents: { allowed: ['support'] },
          workflows: { allowed: ['ticket-flow'] },
        },
      }),
    };
    const mastra = createMockMastra(
      {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
      },
      {
        tools: { weather: {}, search: {}, calculator: {} },
        agents: { support: {}, triage: {} },
        workflows: { 'ticket-flow': {}, onboarding: {} },
      },
    );

    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toMatchObject({
      enabled: true,
      picker: {
        visibleTools: ['weather', 'search'],
        visibleAgents: ['support'],
        visibleWorkflows: ['ticket-flow'],
      },
    });
  });

  it('resolves picker as unrestricted when no allowlists are configured', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true } }),
      getConfiguration: () => ({ agent: {} }),
    };
    const mastra = createMockMastra(
      {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
      },
      { tools: { weather: {} } },
    );

    const result = await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any);

    expect(result).toMatchObject({
      picker: {
        visibleTools: null,
        visibleAgents: null,
        visibleWorkflows: null,
      },
    });
  });

  it('appends picker warnings for unknown IDs to modelPolicyWarnings', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true } }),
      getConfiguration: () => ({
        agent: {
          tools: { allowed: ['weather', 'ghost'] },
        },
      }),
      getModelPolicyWarnings: () => ['existing-warning'],
    };
    const mastra = createMockMastra(
      {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
      },
      { tools: { weather: {} } },
    );

    const result = (await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)) as {
      modelPolicyWarnings?: string[];
      picker?: { visibleTools: string[] };
    };

    expect(result.picker?.visibleTools).toEqual(['weather']);
    expect(result.modelPolicyWarnings).toHaveLength(2);
    expect(result.modelPolicyWarnings?.[0]).toBe('existing-warning');
    expect(result.modelPolicyWarnings?.[1]).toContain('"ghost"');
  });

  it('accepts entity .id in allowlist and emits response keys (registration key for tools/workflows, .id for agents)', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true, agents: true, workflows: true } }),
      getConfiguration: () => ({
        agent: {
          tools: { allowed: ['weather-id'] },
          agents: { allowed: ['triage-id'] },
          workflows: { allowed: ['ticket-id'] },
        },
      }),
    };
    const mastra = createMockMastra(
      {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
      },
      {
        tools: { weatherKey: { id: 'weather-id' }, searchKey: { id: 'search-id' } },
        agents: { supportKey: { id: 'support-id' }, triageKey: { id: 'triage-id' } },
        workflows: { ticketKey: { id: 'ticket-id' }, onboardingKey: { id: 'onboarding-id' } },
      },
    );

    const result = (await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)) as {
      picker?: { visibleTools: string[]; visibleAgents: string[]; visibleWorkflows: string[] };
    };

    // Tools/workflows responses are keyed by registration key
    expect(result.picker?.visibleTools).toEqual(['weatherKey']);
    expect(result.picker?.visibleWorkflows).toEqual(['ticketKey']);
    // Agents response is keyed by `.id`
    expect(result.picker?.visibleAgents).toEqual(['triage-id']);
  });

  it('also accepts registration key in allowlist (alias to entity .id) for all kinds', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true } }),
      getConfiguration: () => ({
        agent: {
          tools: { allowed: ['weatherKey'] },
          agents: { allowed: ['supportKey'] },
          workflows: { allowed: ['flowKey'] },
        },
      }),
    };
    const mastra = createMockMastra(
      {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
      },
      {
        tools: { weatherKey: { id: 'weather-id' } },
        agents: { supportKey: { id: 'support-id' } },
        workflows: { flowKey: { id: 'flow-id' } },
      },
    );

    const result = (await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)) as {
      picker?: { visibleTools: string[]; visibleAgents: string[]; visibleWorkflows: string[] };
      modelPolicyWarnings?: string[];
    };

    // tools/workflows normalize to registration key (matches GET response keying);
    // agents normalize to .id (matches GET /agents response keying).
    expect(result.picker?.visibleTools).toEqual(['weatherKey']);
    expect(result.picker?.visibleAgents).toEqual(['support-id']);
    expect(result.picker?.visibleWorkflows).toEqual(['flowKey']);
    expect(result.modelPolicyWarnings).toBeUndefined();
  });

  it('resolves empty allowlists to empty visible arrays (explicit lockdown)', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true } }),
      getConfiguration: () => ({
        agent: {
          tools: { allowed: [] },
          agents: { allowed: [] },
          workflows: { allowed: [] },
        },
      }),
    };
    const mastra = createMockMastra(
      {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
      },
      {
        tools: { weather: {} },
        agents: { support: {} },
        workflows: { flow: {} },
      },
    );

    const result = (await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)) as {
      picker?: { visibleTools: string[]; visibleAgents: string[]; visibleWorkflows: string[] };
      modelPolicyWarnings?: string[];
    };

    expect(result.picker?.visibleTools).toEqual([]);
    expect(result.picker?.visibleAgents).toEqual([]);
    expect(result.picker?.visibleWorkflows).toEqual([]);
    expect(result.modelPolicyWarnings).toBeUndefined();
  });

  it('omits modelPolicyWarnings when there are no warnings', async () => {
    const mockBuilder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true } }),
      getConfiguration: () => ({
        agent: { tools: { allowed: ['weather'] } },
      }),
    };
    const mastra = createMockMastra(
      {
        hasEnabledBuilderConfig: () => true,
        resolveBuilder: vi.fn().mockResolvedValue(mockBuilder),
      },
      { tools: { weather: {} } },
    );

    const result = (await GET_EDITOR_BUILDER_SETTINGS_ROUTE.handler({ mastra } as any)) as Record<string, unknown>;

    expect('modelPolicyWarnings' in result).toBe(false);
  });
});

describe('GET /editor/builder/settings route metadata', () => {
  it('has correct path and method', () => {
    expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.path).toBe('/editor/builder/settings');
    expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.method).toBe('GET');
  });

  it('requires stored-agents:read permission', () => {
    expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.requiresPermission).toBe('stored-agents:read');
  });

  it('requires authentication', () => {
    expect(GET_EDITOR_BUILDER_SETTINGS_ROUTE.requiresAuth).toBe(true);
  });
});

describe('GET /editor/builder/infrastructure', () => {
  const createInfraMastra = (opts: {
    channelProviders?: Record<string, any>;
    workspaces?: Record<string, any>;
    editor?: any;
  }) =>
    ({
      getChannelProviders: () => opts.channelProviders,
      listWorkspaces: () => opts.workspaces ?? {},
      getEditor: () => opts.editor,
    }) as any;

  it('returns empty primitives when nothing is configured', async () => {
    const mastra = createInfraMastra({});
    const result = await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any);

    expect(result).toEqual({
      channels: { providers: [] },
      browser: { type: null, provider: null, env: null, registered: false, availableProviders: [], config: [] },
      workspace: {
        type: null,
        workspaceId: null,
        name: null,
        source: null,
        registered: false,
        hasFilesystem: false,
        hasSandbox: false,
        filesystemProvider: null,
        sandboxProvider: null,
        config: [],
      },
      registries: { skillsSh: { enabled: false } },
    });
  });

  it('reports skills.sh registry enabled flag from builder config', async () => {
    const builder = {
      getConfiguration: () => ({}),
      getRegistries: () => ({ skillsSh: { enabled: true } }),
    };
    const editor = {
      __browsers: new Map(),
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    };
    const mastra = createInfraMastra({ editor });

    const result = (await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any)) as any;

    expect(result.registries).toEqual({ skillsSh: { enabled: true } });
  });

  it('reports skills.sh registry disabled when builder lacks getRegistries', async () => {
    const builder = { getConfiguration: () => ({}) };
    const editor = {
      __browsers: new Map(),
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    };
    const mastra = createInfraMastra({ editor });

    const result = (await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any)) as any;

    expect(result.registries).toEqual({ skillsSh: { enabled: false } });
  });

  it('reports configured channel provider info', async () => {
    const slack = {
      getInfo: () => ({ id: 'slack', name: 'Slack', isConfigured: true }),
    };
    const discord = {
      getInfo: () => ({ id: 'discord', name: 'Discord', isConfigured: false }),
    };
    const mastra = createInfraMastra({ channelProviders: { slack, discord } });

    const result = (await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any)) as any;

    expect(result.channels.providers).toEqual([{ id: 'slack', name: 'Slack', isConfigured: true, routeCount: 0 }]);
  });

  it('omits channel providers when getInfo() is missing', async () => {
    const provider = {}; // no getInfo
    const mastra = createInfraMastra({ channelProviders: { custom: provider } });

    const result = (await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any)) as any;

    expect(result.channels.providers).toEqual([]);
  });

  it('reports browser provider id, env, and registration', async () => {
    const builder = {
      getConfiguration: () => ({
        agent: {
          browser: {
            type: 'inline',
            config: { provider: 'stagehand', env: 'BROWSERBASE', headless: false, timeout: 30000 },
          },
        },
      }),
    };
    const editor = {
      __browsers: new Map([['stagehand', {}]]),
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    };
    const mastra = createInfraMastra({ editor });

    const result = (await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any)) as any;

    expect(result.browser).toEqual({
      type: 'inline',
      provider: 'stagehand',
      env: 'BROWSERBASE',
      registered: true,
      availableProviders: ['stagehand'],
      config: [
        { key: 'headless', value: 'false' },
        { key: 'timeout', value: '30000' },
      ],
    });
  });

  it('marks browser as not registered when provider id missing from __browsers', async () => {
    const builder = {
      getConfiguration: () => ({
        agent: { browser: { type: 'inline', config: { provider: 'puppeteer' } } },
      }),
    };
    const editor = {
      __browsers: new Map(),
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    };
    const mastra = createInfraMastra({ editor });

    const result = (await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any)) as any;

    expect(result.browser).toEqual({
      type: 'inline',
      provider: 'puppeteer',
      env: null,
      registered: false,
      availableProviders: [],
      config: [],
    });
  });

  it('reports inline Agent Builder workspace provider config', async () => {
    const builder = {
      getConfiguration: () => ({
        agent: {
          workspace: {
            type: 'inline',
            config: {
              name: 'builder-workspace',
              filesystem: { provider: 'local', config: { basePath: '.mastra/workspace' } },
              sandbox: { provider: 'daytona', config: {} },
            },
          },
        },
      }),
    };
    const editor = {
      __browsers: new Map(),
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    };
    const mastra = createInfraMastra({ editor });

    const result = (await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any)) as any;

    expect(result.workspace).toEqual({
      type: 'inline',
      workspaceId: null,
      name: 'builder-workspace',
      source: null,
      registered: false,
      hasFilesystem: true,
      hasSandbox: true,
      filesystemProvider: 'local',
      sandboxProvider: 'daytona',
      config: [{ key: 'filesystem.basePath', value: '.mastra/workspace' }],
    });
  });

  it('reports only the configured Agent Builder workspace', async () => {
    const builder = {
      getConfiguration: () => ({
        agent: { workspace: { type: 'id', workspaceId: 'builder-workspace' } },
      }),
    };
    const editor = {
      __browsers: new Map(),
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    };
    const workspaces = {
      'builder-workspace': {
        workspace: { name: 'Builder Workspace', filesystem: {}, sandbox: {} },
        source: 'mastra',
      },
      'agent-ws': {
        workspace: { filesystem: {} },
        source: 'agent',
        agentId: 'agent-1',
        agentName: 'Helper',
      },
    };
    const mastra = createInfraMastra({ editor, workspaces });

    const result = (await GET_INFRASTRUCTURE_STATUS_ROUTE.handler({ mastra } as any)) as any;

    expect(result.workspace).toEqual({
      type: 'id',
      workspaceId: 'builder-workspace',
      name: 'Builder Workspace',
      source: 'mastra',
      registered: true,
      hasFilesystem: true,
      hasSandbox: true,
      filesystemProvider: 'configured',
      sandboxProvider: 'configured',
      config: [],
    });
  });
});

describe('GET /editor/builder/infrastructure route metadata', () => {
  it('has correct path and method', () => {
    expect(GET_INFRASTRUCTURE_STATUS_ROUTE.path).toBe('/editor/builder/infrastructure');
    expect(GET_INFRASTRUCTURE_STATUS_ROUTE.method).toBe('GET');
  });

  it('requires infrastructure:read permission (admin-only by default)', () => {
    expect(GET_INFRASTRUCTURE_STATUS_ROUTE.requiresPermission).toBe('infrastructure:read');
  });

  it('requires authentication', () => {
    expect(GET_INFRASTRUCTURE_STATUS_ROUTE.requiresAuth).toBe(true);
  });
});

describe('GET /editor/builder/models/available', () => {
  const runAvailable = (editor?: Partial<IMastraEditor>) =>
    GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE.handler({ mastra: createMockMastra(editor) } as any) as Promise<{
      providers: Array<{ id: string; models: string[]; connected: boolean }>;
    }>;

  const originalOpenAIKey = process.env.OPENAI_API_KEY;
  const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    // The endpoint only surfaces providers with a configured API key, so make
    // exactly one provider "connected" and ensure another is not.
    process.env.OPENAI_API_KEY = 'test-key';
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalOpenAIKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAIKey;
    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
  });

  it('returns only providers with a configured API key when no policy is configured', async () => {
    const { providers } = await runAvailable();

    expect(providers.length).toBeGreaterThan(0);
    // Every returned provider is connected (has its API key configured).
    expect(providers.every(p => p.connected)).toBe(true);

    const openai = providers.find(p => p.id === 'openai');
    expect(openai).toBeDefined();
    expect(openai!.models.length).toBeGreaterThan(0);
  });

  it('omits providers whose API key is not configured', async () => {
    const { providers } = await runAvailable();

    // anthropic has no API key set in this test, so it must be filtered out
    // even though it exists in the provider registry.
    expect(providers.find(p => p.id === 'anthropic')).toBeUndefined();
    expect(providers.find(p => p.id === 'openai')).toBeDefined();
  });

  it('filters models down to the active policy allowlist (provider wildcard)', async () => {
    const builder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true } }),
      getConfiguration: () => ({
        agent: {
          models: {
            // Provider wildcard: every openai model is allowed, all others denied.
            allowed: [{ provider: 'openai' }],
          },
        },
      }),
    };

    const { providers } = await runAvailable({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    });

    // Only the allowed provider survives the filter.
    expect(providers.map(p => p.id)).toEqual(['openai']);
    expect(providers[0]!.models.length).toBeGreaterThan(0);
  });

  it('keeps only the explicitly allowed model under a provider', async () => {
    // Pick a real model id from the unfiltered output so the test is not
    // coupled to a hardcoded registry entry.
    const { providers: all } = await runAvailable();
    const openai = all.find(p => p.id === 'openai')!;
    const allowedModelId = openai.models[0]!;

    const builder: IAgentBuilder = {
      enabled: true,
      getFeatures: () => ({ agent: { tools: true } }),
      // Cast: the strict config type discriminates known-provider entries by a
      // `kind` field; the runtime policy matcher only needs provider + modelId.
      getConfiguration: () =>
        ({
          agent: {
            models: { allowed: [{ provider: 'openai', modelId: allowedModelId }] },
          },
        }) as any,
    };

    const { providers } = await runAvailable({
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: vi.fn().mockResolvedValue(builder),
    });

    expect(providers.map(p => p.id)).toEqual(['openai']);
    expect(providers[0]!.models).toEqual([allowedModelId]);
  });
});

describe('GET /editor/builder/models/available route metadata', () => {
  it('has correct path and method', () => {
    expect(GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE.path).toBe('/editor/builder/models/available');
    expect(GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE.method).toBe('GET');
  });

  it('requires stored-agents:read permission', () => {
    expect(GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE.requiresPermission).toBe('stored-agents:read');
  });

  it('requires authentication', () => {
    expect(GET_EDITOR_BUILDER_AVAILABLE_MODELS_ROUTE.requiresAuth).toBe(true);
  });
});

import type { IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';
import { describe, it, expect, vi } from 'vitest';

import { GET_EDITOR_BUILDER_SETTINGS_ROUTE } from './editor-builder';

// Minimal mock mastra for handler testing
const createMockMastra = (
  editor?: Partial<IMastraEditor>,
  registry?: { tools?: Record<string, unknown>; agents?: Record<string, unknown>; workflows?: Record<string, unknown> },
) =>
  ({
    getEditor: () => editor,
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

import type { Mastra } from '@mastra/core';
import { PROVIDER_REGISTRY } from '@mastra/core/llm';
import { describe, it, expect } from 'vitest';

import {
  resolveAvailableAgentTools,
  resolveAvailableSkills,
  resolveAvailableWorkspaces,
  resolveAvailableModels,
  resolveBrowserAvailable,
  resolveFeatureCapabilities,
} from './available';

const ALL_FALSE_CAPABILITIES = {
  tools: false,
  agents: false,
  workflows: false,
  scorers: false,
  skills: false,
  memory: false,
  variables: false,
  favorites: false,
  avatarUpload: false,
  browser: false,
  model: false,
} as const;

type BuilderConfig = {
  agent?: Record<string, unknown>;
};

interface StubOptions {
  /** When false, `getEditor()` returns undefined (no editor). */
  hasEditor?: boolean;
  /** When false, `hasEnabledBuilderConfig()` returns false. */
  builderConfigEnabled?: boolean;
  /** When false, the resolved builder reports `enabled: false`. */
  builderEnabled?: boolean;
  configuration?: BuilderConfig;
  features?: Record<string, unknown>;
  tools?: Record<string, unknown>;
  agents?: Record<string, unknown>;
  workflows?: Record<string, unknown>;
  workspaces?: Record<string, { workspace: { name?: string } }>;
  skills?: Array<{ id: string; name?: string }>;
  gateways?: Record<string, { id: string; fetchProviders: () => Promise<Record<string, { name: string; models: string[] }>> }>;
}

function makeMastra(opts: StubOptions = {}): Mastra {
  const {
    hasEditor = true,
    builderConfigEnabled = true,
    builderEnabled = true,
    configuration = { agent: {} },
    features = { agent: {} },
    tools = {},
    agents = {},
    workflows = {},
    workspaces = {},
    skills = [],
    gateways,
  } = opts;

  const builder = {
    enabled: builderEnabled,
    getFeatures: () => features,
    getConfiguration: () => configuration,
  };

  const editor = {
    resolveBuilder: async () => builder,
    hasEnabledBuilderConfig: () => builderConfigEnabled,
    skill: {
      listResolved: async () => ({ skills }),
    },
  };

  return {
    getEditor: () => (hasEditor ? editor : undefined),
    listTools: () => tools,
    listAgents: () => agents,
    listWorkflows: () => workflows,
    listWorkspaces: () => workspaces,
    listGateways: () => gateways,
  } as unknown as Mastra;
}

describe('resolveAvailableAgentTools', () => {
  it('returns all registered tools/agents/workflows when unrestricted', async () => {
    const mastra = makeMastra({
      tools: { weather: { id: 'weather', name: 'Weather' } },
      agents: { writer: { id: 'writer', name: 'Writer' } },
      workflows: { etl: { id: 'etl', name: 'ETL' } },
    });

    const result = await resolveAvailableAgentTools(mastra);

    expect(result).toEqual(
      expect.arrayContaining([
        { id: 'weather', name: 'Weather', type: 'tool' },
        { id: 'writer', name: 'Writer', type: 'agent' },
        { id: 'etl', name: 'ETL', type: 'workflow' },
      ]),
    );
    expect(result).toHaveLength(3);
  });

  it('filters to the admin allowlist when configured', async () => {
    const mastra = makeMastra({
      configuration: { agent: { tools: { allowed: ['weather'] } } },
      tools: {
        weather: { id: 'weather', name: 'Weather' },
        secret: { id: 'secret', name: 'Secret' },
      },
    });

    const result = await resolveAvailableAgentTools(mastra);

    expect(result).toEqual([{ id: 'weather', name: 'Weather', type: 'tool' }]);
  });

  it('matches allowlist entries written against the registration key', async () => {
    const mastra = makeMastra({
      // allowlist references the registration key, while the entity exposes a different `.id`
      configuration: { agent: { tools: { allowed: ['weatherKey'] } } },
      tools: { weatherKey: { id: 'weather-id', name: 'Weather' } },
    });

    const result = await resolveAvailableAgentTools(mastra);

    expect(result).toEqual([{ id: 'weather-id', name: 'Weather', type: 'tool' }]);
  });

  it('falls back to the registration key as both id and name when entity has none', async () => {
    const mastra = makeMastra({
      workflows: { etl: {} },
    });

    const result = await resolveAvailableAgentTools(mastra);

    expect(result).toEqual([{ id: 'etl', name: 'etl', type: 'workflow' }]);
  });

  it('returns [] when there is no editor', async () => {
    const mastra = makeMastra({ hasEditor: false, tools: { weather: { id: 'weather' } } });
    await expect(resolveAvailableAgentTools(mastra)).resolves.toEqual([]);
  });

  it('returns [] when the builder is disabled', async () => {
    const mastra = makeMastra({ builderEnabled: false, tools: { weather: { id: 'weather' } } });
    await expect(resolveAvailableAgentTools(mastra)).resolves.toEqual([]);
  });

  it('returns [] when the builder config is not enabled', async () => {
    const mastra = makeMastra({ builderConfigEnabled: false, tools: { weather: { id: 'weather' } } });
    await expect(resolveAvailableAgentTools(mastra)).resolves.toEqual([]);
  });
});

describe('resolveAvailableSkills', () => {
  it('maps resolved skills to { id, name }', async () => {
    const mastra = makeMastra({
      skills: [
        { id: 's1', name: 'first-skill' },
        { id: 's2', name: 'second-skill' },
      ],
    });

    await expect(resolveAvailableSkills(mastra)).resolves.toEqual([
      { id: 's1', name: 'first-skill' },
      { id: 's2', name: 'second-skill' },
    ]);
  });

  it('falls back to id when a skill has no name', async () => {
    const mastra = makeMastra({ skills: [{ id: 's1' }] });
    await expect(resolveAvailableSkills(mastra)).resolves.toEqual([{ id: 's1', name: 's1' }]);
  });

  it('returns [] when there is no editor', async () => {
    const mastra = makeMastra({ hasEditor: false, skills: [{ id: 's1', name: 'x' }] });
    await expect(resolveAvailableSkills(mastra)).resolves.toEqual([]);
  });
});

describe('resolveAvailableWorkspaces', () => {
  it('maps registered workspaces to { id, name }', async () => {
    const mastra = makeMastra({
      workspaces: {
        ws_a: { workspace: { name: 'Alpha' } },
        ws_b: { workspace: { name: 'Beta' } },
      },
    });

    await expect(resolveAvailableWorkspaces(mastra)).resolves.toEqual([
      { id: 'ws_a', name: 'Alpha' },
      { id: 'ws_b', name: 'Beta' },
    ]);
  });

  it('falls back to id when a workspace has no name', async () => {
    const mastra = makeMastra({ workspaces: { ws_a: { workspace: {} } } });
    await expect(resolveAvailableWorkspaces(mastra)).resolves.toEqual([{ id: 'ws_a', name: 'ws_a' }]);
  });

  it('returns [] when there is no editor', async () => {
    const mastra = makeMastra({ hasEditor: false, workspaces: { ws_a: { workspace: { name: 'Alpha' } } } });
    await expect(resolveAvailableWorkspaces(mastra)).resolves.toEqual([]);
  });
});

describe('resolveAvailableModels', () => {
  // Pick a real provider/model pair from the registry so assertions stay valid
  // even as the generated catalog shifts over time.
  const [sampleProvider, sampleConfig] = Object.entries(PROVIDER_REGISTRY).find(
    ([, config]) => (config as { models: string[] }).models.length > 0,
  ) as [string, { models: string[] }];
  const sampleModel = sampleConfig.models[0]!;

  it('returns the full catalog when the model policy is inactive', async () => {
    const mastra = makeMastra();
    const result = await resolveAvailableModels(mastra);

    expect(result.length).toBeGreaterThan(0);
    expect(result).toContainEqual({ provider: sampleProvider, name: sampleModel });
  });

  it('returns only the allowlisted provider/model pairs when the policy is active', async () => {
    const mastra = makeMastra({
      configuration: {
        agent: {
          models: {
            allowed: [{ provider: sampleProvider, modelId: sampleModel }],
          },
        },
      },
    });

    await expect(resolveAvailableModels(mastra)).resolves.toEqual([{ provider: sampleProvider, name: sampleModel }]);
  });

  it('returns all of a provider catalog models for a provider-wildcard allowlist (no modelId)', async () => {
    const mastra = makeMastra({
      configuration: {
        agent: {
          models: {
            allowed: [{ provider: sampleProvider }],
          },
        },
      },
    });

    const result = await resolveAvailableModels(mastra);
    const expected = sampleConfig.models.map(name => ({ provider: sampleProvider, name }));

    expect(result).toEqual(expect.arrayContaining(expected));
    expect(result.every(entry => entry.provider === sampleProvider)).toBe(true);
  });

  it('merges gateway providers into the catalog and prefixes non-unified provider ids', async () => {
    const mastra = makeMastra({
      gateways: {
        netlify: {
          id: 'netlify',
          fetchProviders: async () => ({ acme: { name: 'Acme', models: ['acme-large'] } }),
        },
      },
    });

    const result = await resolveAvailableModels(mastra);
    expect(result).toContainEqual({ provider: 'netlify/acme', name: 'acme-large' });
  });

  it('swallows a throwing gateway and still returns the registry catalog', async () => {
    const mastra = makeMastra({
      gateways: {
        broken: {
          id: 'broken',
          fetchProviders: async () => {
            throw new Error('gateway down');
          },
        },
      },
    });

    const result = await resolveAvailableModels(mastra);
    expect(result).toContainEqual({ provider: sampleProvider, name: sampleModel });
  });

  it('returns the catalog when there is no editor (policy inactive)', async () => {
    const mastra = makeMastra({ hasEditor: false });
    const result = await resolveAvailableModels(mastra);
    expect(result).toContainEqual({ provider: sampleProvider, name: sampleModel });
  });
});

describe('resolveBrowserAvailable', () => {
  it('is false when no browser is configured', async () => {
    const mastra = makeMastra();
    await expect(resolveBrowserAvailable(mastra)).resolves.toBe(false);
  });

  it('is true when a browser type is configured', async () => {
    const mastra = makeMastra({ configuration: { agent: { browser: { type: 'playwright' } } } });
    await expect(resolveBrowserAvailable(mastra)).resolves.toBe(true);
  });

  it('is true when a browser provider is configured', async () => {
    const mastra = makeMastra({ configuration: { agent: { browser: { config: { provider: 'local' } } } } });
    await expect(resolveBrowserAvailable(mastra)).resolves.toBe(true);
  });

  it('is false when there is no editor', async () => {
    const mastra = makeMastra({ hasEditor: false, configuration: { agent: { browser: { type: 'playwright' } } } });
    await expect(resolveBrowserAvailable(mastra)).resolves.toBe(false);
  });
});

describe('resolveFeatureCapabilities', () => {
  it('maps every enabled feature flag to true', async () => {
    const mastra = makeMastra({
      features: {
        agent: {
          tools: true,
          agents: true,
          workflows: true,
          scorers: true,
          skills: true,
          memory: true,
          variables: true,
          favorites: true,
          avatarUpload: true,
          browser: true,
          model: true,
        },
      },
    });
    await expect(resolveFeatureCapabilities(mastra)).resolves.toEqual({
      tools: true,
      agents: true,
      workflows: true,
      scorers: true,
      skills: true,
      memory: true,
      variables: true,
      favorites: true,
      avatarUpload: true,
      browser: true,
      model: true,
    });
  });

  it('treats omitted and non-true flags as false (playground parity)', async () => {
    const mastra = makeMastra({ features: { agent: { tools: true, skills: false, model: 'yes' } } });
    await expect(resolveFeatureCapabilities(mastra)).resolves.toEqual({
      ...ALL_FALSE_CAPABILITIES,
      tools: true,
    });
  });

  it('returns an all-false map when there is no editor', async () => {
    const mastra = makeMastra({ hasEditor: false, features: { agent: { tools: true } } });
    await expect(resolveFeatureCapabilities(mastra)).resolves.toEqual(ALL_FALSE_CAPABILITIES);
  });

  it('returns an all-false map when the builder is disabled', async () => {
    const mastra = makeMastra({ builderEnabled: false, features: { agent: { tools: true } } });
    await expect(resolveFeatureCapabilities(mastra)).resolves.toEqual(ALL_FALSE_CAPABILITIES);
  });

  it('returns an all-false map when the builder config is disabled', async () => {
    const mastra = makeMastra({ builderConfigEnabled: false, features: { agent: { tools: true } } });
    await expect(resolveFeatureCapabilities(mastra)).resolves.toEqual(ALL_FALSE_CAPABILITIES);
  });

  it('returns an all-false map when getFeatures has no agent slice', async () => {
    const mastra = makeMastra({ features: {} });
    await expect(resolveFeatureCapabilities(mastra)).resolves.toEqual(ALL_FALSE_CAPABILITIES);
  });
});

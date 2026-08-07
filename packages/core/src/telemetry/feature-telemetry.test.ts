import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capture, flush, PostHog } = vi.hoisted(() => {
  const capture = vi.fn();
  const flush = vi.fn().mockResolvedValue(undefined);
  const PostHog = vi.fn(function () {
    return { capture, flush };
  });
  return { capture, flush, PostHog };
});

vi.mock('posthog-node', () => ({ PostHog }));

import type { Mastra } from '../mastra';
import { InMemoryStore } from '../storage/mock';
import { FEATURE_USAGE_EVENT, syncFeatureUsageTelemetry, trackFeatureUsage } from './feature-telemetry';
import { hashTelemetryValue, resetEETelemetryForTests } from './posthog';

class UnknownStore {
  stores = {};
}

function makeMastra(overrides: Partial<Record<keyof Mastra, unknown>> = {}): Mastra {
  return {
    listAgents: () => ({}),
    listAgentControllers: () => ({}),
    listWorkflows: () => ({}),
    listTools: () => ({}),
    listProcessors: () => ({}),
    listProcessorConfigurations: () => new Map(),
    listMemory: () => ({}),
    listVectors: () => ({}),
    listScorers: () => ({}),
    listWorkspaces: () => ({}),
    getWorkspace: () => undefined,
    listMCPServers: () => ({}),
    listGateways: () => ({}),
    getChannelProviders: () => ({}),
    getChannels: () => ({}),
    getTTS: () => ({}),
    listPromptBlocks: () => ({}),
    getEditor: () => undefined,
    getStudio: () => undefined,
    getServer: () => undefined,
    getMastraServer: () => undefined,
    getServerMiddleware: () => undefined,
    getServerCache: () => undefined,
    getDeployer: () => undefined,
    getVersionOverrides: () => undefined,
    getToolPayloadTransform: () => undefined,
    getEnvironment: () => undefined,
    getStorage: () => undefined,
    ...overrides,
  } as unknown as Mastra;
}

describe('feature usage telemetry', () => {
  let originalTelemetryDisabled: string | undefined;
  let originalProjectRoot: string | undefined;
  let originalDistinctId: string | undefined;
  let originalCommand: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalTelemetryDisabled = process.env.MASTRA_TELEMETRY_DISABLED;
    originalProjectRoot = process.env.MASTRA_PROJECT_ROOT;
    originalDistinctId = process.env.MASTRA_CLI_DISTINCT_ID;
    originalCommand = process.env.MASTRA_TELEMETRY_COMMAND;
    originalNodeEnv = process.env.NODE_ENV;

    delete process.env.MASTRA_TELEMETRY_DISABLED;
    process.env.MASTRA_PROJECT_ROOT = '/tmp/feature-telemetry-project';
    process.env.MASTRA_CLI_DISTINCT_ID = 'cli-distinct-id';
    process.env.MASTRA_TELEMETRY_COMMAND = 'dev';
    process.env.NODE_ENV = 'test';

    capture.mockClear();
    flush.mockClear();
    PostHog.mockClear();
    resetEETelemetryForTests();
  });

  afterEach(() => {
    if (originalTelemetryDisabled !== undefined) process.env.MASTRA_TELEMETRY_DISABLED = originalTelemetryDisabled;
    else delete process.env.MASTRA_TELEMETRY_DISABLED;
    if (originalProjectRoot !== undefined) process.env.MASTRA_PROJECT_ROOT = originalProjectRoot;
    else delete process.env.MASTRA_PROJECT_ROOT;
    if (originalDistinctId !== undefined) process.env.MASTRA_CLI_DISTINCT_ID = originalDistinctId;
    else delete process.env.MASTRA_CLI_DISTINCT_ID;
    if (originalCommand !== undefined) process.env.MASTRA_TELEMETRY_COMMAND = originalCommand;
    else delete process.env.MASTRA_TELEMETRY_COMMAND;
    if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
    else delete process.env.NODE_ENV;
    resetEETelemetryForTests();
  });

  it('tracks a named feature with server telemetry context and metadata', () => {
    trackFeatureUsage('agent_builder', { action: 'open', count: 2 });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![0]).toMatchObject({
      distinctId: 'cli-distinct-id',
      event: FEATURE_USAGE_EVENT,
      properties: {
        feature_name: 'agent_builder',
        project_id: hashTelemetryValue('/tmp/feature-telemetry-project').slice(0, 16),
        command: 'dev',
        node_env: 'test',
        action: 'open',
        count: 2,
      },
    });
  });

  it('does not track feature usage when telemetry is disabled', () => {
    process.env.MASTRA_TELEMETRY_DISABLED = 'true';

    trackFeatureUsage('agent_builder');

    expect(PostHog).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });

  it('never throws when metadata is malformed', () => {
    expect(() => trackFeatureUsage('bad-metadata', null as unknown as Record<string, unknown>)).not.toThrow();
  });

  it('tracks a project surface snapshot without names or identifiers', () => {
    const store = new InMemoryStore();
    const mastra = makeMastra({
      listAgents: () => ({ weatherAgent: { hasOwnMemory: () => true }, supportAgent: { hasOwnMemory: () => false } }),
      listAgentControllers: () => ({ controllerName: {} }),
      listWorkflows: () => ({ workflowA: {}, workflowB: {}, workflowC: {} }),
      listTools: () => ({ toolA: {}, toolB: {}, toolC: {}, toolD: {} }),
      listProcessors: () => ({ processorA: {}, processorB: {} }),
      listProcessorConfigurations: () => new Map([['processorConfigA', {}]]),
      listMemory: () => ({ memoryA: {} }),
      listVectors: () => ({ vectorA: {}, vectorB: {} }),
      listScorers: () => ({ scorerA: {} }),
      listWorkspaces: () => ({ workspaceA: {} }),
      getWorkspace: () => ({ id: 'globalWorkspace' }),
      listMCPServers: () => ({ mcpA: {} }),
      listGateways: () => ({ gatewayA: {} }),
      getChannelProviders: () => ({ channelProviderA: {} }),
      getChannels: () => ({ agentChannelA: {} }),
      getTTS: () => ({ voiceA: {} }),
      listPromptBlocks: () => ({ promptBlockA: {}, promptBlockB: {} }),
      getEditor: () => ({ id: 'editorA' }),
      getStudio: () => ({ id: 'studioA' }),
      getServer: () => ({ id: 'serverA' }),
      getMastraServer: () => ({ id: 'mastraServerA' }),
      getServerMiddleware: () => ({ middlewareA: {} }),
      getServerCache: () => ({ id: 'cacheA' }),
      getDeployer: () => ({ id: 'deployerA' }),
      getVersionOverrides: () => ({ agentA: 'draft' }),
      getToolPayloadTransform: () => ({ mode: 'compat' }),
      getEnvironment: () => 'production',
      getStorage: () => store,
    });

    syncFeatureUsageTelemetry(mastra);

    expect(capture).toHaveBeenCalledTimes(1);
    const event = capture.mock.calls[0]![0];
    expect(event).toMatchObject({
      distinctId: 'cli-distinct-id',
      event: FEATURE_USAGE_EVENT,
      properties: {
        feature_name: 'mastra_instance_summary',
        project_id: hashTelemetryValue('/tmp/feature-telemetry-project').slice(0, 16),
        command: 'dev',
        node_env: 'test',
        agent_count: 2,
        agents_with_memory_count: 1,
        agent_controller_count: 1,
        workflow_count: 3,
        tool_count: 4,
        processor_count: 2,
        processor_configuration_count: 1,
        memory_count: 1,
        vector_count: 2,
        scorer_count: 1,
        workspace_count: 1,
        mcp_server_count: 1,
        gateway_count: 1,
        channel_count: 1,
        agent_channel_count: 1,
        tts_count: 1,
        prompt_block_count: 2,
        editor_enabled: true,
        studio_enabled: true,
        server_middleware_enabled: true,
        storage_type: 'in-memory',
        observability_enabled: true,
      },
    });

    const serializedProperties = JSON.stringify(event.properties);
    expect(serializedProperties).not.toContain('weatherAgent');
    expect(serializedProperties).not.toContain('workflowA');
    expect(serializedProperties).not.toContain('toolA');
    expect(serializedProperties).not.toContain('promptBlockA');
    expect(serializedProperties).not.toContain('channelProviderA');
    expect(Object.keys(event.properties).some(key => key.toLowerCase().includes('skill'))).toBe(false);
  });

  it('uses safe defaults for missing registries', () => {
    const mastra = {
      getStorage: () => undefined,
    } as unknown as Mastra;

    expect(() => syncFeatureUsageTelemetry(mastra)).not.toThrow();

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]![0].properties).toMatchObject({
      feature_name: 'mastra_instance_summary',
      agent_count: 0,
      agents_with_memory_count: 0,
      agent_controller_count: 0,
      workflow_count: 0,
      tool_count: 0,
      processor_count: 0,
      processor_configuration_count: 0,
      memory_count: 0,
      vector_count: 0,
      scorer_count: 0,
      workspace_count: 0,
      mcp_server_count: 0,
      gateway_count: 0,
      channel_count: 0,
      agent_channel_count: 0,
      tts_count: 0,
      prompt_block_count: 0,
      editor_enabled: false,
      studio_enabled: false,
      server_middleware_enabled: false,
      storage_type: null,
      observability_enabled: false,
    });
  });

  it('buckets unrecognized storage constructors as unknown', () => {
    syncFeatureUsageTelemetry(makeMastra({ getStorage: () => new UnknownStore() }));

    expect(capture.mock.calls[0]![0].properties.storage_type).toBe('unknown');
  });
});

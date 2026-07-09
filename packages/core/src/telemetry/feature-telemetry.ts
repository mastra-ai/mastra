import type { Mastra } from '../mastra';
import { getServerTelemetryContext } from './context';
import { captureTelemetryEvent, isTelemetryEnabled } from './posthog';

export const FEATURE_USAGE_EVENT = 'mastra_feature_usage';

type StorageLike = {
  constructor?: { name?: string };
  stores?: { observability?: unknown };
};

function countCollection(collection: unknown): number {
  if (!collection || typeof collection !== 'object') {
    return 0;
  }
  if (collection instanceof Map || collection instanceof Set) {
    return collection.size;
  }

  return Object.keys(collection).length;
}

function bucketStorageType(storage: StorageLike | undefined): string | null {
  if (!storage) {
    return null;
  }

  const constructorName = storage.constructor?.name?.toLowerCase();
  if (!constructorName) {
    return 'unknown';
  }

  if (constructorName.includes('memory')) {
    return 'in-memory';
  }
  if (constructorName.includes('libsql')) {
    return 'libsql';
  }
  if (constructorName.includes('postgres')) {
    return 'postgres';
  }
  if (constructorName.includes('mongo')) {
    return 'mongo';
  }
  if (constructorName.includes('upstash')) {
    return 'upstash';
  }
  if (constructorName.includes('dynamodb')) {
    return 'dynamodb';
  }
  if (constructorName.includes('redis')) {
    return 'redis';
  }

  return 'unknown';
}

export function trackFeatureUsage(name: string, metadata?: Record<string, unknown>): void {
  try {
    if (!isTelemetryEnabled()) {
      return;
    }

    const { projectId, distinctId, command, nodeEnv } = getServerTelemetryContext();
    captureTelemetryEvent(FEATURE_USAGE_EVENT, distinctId, {
      feature: name,
      project_id: projectId,
      command,
      node_env: nodeEnv,
      ...metadata,
    });
  } catch {
    // Feature telemetry must never affect server startup or runtime behavior.
  }
}

export function syncFeatureUsageTelemetry(mastra: Mastra): void {
  try {
    if (!isTelemetryEnabled()) {
      return;
    }

    const memory = mastra.listMemory?.();
    const workspaces = mastra.listWorkspaces?.();
    const tts = mastra.getTTS?.();
    const promptBlocks = mastra.listPromptBlocks?.();
    const processorConfigurations = mastra.listProcessorConfigurations?.();
    const agentChannels = mastra.getChannels?.();
    const storage = mastra.getStorage?.() as StorageLike | undefined;

    trackFeatureUsage('project_surfaces', {
      agent_count: countCollection(mastra.listAgents?.()),
      agent_controller_count: countCollection(mastra.listAgentControllers?.()),
      workflow_count: countCollection(mastra.listWorkflows?.()),
      tool_count: countCollection(mastra.listTools?.()),
      processor_count: countCollection(mastra.listProcessors?.()),
      processor_configuration_count: countCollection(processorConfigurations),
      processor_configurations_enabled: countCollection(processorConfigurations) > 0,
      memory_count: countCollection(memory),
      memory_enabled: countCollection(memory) > 0,
      vector_count: countCollection(mastra.listVectors?.()),
      scorer_count: countCollection(mastra.listScorers?.()),
      workspace_count: countCollection(workspaces),
      workspace_enabled: countCollection(workspaces) > 0 || !!mastra.getWorkspace?.(),
      mcp_server_count: countCollection(mastra.listMCPServers?.()),
      gateway_count: countCollection(mastra.listGateways?.()),
      channel_count: countCollection(mastra.getChannelProviders?.()),
      agent_channel_count: countCollection(agentChannels),
      tts_count: countCollection(tts),
      voice_enabled: countCollection(tts) > 0,
      prompt_block_count: countCollection(promptBlocks),
      prompt_blocks_enabled: countCollection(promptBlocks) > 0,
      editor_enabled: !!mastra.getEditor?.(),
      studio_enabled: !!mastra.getStudio?.(),
      server_enabled: !!mastra.getServer?.(),
      mastra_server_enabled: !!mastra.getMastraServer?.(),
      server_middleware_enabled: !!mastra.getServerMiddleware?.(),
      server_cache_enabled: !!mastra.getServerCache?.(),
      deployer_enabled: !!mastra.getDeployer?.(),
      version_overrides_enabled: !!mastra.getVersionOverrides?.(),
      tool_payload_transform_enabled: !!mastra.getToolPayloadTransform?.(),
      environment_configured: !!mastra.getEnvironment?.(),
      storage_type: bucketStorageType(storage),
      observability_enabled: !!storage?.stores?.observability,
    });
  } catch {
    // Feature telemetry must never affect server startup or runtime behavior.
  }
}

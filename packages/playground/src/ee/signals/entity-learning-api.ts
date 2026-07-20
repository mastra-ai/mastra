import type { ThemeEntitiesResponse, ThemeFlowResponse, ThemeSnapshotsResponse, TraceSignalName } from './types';

interface EntityLearningConfig {
  baseUrl: string;
  organizationId?: string;
  projectId?: string;
}

export function getEntityLearningConfig(): EntityLearningConfig | undefined {
  const endpoint = window.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT;
  if (!endpoint) return undefined;

  return {
    baseUrl: new URL(endpoint, window.location.origin).origin,
    organizationId: window.MASTRA_ORGANIZATION_ID,
    projectId: window.MASTRA_PLATFORM_PROJECT_ID,
  };
}

export function fetchThemeEntities(config: EntityLearningConfig, entityType: string) {
  const query = new URLSearchParams({ entityType });
  return learningJson<ThemeEntitiesResponse>(config, `/api/learning/entities?${query}`);
}

export function fetchThemeSnapshots(
  config: EntityLearningConfig,
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
) {
  const query = themeQuery(entityType, signalNames);
  query.set('limit', '50');
  return learningJson<ThemeSnapshotsResponse>(
    config,
    `/api/learning/entities/${encodeURIComponent(entityId)}/theme-snapshots?${query}`,
  );
}

export function fetchThemeFlow(
  config: EntityLearningConfig,
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotId: string,
) {
  const query = themeQuery(entityType, signalNames);
  query.set('snapshotId', snapshotId);
  query.set('themeLimitPerStage', '8');
  return learningJson<ThemeFlowResponse>(
    config,
    `/api/learning/entities/${encodeURIComponent(entityId)}/theme-flow?${query}`,
  );
}

function themeQuery(entityType: string, signalNames: TraceSignalName[]) {
  return new URLSearchParams({ entityType, signalNames: signalNames.join(',') });
}

async function learningJson<T>(config: EntityLearningConfig, path: string): Promise<T> {
  const headers = new Headers();
  if (config.organizationId) headers.set('X-Mastra-Organization-Id', config.organizationId);
  if (config.projectId) headers.set('X-Mastra-Project-Id', config.projectId);

  const response = await fetch(`${config.baseUrl}${path}`, {
    credentials: 'include',
    headers,
  });
  if (!response.ok) throw new Error(`Agent Learning request failed (${response.status})`);
  return response.json();
}

import type { ThemeEntitiesResponse, ThemeFlowResponse, ThemeSnapshotsResponse } from './types';

export function fetchThemeEntities(entityType: string) {
  const query = new URLSearchParams({ entityType });
  return learningJson<ThemeEntitiesResponse>(`/api/learning/entities?${query}`);
}

export function fetchThemeSnapshots(entityId: string, entityType: string, signalNames: string[], limit = 50) {
  const query = new URLSearchParams({
    entityType,
    signalNames: signalNames.join(','),
    limit: String(limit),
  });
  return learningJson<ThemeSnapshotsResponse>(
    `/api/learning/entities/${encodeURIComponent(entityId)}/theme-snapshots?${query}`,
  );
}

export function fetchThemeFlow(
  entityId: string,
  entityType: string,
  signalNames: string[],
  snapshotId: string,
  themeLimitPerStage = 8,
) {
  const query = new URLSearchParams({
    entityType,
    signalNames: signalNames.join(','),
    snapshotId,
    themeLimitPerStage: String(themeLimitPerStage),
  });
  return learningJson<ThemeFlowResponse>(`/api/learning/entities/${encodeURIComponent(entityId)}/theme-flow?${query}`);
}

async function learningJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Agent Learning request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

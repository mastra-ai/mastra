import type {
  NoiseExamplesResponse,
  NoiseResponse,
  ThemeDetailResponse,
  EntityLearningProgressResponse,
  ThemeEntitiesResponse,
  ThemeExamplesResponse,
  ThemeFlowResponse,
  ThemeHistoryResponse,
  ThemePathsResponse,
  ThemeSnapshotsResponse,
  TraceInsightResponse,
  TraceSignalName,
} from './types';

export function fetchThemeEntities(entityType: string) {
  const query = new URLSearchParams({ entityType });
  return learningJson<ThemeEntitiesResponse>(`/api/learning/entities?${query}`);
}

export function fetchEntityLearningProgress(entityId: string, entityType: string) {
  const query = new URLSearchParams({ entityType });
  return learningJson<EntityLearningProgressResponse>(
    `/api/learning/entities/${encodeURIComponent(entityId)}/progress?${query}`,
  );
}

export function fetchThemeSnapshots(
  entityId: string,
  entityType: string,
  signalNames: string[],
  dateFrom?: Date,
  dateTo?: Date,
  limit = 24,
) {
  // Landmarks presentation returns a bounded, time-balanced selection over the
  // whole range instead of the newest-first inventory page.
  const query = new URLSearchParams({
    entityType,
    signalNames: signalNames.join(','),
    presentation: 'landmarks',
    limit: String(limit),
  });
  if (dateFrom) query.set('from', dateFrom.toISOString());
  if (dateTo) query.set('to', dateTo.toISOString());
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

export function fetchThemeDetail(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  snapshotId: string,
  themeId: string,
) {
  const query = new URLSearchParams({ entityType, signalName, snapshotId });
  return learningJson<ThemeDetailResponse>(themePath(entityId, themeId, `?${query}`));
}

export function fetchThemeExamples(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  snapshotId: string,
  themeId: string,
  limit = 20,
  offset = 0,
) {
  const query = new URLSearchParams({
    entityType,
    signalName,
    snapshotId,
    limit: String(limit),
    offset: String(offset),
  });
  return learningJson<ThemeExamplesResponse>(themePath(entityId, themeId, `/examples?${query}`));
}

export function fetchThemeHistory(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  themeId: string,
  limit = 100,
) {
  const query = new URLSearchParams({ entityType, signalName, limit: String(limit) });
  return learningJson<ThemeHistoryResponse>(themePath(entityId, themeId, `/history?${query}`));
}

export function fetchNoise(entityId: string, entityType: string, signalName: TraceSignalName, snapshotId: string) {
  const query = new URLSearchParams({ entityType, signalName, snapshotId });
  return learningJson<NoiseResponse>(noisePath(entityId, `?${query}`));
}

export function fetchNoiseExamples(
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  snapshotId: string,
  limit = 20,
  offset = 0,
) {
  const query = new URLSearchParams({
    entityType,
    signalName,
    snapshotId,
    limit: String(limit),
    offset: String(offset),
  });
  return learningJson<NoiseExamplesResponse>(noisePath(entityId, `/examples?${query}`));
}

export async function fetchThemePaths(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotId: string,
): Promise<ThemePathsResponse> {
  const firstPage = await fetchThemePathsPage(entityId, entityType, signalNames, snapshotId, 0);
  const paths = [...firstPage.paths];
  const themes = { ...firstPage.themes };
  let nextOffset = firstPage.nextOffset;

  while (nextOffset !== undefined) {
    const page = await fetchThemePathsPage(entityId, entityType, signalNames, snapshotId, nextOffset);
    paths.push(...page.paths);
    Object.assign(themes, page.themes);
    nextOffset = page.nextOffset;
  }

  return { snapshot: firstPage.snapshot, signals: firstPage.signals, themes, paths };
}

function fetchThemePathsPage(
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotId: string,
  offset: number,
) {
  const query = new URLSearchParams({
    entityType,
    signalNames: signalNames.join(','),
    snapshotId,
    limit: '500',
    offset: String(offset),
  });
  return learningJson<ThemePathsResponse>(
    `/api/learning/entities/${encodeURIComponent(entityId)}/theme-paths?${query}`,
  );
}

export function fetchTraceInsight(traceId: string) {
  return learningJson<TraceInsightResponse>(`/api/learning/traces/${encodeURIComponent(traceId)}/summary`);
}

function themePath(entityId: string, themeId: string, suffix: string) {
  return `/api/learning/entities/${encodeURIComponent(entityId)}/themes/${encodeURIComponent(themeId)}${suffix}`;
}

function noisePath(entityId: string, suffix: string) {
  return `/api/learning/entities/${encodeURIComponent(entityId)}/noise${suffix}`;
}

async function learningJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Agent Learning request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

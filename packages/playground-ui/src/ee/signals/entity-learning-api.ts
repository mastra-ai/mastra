import type { TraceIntelligenceRequest } from './trace-intelligence-context';
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

export function fetchThemeEntities(request: TraceIntelligenceRequest, entityType: string) {
  const query = new URLSearchParams({ entityType });
  return request<ThemeEntitiesResponse>(`/api/learning/entities?${query}`);
}

export function fetchEntityLearningProgress(request: TraceIntelligenceRequest, entityId: string, entityType: string) {
  const query = new URLSearchParams({ entityType });
  return request<EntityLearningProgressResponse>(
    `/api/learning/entities/${encodeURIComponent(entityId)}/progress?${query}`,
  );
}

export function fetchThemeSnapshots(
  request: TraceIntelligenceRequest,
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
  return request<ThemeSnapshotsResponse>(
    `/api/learning/entities/${encodeURIComponent(entityId)}/theme-snapshots?${query}`,
  );
}

export function fetchThemeFlow(
  request: TraceIntelligenceRequest,
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
  return request<ThemeFlowResponse>(`/api/learning/entities/${encodeURIComponent(entityId)}/theme-flow?${query}`);
}

export function fetchThemeDetail(
  request: TraceIntelligenceRequest,
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  snapshotId: string,
  themeId: string,
) {
  const query = new URLSearchParams({ entityType, signalName, snapshotId });
  return request<ThemeDetailResponse>(themePath(entityId, themeId, `?${query}`));
}

export function fetchThemeExamples(
  request: TraceIntelligenceRequest,
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
  return request<ThemeExamplesResponse>(themePath(entityId, themeId, `/examples?${query}`));
}

export function fetchThemeHistory(
  request: TraceIntelligenceRequest,
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  themeId: string,
  limit = 100,
) {
  const query = new URLSearchParams({ entityType, signalName, limit: String(limit) });
  return request<ThemeHistoryResponse>(themePath(entityId, themeId, `/history?${query}`));
}

export function fetchNoise(
  request: TraceIntelligenceRequest,
  entityId: string,
  entityType: string,
  signalName: TraceSignalName,
  snapshotId: string,
) {
  const query = new URLSearchParams({ entityType, signalName, snapshotId });
  return request<NoiseResponse>(noisePath(entityId, `?${query}`));
}

export function fetchNoiseExamples(
  request: TraceIntelligenceRequest,
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
  return request<NoiseExamplesResponse>(noisePath(entityId, `/examples?${query}`));
}

export async function fetchThemePaths(
  request: TraceIntelligenceRequest,
  entityId: string,
  entityType: string,
  signalNames: TraceSignalName[],
  snapshotId: string,
): Promise<ThemePathsResponse> {
  const firstPage = await fetchThemePathsPage(request, entityId, entityType, signalNames, snapshotId, 0);
  const paths = [...firstPage.paths];
  const themes = { ...firstPage.themes };
  let nextOffset = firstPage.nextOffset;

  while (nextOffset !== undefined) {
    const page = await fetchThemePathsPage(request, entityId, entityType, signalNames, snapshotId, nextOffset);
    paths.push(...page.paths);
    Object.assign(themes, page.themes);
    nextOffset = page.nextOffset;
  }

  return { snapshot: firstPage.snapshot, signals: firstPage.signals, themes, paths };
}

function fetchThemePathsPage(
  request: TraceIntelligenceRequest,
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
  return request<ThemePathsResponse>(`/api/learning/entities/${encodeURIComponent(entityId)}/theme-paths?${query}`);
}

export function fetchTraceInsight(request: TraceIntelligenceRequest, traceId: string) {
  return request<TraceInsightResponse>(`/api/learning/traces/${encodeURIComponent(traceId)}/summary`);
}

function themePath(entityId: string, themeId: string, suffix: string) {
  return `/api/learning/entities/${encodeURIComponent(entityId)}/themes/${encodeURIComponent(themeId)}${suffix}`;
}

function noisePath(entityId: string, suffix: string) {
  return `/api/learning/entities/${encodeURIComponent(entityId)}/noise${suffix}`;
}

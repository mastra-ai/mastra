import type { ModelReasoningOption } from '@mastra/core/llm';
import type { ModelCatalogEntry } from '@mastra/factory/routes/config';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { AvailableModelsFilter } from '../api/keys';
import { fetchSessionModelCatalog, sessionModelCatalogQueryOptions } from './useSessionModelCatalog';
import type { SessionModelCatalog, SessionModelCatalogTarget } from './useSessionModelCatalog';

/** One selectable model from `GET /web/config/models` (credentialed providers only). */
export type AvailableModelOption = ModelCatalogEntry;

export interface AvailableModelsTarget extends AvailableModelsFilter {
  enabled?: boolean;
}

interface SettingsModelCatalog {
  models: AvailableModelOption[];
  /** null when no key in this scope can run the built-in start model */
  fallbackModelId?: string | null;
}

function settingsModelsQuery(target?: AvailableModelsTarget) {
  if (target?.scope) return `?scope=${target.scope}`;
  if (target?.factoryProjectId) return `?factoryId=${encodeURIComponent(target.factoryProjectId)}`;
  return '';
}

async function fetchSettingsModels(baseUrl: string, target?: AvailableModelsTarget): Promise<SettingsModelCatalog> {
  const query = settingsModelsQuery(target);
  const res = await fetch(`${baseUrl}/web/config/models${query}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
  return (await res.json()) as SettingsModelCatalog;
}

/** Settings catalogs use the Factory's scope or the caller's own personal credentials. */
export function availableModelsQueryOptions(baseUrl: string, target?: AvailableModelsTarget) {
  return queryOptions({
    queryKey: queryKeys.availableModels(target && { factoryProjectId: target.factoryProjectId, scope: target.scope }),
    queryFn: () => fetchSettingsModels(baseUrl, target),
  });
}

export function useAvailableModelsQuery(target?: AvailableModelsTarget) {
  const { baseUrl, client } = useApiConfig();
  const session: SessionModelCatalogTarget | undefined =
    target?.sessionId && target.resourceId && target.threadId
      ? { ...target, sessionId: target.sessionId, resourceId: target.resourceId, threadId: target.threadId }
      : undefined;
  const queryKey = session
    ? sessionModelCatalogQueryOptions(client, session).queryKey
    : availableModelsQueryOptions(baseUrl, target).queryKey;
  return useQuery<SettingsModelCatalog | SessionModelCatalog, Error, AvailableModelOption[]>({
    queryKey,
    queryFn: session ? () => fetchSessionModelCatalog(client, session) : () => fetchSettingsModels(baseUrl, target),
    enabled: target?.enabled !== false,
    select: catalog => catalog.models,
  });
}

/** Catalog reachable with the caller's own credentials, for personal defaults. */
export function usePersonalAvailableModelsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({ ...availableModelsQueryOptions(baseUrl, { scope: 'user' }), select: catalog => catalog.models });
}

export function useFallbackModelQuery(target: AvailableModelsTarget) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    ...availableModelsQueryOptions(baseUrl, target),
    enabled: target.enabled !== false,
    select: catalog => catalog.fallbackModelId ?? undefined,
  });
}

export function useModelReasoningOptions(
  modelId: string | undefined,
  target?: AvailableModelsTarget,
): ModelReasoningOption[] | undefined {
  const { data: models } = useAvailableModelsQuery(target);
  return models?.find(model => model.id === modelId)?.reasoningOptions;
}

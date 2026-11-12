import { useDefaultModelQuery } from '../../../../hooks/use-default-model';
import type { AvailableModelOption, AvailableModelsTarget } from '../../../../hooks/useAvailableModels';
import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';

export interface ProviderModels {
  isPending: boolean;
  catalogError?: Error;
  models: AvailableModelOption[];
  /** What the Factory starts on unless the user picks another model. */
  suggestedModelId?: string;
  retry: () => void;
}

export function preferredFactoryModel(providerId: string): string | undefined {
  switch (providerId) {
    case 'openai':
      return 'openai/gpt-5.6-sol';
    case 'anthropic':
      return 'anthropic/claude-fable-5';
    case 'mastra':
      return 'mastra/anthropic/claude-opus-5.5';
    default:
      return undefined;
  }
}

/** Unscoped catalogs keep the bare cache key other screens share; an unconnected lane fetches nothing. */
function catalogTarget(scope: 'org' | 'user' | undefined, enabled: boolean): AvailableModelsTarget | undefined {
  if (scope) return { scope, enabled };
  if (enabled) return undefined;
  return { enabled };
}

/** The models a connected provider offers, with the one a Factory should start on. */
export function useProviderModels(providerId: string | undefined, scope?: 'org' | 'user'): ProviderModels {
  const enabled = providerId !== undefined;
  const personalDefault = useDefaultModelQuery({ enabled: enabled && scope === 'user' });
  const modelsQuery = useAvailableModelsQuery(catalogTarget(scope, enabled));
  const models = (modelsQuery.data ?? []).filter(model => model.provider === providerId);
  const savedDefault =
    scope === 'user' ? models.find(model => model.id === personalDefault.data?.modelId)?.id : undefined;
  const preferredModelId = savedDefault ?? (providerId ? preferredFactoryModel(providerId) : undefined);

  return {
    isPending: enabled && (modelsQuery.isPending || (scope === 'user' && personalDefault.isPending)),
    catalogError: modelsQuery.error ?? undefined,
    models,
    suggestedModelId: models.find(model => model.id === preferredModelId)?.id ?? models[0]?.id,
    retry: () => {
      void modelsQuery.refetch();
    },
  };
}

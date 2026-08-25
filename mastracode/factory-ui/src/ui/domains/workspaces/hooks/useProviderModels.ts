import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useAvailableModelsQuery } from '../../../../hooks/useAvailableModels';

export interface ProviderModels {
  isPending: boolean;
  catalogError?: Error;
  models: AvailableModelOption[];
  /** What the Factory starts on unless the user picks another model. */
  suggestedModelId?: string;
}

function preferredFactoryModel(providerId: string): string | undefined {
  switch (providerId) {
    case 'openai':
      return 'openai/gpt-5.6-sol';
    case 'anthropic':
      return 'anthropic/claude-fable-5';
    default:
      return undefined;
  }
}

/** The models a connected provider offers, with the one a Factory should start on. */
export function useProviderModels(providerId: string | undefined): ProviderModels {
  const modelsQuery = useAvailableModelsQuery();
  const models = (modelsQuery.data ?? []).filter(model => model.provider === providerId);
  const preferredModelId = providerId ? preferredFactoryModel(providerId) : undefined;

  return {
    isPending: modelsQuery.isPending,
    catalogError: modelsQuery.error ?? undefined,
    models,
    suggestedModelId: models.find(model => model.id === preferredModelId)?.id ?? models[0]?.id,
  };
}

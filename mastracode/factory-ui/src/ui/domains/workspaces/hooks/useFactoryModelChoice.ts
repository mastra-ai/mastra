import { useState } from 'react';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { useSetFactoryDefaultModelMutation } from '../../../../hooks/useFactoryDefaultModel';
import { useProviderModels } from './useProviderModels';

export interface FactoryModelChoice {
  isPending: boolean;
  catalogError?: Error;
  models: AvailableModelOption[];
  /** The suggested model until the user picks another one. */
  modelId: string;
  setModelId: (modelId: string) => void;
  saving: boolean;
  error?: string;
  save: (modelId?: string) => Promise<void>;
}

/** The model an existing Factory's runs start on. */
export function useFactoryModelChoice({
  factoryId,
  providerId,
  onSaved,
}: {
  factoryId: string;
  providerId?: string;
  onSaved: () => void;
}): FactoryModelChoice {
  const catalog = useProviderModels(providerId);
  const setDefaultModel = useSetFactoryDefaultModelMutation(factoryId);
  const [selectedModelId, setSelectedModelId] = useState('');
  const [error, setError] = useState<string>();

  const modelId = selectedModelId || (catalog.suggestedModelId ?? '');

  return {
    isPending: catalog.isPending,
    catalogError: catalog.catalogError,
    models: catalog.models,
    modelId,
    setModelId: setSelectedModelId,
    saving: setDefaultModel.isPending,
    error,
    save: async (chosenModelId = modelId) => {
      if (!providerId || !chosenModelId) return;
      setError(undefined);
      try {
        // Connecting a provider selects the run's main model; it deliberately
        // does not touch the observer/reflector rows, which stay on auto.
        await setDefaultModel.mutateAsync(chosenModelId);
        onSaved();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Failed to configure model defaults');
      }
    },
  };
}

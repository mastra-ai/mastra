import { usePersonalAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import { useDefaultModelQuery, useSetDefaultFallbackModels } from '../../../../../../hooks/use-default-model';
import { FallbackModelsEditor } from './FallbackModelsEditor';

export function PersonalFallbackModels() {
  const defaultModelQuery = useDefaultModelQuery();
  const modelsQuery = usePersonalAvailableModelsQuery();
  const setFallbackModels = useSetDefaultFallbackModels();

  return (
    <FallbackModelsEditor
      value={setFallbackModels.pendingOr(defaultModelQuery.data?.fallbackModelIds ?? [])}
      primaryModelId={defaultModelQuery.data?.modelId ?? undefined}
      models={modelsQuery.data}
      disabled={defaultModelQuery.isPending}
      error={setFallbackModels.error?.message}
      onChange={next => setFallbackModels.mutate(next)}
    />
  );
}

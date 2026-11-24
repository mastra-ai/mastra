import { useAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import {
  useFactoryProjectQuery,
  useSetFactoryFallbackModelsMutation,
} from '../../../../../../hooks/useFactoryDefaultModel';
import { FallbackModelsEditor } from './FallbackModelsEditor';

export function FactoryFallbackModels({ factoryId }: { factoryId: string }) {
  const projectQuery = useFactoryProjectQuery(factoryId);
  const modelsQuery = useAvailableModelsQuery({ scope: 'org' });
  const setFallbackModels = useSetFactoryFallbackModelsMutation(factoryId);

  return (
    <FallbackModelsEditor
      value={setFallbackModels.pendingOr(projectQuery.data?.fallbackModelIds ?? [])}
      primaryModelId={projectQuery.data?.defaultModelId ?? undefined}
      models={modelsQuery.data}
      disabled={projectQuery.isPending}
      error={setFallbackModels.error?.message}
      onChange={next => setFallbackModels.mutate(next)}
    />
  );
}

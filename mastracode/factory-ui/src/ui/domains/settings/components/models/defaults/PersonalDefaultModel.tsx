import { Txt } from '@mastra/playground-ui/components/Txt';

import { useDefaultModelQuery } from '../../../../../../hooks/use-default-model';
import { useFallbackModelQuery, usePersonalAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import { PersonalDefaultModelPicker } from './PersonalDefaultModelPicker';
import { PersonalDefaultModelSkeleton } from './PersonalDefaultModelSkeleton';

export function PersonalDefaultModel() {
  const defaultModelQuery = useDefaultModelQuery();
  const modelsQuery = usePersonalAvailableModelsQuery();
  const fallbackModelQuery = useFallbackModelQuery({ scope: 'user' });

  if (defaultModelQuery.isPending) return <PersonalDefaultModelSkeleton />;
  if (defaultModelQuery.error) {
    return (
      <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
        {defaultModelQuery.error.message}
      </Txt>
    );
  }

  return (
    <PersonalDefaultModelPicker
      savedModelId={defaultModelQuery.data.modelId ?? undefined}
      savedThinkingLevel={defaultModelQuery.data.thinkingLevel}
      models={modelsQuery.data}
      fallbackModelId={fallbackModelQuery.data}
    />
  );
}

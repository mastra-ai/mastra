import { Txt } from '@mastra/playground-ui/components/Txt';

import { useDefaultModelQuery } from '../../../../../../hooks/use-default-model';
import { usePersonalAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import { PersonalDefaultModelPicker } from './PersonalDefaultModelPicker';

export function PersonalDefaultModel({ factoryId }: { factoryId: string }) {
  const defaultModelQuery = useDefaultModelQuery();
  const modelsQuery = usePersonalAvailableModelsQuery();

  if (defaultModelQuery.isPending) {
    return <SkeletonRows label="Loading your default model" rows={1} rowClassName="h-7 w-full" />;
  }
  if (defaultModelQuery.error) {
    return (
      <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
        {defaultModelQuery.error.message}
      </Txt>
    );
  }

  return (
    <PersonalDefaultModelPicker
      factoryId={factoryId}
      savedModelId={defaultModelQuery.data.modelId ?? undefined}
      savedThinkingLevel={defaultModelQuery.data.thinkingLevel}
      models={modelsQuery.data}
    />
  );
}

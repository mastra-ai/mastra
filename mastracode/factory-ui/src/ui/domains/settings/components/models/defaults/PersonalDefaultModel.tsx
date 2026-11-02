import { Txt } from '@mastra/playground-ui/components/Txt';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { useDefaultModelQuery } from '../../../../../../hooks/use-default-model';
import { useFallbackModelQuery, usePersonalAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import { PersonalDefaultModelPicker } from './PersonalDefaultModelPicker';

export function PersonalDefaultModel() {
  const defaultModelQuery = useDefaultModelQuery();
  const modelsQuery = usePersonalAvailableModelsQuery();
  const fallbackModelQuery = useFallbackModelQuery({ scope: 'user' });

  if (defaultModelQuery.isPending) {
    return (
      <SkeletonRows label="Loading your default model" rows={1} className="gap-2">
        <div aria-hidden className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />
          <div className="flex gap-2">
            <Skeleton className="h-control-sm w-40 max-w-full rounded-full motion-reduce:before:animate-none" />
            <Skeleton className="h-control-sm w-12 rounded-full motion-reduce:before:animate-none" />
          </div>
        </div>
      </SkeletonRows>
    );
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
      savedModelId={defaultModelQuery.data.modelId ?? undefined}
      savedThinkingLevel={defaultModelQuery.data.thinkingLevel}
      models={modelsQuery.data}
      fallbackModelId={fallbackModelQuery.data}
    />
  );
}

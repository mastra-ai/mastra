import { defaultModelPack } from '@mastra/factory/model-packs';
import type { ModelPackSet } from '@mastra/factory/model-packs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatModelName } from '@mastra/playground-ui/utils/model';

import { useDefaultModelQuery, useSetPersonalModelPacks } from '../../../../../../hooks/use-default-model';
import { useScopeModelCatalogQuery } from '../../../../../../hooks/useAvailableModels';
import { ModelPackList } from './ModelPackList';
import { ModelPackListSkeleton } from './ModelPackListSkeleton';

export function PersonalModelPacks() {
  const defaultsQuery = useDefaultModelQuery();
  const catalogQuery = useScopeModelCatalogQuery('user');
  const savePacks = useSetPersonalModelPacks();

  if (defaultsQuery.isPending) return <ModelPackListSkeleton label="Loading your model packs" />;
  if (defaultsQuery.error) {
    return (
      <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
        {defaultsQuery.error.message}
      </Txt>
    );
  }

  const packSet: ModelPackSet = {
    modelPacks: defaultsQuery.data.modelPacks,
    defaultModelPackId: defaultsQuery.data.defaultModelPackId,
  };
  const defaultModelId = defaultModelPack(packSet)?.models[0]?.modelId;
  const models = catalogQuery.data?.models;
  const unavailableModelId =
    defaultModelId && models && !models.some(model => model.id === defaultModelId) ? defaultModelId : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ModelPackList
        label="Your model packs"
        packSet={packSet}
        models={models}
        startModelId={catalogQuery.data?.fallbackModelId}
        readOnly={false}
        saving={savePacks.isPending}
        error={savePacks.error?.message}
        onSave={next => savePacks.mutateAsync(next)}
      />
      {unavailableModelId && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          None of your connected accounts can run {formatModelName(unavailableModelId)}. Choose another model or connect
          its provider.
        </Txt>
      )}
    </div>
  );
}

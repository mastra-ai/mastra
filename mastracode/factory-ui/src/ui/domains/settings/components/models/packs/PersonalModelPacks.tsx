import { defaultModelPack } from '@mastra/factory/model-packs';
import type { ModelPackSet } from '@mastra/factory/model-packs';
import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatModelName } from '@mastra/playground-ui/utils/model';

import {
  useApplyDefaultModel,
  useDefaultModelQuery,
  useSetPersonalModelPacks,
} from '../../../../../../hooks/use-default-model';
import { usePersonalAvailableModelsQuery } from '../../../../../../hooks/useAvailableModels';
import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import { AppliedSessionsSummary } from '../defaults/AppliedSessionsSummary';
import { ModelPackList } from './ModelPackList';

export function PersonalModelPacks() {
  const defaultsQuery = useDefaultModelQuery();
  const modelsQuery = usePersonalAvailableModelsQuery();
  const savePacks = useSetPersonalModelPacks();
  const applyDefaultModel = useApplyDefaultModel();

  if (defaultsQuery.isPending) {
    return (
      <SkeletonRows label="Loading your model packs" rows={1} className="gap-2">
        <Skeleton aria-hidden className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />
      </SkeletonRows>
    );
  }
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
  const models = modelsQuery.data;
  const unavailableModelId =
    defaultModelId && models && !models.some(model => model.id === defaultModelId) ? defaultModelId : undefined;

  const save = (next: ModelPackSet) => {
    applyDefaultModel.reset();
    return savePacks.mutateAsync(next);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ModelPackList
        label="Your model packs"
        packSet={packSet}
        models={models}
        readOnly={false}
        saving={savePacks.isPending}
        error={savePacks.error?.message}
        onSave={save}
      />
      {unavailableModelId && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          None of your connected accounts can run {formatModelName(unavailableModelId)}. Choose another model or connect
          its provider.
        </Txt>
      )}
      {defaultModelId && (
        <div>
          <Button
            size="sm"
            disabled={savePacks.isPending || applyDefaultModel.isPending}
            onClick={() => applyDefaultModel.mutate()}
          >
            Apply to my running chats
          </Button>
        </div>
      )}
      {applyDefaultModel.error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {applyDefaultModel.error.message}
        </Txt>
      )}
      {applyDefaultModel.data && <AppliedSessionsSummary result={applyDefaultModel.data} />}
    </div>
  );
}

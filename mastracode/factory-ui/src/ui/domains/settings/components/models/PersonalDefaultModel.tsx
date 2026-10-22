import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatModelName } from '@mastra/playground-ui/utils/model';

import {
  useApplyDefaultModel,
  useClearDefaultModel,
  useDefaultModelQuery,
  useSetDefaultModel,
} from '../../../../../hooks/use-default-model';
import { usePersonalAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import { SkeletonRows } from '../../../../ui/SkeletonRows';
import { ModelCombobox } from '../ModelCombobox';
import { AppliedSessionsSummary } from './AppliedSessionsSummary';

export function PersonalDefaultModel() {
  const defaultModelQuery = useDefaultModelQuery();
  const modelsQuery = usePersonalAvailableModelsQuery();
  const setDefaultModel = useSetDefaultModel();
  const clearDefaultModel = useClearDefaultModel();
  const applyDefaultModel = useApplyDefaultModel();

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

  const models = modelsQuery.data ?? [];
  const defaultModelId = defaultModelQuery.data.modelId ?? '';
  const busy = setDefaultModel.isPending || clearDefaultModel.isPending || applyDefaultModel.isPending;
  const defaultUnavailable =
    defaultModelId !== '' && modelsQuery.isSuccess && !models.some(model => model.id === defaultModelId);
  const errorText = (setDefaultModel.error ?? clearDefaultModel.error ?? applyDefaultModel.error)?.message;

  const saveDefaultModel = (modelId: string) => {
    if (!modelId || modelId === defaultModelId) return;
    applyDefaultModel.reset();
    setDefaultModel.mutate(modelId);
  };

  const clearDefault = () => {
    applyDefaultModel.reset();
    clearDefaultModel.mutate();
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ModelCombobox
        models={models}
        value={defaultModelId}
        onValueChange={saveDefaultModel}
        placeholder="Select a model"
        aria-label="Personal default model"
        size="sm"
        disabled={busy}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !defaultModelId} onClick={() => applyDefaultModel.mutate()}>
          Apply to running sessions
        </Button>
        <Button size="sm" variant="ghost" disabled={busy || !defaultModelId} onClick={clearDefault}>
          Clear
        </Button>
      </div>
      {defaultUnavailable && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          None of your connected accounts can run {formatModelName(defaultModelId)}. Choose another model or connect its
          provider.
        </Txt>
      )}
      {errorText && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {errorText}
        </Txt>
      )}
      {applyDefaultModel.data && <AppliedSessionsSummary result={applyDefaultModel.data} />}
    </div>
  );
}

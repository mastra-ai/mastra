import type { ThinkingLevelSetting } from '@mastra/code-sdk/thinking';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { formatModelName } from '@mastra/playground-ui/utils/model';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import {
  useApplyDefaultModel,
  useClearDefaultModel,
  useSetDefaultModel,
} from '../../../../../../hooks/use-default-model';
import { ModelCombobox } from '../../ModelCombobox';
import { AppliedSessionsSummary } from './AppliedSessionsSummary';
import { PersonalThinkingControl } from './PersonalThinkingControl';

export function PersonalDefaultModelPicker({
  savedModelId,
  savedThinkingLevel,
  models,
  fallbackModelId,
}: {
  savedModelId: string | undefined;
  savedThinkingLevel: ThinkingLevelSetting | null;
  models: AvailableModelOption[] | undefined;
  fallbackModelId: string | undefined;
}) {
  const setDefaultModel = useSetDefaultModel();
  const clearDefaultModel = useClearDefaultModel();
  const applyDefaultModel = useApplyDefaultModel();

  const busy = setDefaultModel.isPending || clearDefaultModel.isPending || applyDefaultModel.isPending;
  const unavailableModelId =
    savedModelId && models && !models.some(model => model.id === savedModelId) ? savedModelId : undefined;
  const errorText = (setDefaultModel.error ?? clearDefaultModel.error ?? applyDefaultModel.error)?.message;

  const saveDefaultModel = (modelId: string) => {
    if (!modelId || modelId === savedModelId) return;
    applyDefaultModel.reset();
    setDefaultModel.mutate(modelId);
  };

  const clearDefault = () => {
    applyDefaultModel.reset();
    clearDefaultModel.mutate();
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ButtonsGroup size="sm" aria-label="Personal default model and thinking" className="w-full">
        <ModelCombobox
          models={models ?? []}
          value={savedModelId ?? ''}
          onValueChange={saveDefaultModel}
          fallbackModelId={fallbackModelId}
          placeholder="Select a model"
          aria-label="Personal default model"
          size="sm"
          className="min-w-0 flex-1"
          disabled={busy}
        />
        <PersonalThinkingControl savedModelId={savedModelId} savedThinkingLevel={savedThinkingLevel} saving={busy} />
      </ButtonsGroup>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={busy || !savedModelId} onClick={() => applyDefaultModel.mutate()}>
          Apply to my running chats
        </Button>
        <Button size="sm" variant="ghost" disabled={busy || !savedModelId} onClick={clearDefault}>
          Clear
        </Button>
      </div>
      {unavailableModelId && (
        <Txt as="p" variant="caption" className="text-destructive-foreground">
          None of your connected accounts can run {formatModelName(unavailableModelId)}. Choose another model or connect
          its provider.
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

import {
  ModelPicker as ModelPickerView,
  ModelPickerTrigger,
  ModelPickerContent,
  ModelPickerModels,
  ModelPickerPacks,
  ModelPickerPackActions,
  ModelPickerResetPack,
  ModelPickerManagePacks,
  ModelPickerLoading,
  ModelPickerUnavailable,
  ModelPickerReadOnly,
} from '@mastra/playground-ui/components/ModelPicker';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useAvailableModelsQuery } from '../../../../../hooks/useAvailableModels';
import type { ModelPackInfo } from '../../../../../api/types';
import { settingsSectionPath } from '../../../settings/settingsSections';

import { useChatConnection } from '../../context/useChatConnection';
import { useChatModels } from '../../context/useChatModels';
import { useChatModes } from '../../context/useChatModes';
import { useChatSessionContext } from '../../context/useChatSessionContext';

function titleCase(value: string): string {
  return value ? `${value[0]?.toUpperCase()}${value.slice(1).toLowerCase()}` : value;
}

function lastSegment(id: string): string {
  const parts = id.trim().split('/');
  return parts[parts.length - 1] || id;
}

export function formatModelName(id: string): string {
  const slug = lastSegment(id);
  const claudeMatch = slug.match(/^claude-(opus|sonnet|haiku)-(\d+)-(\d+)$/i);
  const claudeFamily = claudeMatch?.[1];
  const claudeMajor = claudeMatch?.[2];
  const claudeMinor = claudeMatch?.[3];
  if (claudeFamily && claudeMajor && claudeMinor) {
    return `Claude ${titleCase(claudeFamily)} ${claudeMajor}.${claudeMinor}`;
  }

  const gptDetails = slug.match(/^gpt-(.+)$/i)?.[1];
  if (gptDetails) {
    const [version, ...qualifiers] = gptDetails.split('-');
    return [`GPT-${version}`, ...qualifiers.map(titleCase)].join(' ');
  }

  return slug.split(/[-_]+/).filter(Boolean).map(titleCase).join(' ');
}

type PackModeKey = 'build' | 'plan' | 'fast';

function packModeKey(modeId: string | undefined): PackModeKey | undefined {
  return modeId === 'build' || modeId === 'plan' || modeId === 'fast' ? modeId : undefined;
}

function packSummary(pack: ModelPackInfo): string {
  return `${formatModelName(pack.models.build)} · ${formatModelName(pack.models.plan)} · ${formatModelName(pack.models.fast)}`;
}

function packDetail(pack: ModelPackInfo): string {
  return `Build ${pack.models.build} · Plan ${pack.models.plan} · Fast ${pack.models.fast}`;
}

export function ModelPicker() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const navigate = useNavigate();
  const { kind, sessionEnabled, draftSessionId } = useChatSessionContext();
  const { status } = useChatConnection();
  const { activeModeId } = useChatModes();
  const { activeModelId, activeModelPackId, defaultModelPackId, modelPacks, setModel, setModelPack, isLoading, error } =
    useChatModels();
  const modelsQuery = useAvailableModelsQuery();
  const [pendingModelId, setPendingModelId] = useState<string>();
  const [pendingPackId, setPendingPackId] = useState<string>();

  const modeKey = packModeKey(activeModeId);
  const pendingPack = modelPacks.find(pack => pack.id === pendingPackId);
  const selectedModelId =
    pendingModelId ?? (pendingPack && modeKey ? pendingPack.models[modeKey] : undefined) ?? activeModelId;
  const selectedPackId = pendingPackId ?? activeModelPackId;
  const selectedPack = modelPacks.find(pack => pack.id === selectedPackId);
  const busy = Boolean(pendingModelId || pendingPackId);

  const label = selectedModelId ? formatModelName(selectedModelId) : 'No model';
  const notConfigured =
    Boolean(selectedModelId) && modelsQuery.isSuccess && !modelsQuery.data.some(model => model.id === selectedModelId);
  const switchable = kind === 'user' ? Boolean(draftSessionId) || sessionEnabled : kind === 'factory' && sessionEnabled;
  const showPacks = kind === 'user' && modelPacks.length > 0;
  const packModelDeviates = Boolean(
    selectedPack && modeKey && selectedModelId && selectedPack.models[modeKey] !== selectedModelId,
  );
  const canReset =
    showPacks && Boolean(defaultModelPackId) && (selectedPackId !== defaultModelPackId || packModelDeviates);

  const runAction = (action: Promise<void>, clear: () => void, failure: string) => {
    void action.then(clear, (cause: unknown) => {
      clear();
      toast.error(cause instanceof Error ? cause.message : failure);
    });
  };

  const pickModel = (modelId: string) => {
    if (busy) return;
    if (modelId === activeModelId) return;
    setPendingModelId(modelId);
    runAction(setModel(modelId), () => setPendingModelId(undefined), 'Failed to switch model');
  };

  const pickPack = (packId: string) => {
    if (busy) return;
    if (packId === activeModelPackId && !packModelDeviates) return;
    setPendingPackId(packId);
    runAction(setModelPack(packId), () => setPendingPackId(undefined), 'Failed to apply model pack');
  };

  if (!selectedModelId && (isLoading || status === 'connecting')) return <ModelPickerLoading />;
  if (!selectedModelId && error) return <ModelPickerUnavailable error={error.message} />;
  if (!switchable || (!showPacks && !modelsQuery.data?.length)) {
    return <ModelPickerReadOnly value={selectedModelId} label={label} notConfigured={notConfigured} />;
  }

  return (
    <ModelPickerView busy={busy}>
      <ModelPickerTrigger
        label={label}
        title={[selectedModelId, selectedPack?.name].filter(Boolean).join(' · ') || undefined}
        notConfigured={notConfigured}
      />
      <ModelPickerContent
        searchPlaceholder={showPacks ? 'Search models and packs…' : 'Search models…'}
        footer={
          modeKey
            ? `Model choices apply to ${titleCase(modeKey)} mode only.${showPacks ? ' Packs set all three modes.' : ''}`
            : undefined
        }
      >
        {showPacks && (
          <ModelPickerPacks
            options={modelPacks.map(pack => ({
              id: pack.id,
              name: pack.name,
              summary: packSummary(pack),
              detail: packDetail(pack),
              keywords: [pack.name, pack.models.build, pack.models.plan, pack.models.fast],
            }))}
            value={packModelDeviates ? undefined : selectedPackId}
            defaultId={defaultModelPackId}
            onValueChange={pickPack}
          />
        )}
        <ModelPickerModels
          options={(modelsQuery.data ?? []).map(model => ({
            ...model,
            keywords: [model.provider, model.modelName, formatModelName(model.id)],
          }))}
          value={selectedModelId}
          onValueChange={pickModel}
        />
        {showPacks && (
          <ModelPickerPackActions>
            {canReset && defaultModelPackId && <ModelPickerResetPack onSelect={() => pickPack(defaultModelPackId)} />}
            {factoryId && (
              <ModelPickerManagePacks
                onSelect={() => navigate(`${settingsSectionPath(factoryId, 'models')}#model-packs`)}
              />
            )}
          </ModelPickerPackActions>
        )}
      </ModelPickerContent>
    </ModelPickerView>
  );
}

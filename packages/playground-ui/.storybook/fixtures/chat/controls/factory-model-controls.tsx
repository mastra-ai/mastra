import { useState } from 'react';
import { fn } from 'storybook/test';
import { models, modes, packs, packModel } from './models';
import type { ModelControlState } from './models';
import { ComposerModeSelect, ComposerStatusLine } from '@/ds/components/Composer';
import { ModelPicker } from '@/ds/components/ModelPicker';

const manageModelPacks = fn().mockName('Navigate to model pack settings');

export function FactoryModelControls({
  personal,
  mode,
  onModeChange,
  state,
}: {
  personal: boolean;
  mode: string;
  onModeChange: (mode: string) => void;
  state: ModelControlState;
}) {
  const [selection, setSelection] = useState({ packId: 'balanced', overrides: new Map<string, string>() });
  const modelId = selection.overrides.get(mode) ?? packModel(selection.packId, mode);
  const selectedModel = models.find(model => model.id === modelId);
  const canReset = selection.packId !== 'balanced' || selection.overrides.has(mode);
  const selectPack = (packId: string) => setSelection({ packId, overrides: new Map() });
  return (
    <ComposerStatusLine>
      {personal && <ComposerModeSelect modes={modes} value={mode} onValueChange={onModeChange} />}
      <ModelPicker
        value={modelId}
        label={selectedModel?.modelName ?? modelId}
        title={modelId}
        models={state === 'unconfigured' ? models.filter(model => model.id !== modelId) : models}
        onValueChange={model =>
          setSelection(current => ({ ...current, overrides: new Map(current.overrides).set(mode, model) }))
        }
        loading={state === 'loading'}
        readOnly={state === 'locked'}
        notConfigured={state === 'unconfigured'}
        packs={
          personal
            ? {
                options: packs,
                selectedId: selection.overrides.has(mode) ? undefined : selection.packId,
                defaultId: 'balanced',
                onSelect: selectPack,
                onReset: canReset ? () => selectPack('balanced') : undefined,
                onManage: manageModelPacks,
              }
            : undefined
        }
        footer={`Model choices apply to ${modes.find(option => option.id === mode)?.name ?? mode} mode only.${personal ? ' Packs set all three modes.' : ''}`}
      />
    </ComposerStatusLine>
  );
}

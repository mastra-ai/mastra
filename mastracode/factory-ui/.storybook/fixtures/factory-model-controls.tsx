import {
  ModelPickerPackActions,
  ModelPickerResetPack,
  ModelPickerManagePacks,
} from '../../src/ui/domains/chat/components/StatusLine/ModelPackActions';
import { ModeIcon } from '../../src/ui/domains/chat/components/StatusLine/ModeIcon';
import { useState } from 'react';
import { fn } from 'storybook/test';
import {
  models,
  modes,
  packs,
  packModel,
} from '../../../../packages/playground-ui/.storybook/fixtures/model-picker/models';
import type { ModelControlState } from '../../../../packages/playground-ui/.storybook/fixtures/model-picker/models';
import { ComposerModeSelect, ComposerStatusLine } from '@mastra/playground-ui/components/Composer';
import {
  ModelPicker,
  ModelPickerTrigger,
  ModelPickerContent,
  ModelPickerModels,
  ModelPickerPacks,
  ModelPickerLoading,
  ModelPickerReadOnly,
} from '@mastra/playground-ui/components/ModelPicker';

const manageModelPacks = fn().mockName('Navigate to model pack settings');

function FactoryModelMenu({ personal, mode, state }: { personal: boolean; mode: string; state: ModelControlState }) {
  const [selection, setSelection] = useState({ packId: 'balanced', overrides: new Map<string, string>() });
  const modelId = selection.overrides.get(mode) ?? packModel(selection.packId, mode);
  const selectedModel = models.find(model => model.id === modelId);
  const canReset = selection.packId !== 'balanced' || selection.overrides.has(mode);
  const selectPack = (packId: string) => setSelection({ packId, overrides: new Map() });
  if (state === 'loading') return <ModelPickerLoading />;
  if (state === 'locked') return <ModelPickerReadOnly value={modelId} label={selectedModel?.modelName ?? modelId} />;
  return (
    <ModelPicker>
      <ModelPickerTrigger
        label={selectedModel?.modelName ?? modelId}
        title={modelId}
        notConfigured={state === 'unconfigured'}
      />
      <ModelPickerContent
        searchPlaceholder={personal ? 'Search models and packs…' : 'Search models…'}
        footer={`Model choices apply to ${modes.find(option => option.id === mode)?.name ?? mode} mode only.${personal ? ' Packs set all three modes.' : ''}`}
      >
        {personal && (
          <ModelPickerPacks
            options={packs}
            value={selection.overrides.has(mode) ? undefined : selection.packId}
            defaultId="balanced"
            onValueChange={selectPack}
          />
        )}
        <ModelPickerModels
          options={state === 'unconfigured' ? models.filter(model => model.id !== modelId) : models}
          value={modelId}
          onValueChange={model =>
            setSelection(current => ({ ...current, overrides: new Map(current.overrides).set(mode, model) }))
          }
        />
        {personal && (
          <ModelPickerPackActions>
            {canReset && <ModelPickerResetPack onSelect={() => selectPack('balanced')} />}
            <ModelPickerManagePacks onSelect={manageModelPacks} />
          </ModelPickerPackActions>
        )}
      </ModelPickerContent>
    </ModelPicker>
  );
}

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
  return (
    <ComposerStatusLine>
      {personal && (
        <ComposerModeSelect
          modes={modes.map(mode => ({ ...mode, icon: <ModeIcon modeId={mode.id} /> }))}
          value={mode}
          onValueChange={onModeChange}
        />
      )}
      <FactoryModelMenu personal={personal} mode={mode} state={state} />
    </ComposerStatusLine>
  );
}

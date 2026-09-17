import { useState } from 'react';
import type { ReactNode } from 'react';
import { models, packs } from './models';
import {
  ModelPicker,
  ModelPickerTrigger,
  ModelPickerContent,
  ModelPickerItem,
  ModelPickerModels,
  ModelPickerPacks,
} from '@/ds/components/ModelPicker';
import { CommandGroup } from '@/ds/components/Command';

export function CombinedPicker({
  busy = false,
  notConfigured = false,
  label,
  empty = false,
  footer,
}: {
  busy?: boolean;
  notConfigured?: boolean;
  label?: string;
  empty?: boolean;
  footer?: ReactNode;
}) {
  const [modelId, setModelId] = useState('openai/gpt-4.1');
  const selectedModel = models.find(model => model.id === modelId);
  return (
    <ModelPicker busy={busy}>
      <ModelPickerTrigger label={label ?? selectedModel?.modelName ?? modelId} notConfigured={notConfigured} />
      <ModelPickerContent footer={footer}>
        <ModelPickerModels options={empty ? [] : models} value={modelId} onValueChange={setModelId} />
      </ModelPickerContent>
    </ModelPicker>
  );
}

export function PickerWithPacks() {
  const [selection, setSelection] = useState<{ kind: 'model' | 'pack'; id: string }>({ kind: 'pack', id: 'balanced' });
  const selectedModel = models.find(model => selection.kind === 'model' && model.id === selection.id);
  const selectedPack = packs.find(pack => selection.kind === 'pack' && pack.id === selection.id);
  return (
    <ModelPicker>
      <ModelPickerTrigger label={selectedModel?.modelName ?? selectedPack?.name ?? selection.id} />
      <ModelPickerContent footer={<div>Choose a model or a group of models.</div>}>
        <ModelPickerModels
          options={models}
          value={selection.kind === 'model' ? selection.id : undefined}
          onValueChange={id => setSelection({ kind: 'model', id })}
        />
        <ModelPickerPacks
          options={packs}
          value={selection.kind === 'pack' ? selection.id : undefined}
          defaultId="balanced"
          onValueChange={id => setSelection({ kind: 'pack', id })}
        />
        <CommandGroup>
          <ModelPickerItem value="Reset selection" onSelect={() => setSelection({ kind: 'pack', id: 'balanced' })}>
            Reset selection
          </ModelPickerItem>
        </CommandGroup>
      </ModelPickerContent>
    </ModelPicker>
  );
}

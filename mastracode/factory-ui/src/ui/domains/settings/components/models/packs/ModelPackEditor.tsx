import { MODEL_PACK_NAME_MAX } from '@mastra/factory/model-packs';
import type { ModelPack, ModelPackModel, ModelPackSet } from '@mastra/factory/model-packs';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { useState } from 'react';
import type { FormEvent } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { modelPackNameError } from '../../../services/modelPackSet';
import { ModelPackTimeline } from './ModelPackTimeline';

interface ModelPackEditorProps {
  packSet: ModelPackSet;
  models: AvailableModelOption[] | undefined;
  saving: boolean;
  error: string | undefined;
  onSave(pack: ModelPack): void;
  onCancel(): void;
}

export function ModelPackEditor({ packSet, models, saving, error, onSave, onCancel }: ModelPackEditorProps) {
  const [name, setName] = useState('');
  const [entries, setEntries] = useState<ModelPackModel[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const nameError = modelPackNameError(packSet, name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (saving || nameError || entries.length === 0) return;
    onSave({ id: crypto.randomUUID(), name: name.trim(), models: entries });
  };

  return (
    <form
      aria-label="New pack"
      onSubmit={submit}
      className="border-border1 flex min-w-0 flex-col gap-3 rounded-lg border p-3"
    >
      <SettingsRow label="Name" errorMsg={submitted ? nameError : undefined} controlPlacement="below">
        <Input
          autoFocus
          value={name}
          maxLength={MODEL_PACK_NAME_MAX}
          placeholder="Build"
          disabled={saving}
          onChange={event => setName(event.target.value)}
        />
      </SettingsRow>
      <ModelPackTimeline entries={entries} models={models} disabled={saving} onChange={setEntries} />
      {submitted && entries.length === 0 && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          Choose a model before saving.
        </Txt>
      )}
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground" role="alert">
          {error}
        </Txt>
      )}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

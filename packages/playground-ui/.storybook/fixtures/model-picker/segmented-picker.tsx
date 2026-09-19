import { useState } from 'react';
import { models } from './models';
import {
  ModelPickerCombobox,
  ModelPickerDivider,
  ModelPickerGroup,
  ModelProviderIcon,
} from '@/ds/components/ModelPicker';
import { AnthropicMessagesIcon } from '@/ds/icons/AnthropicMessagesIcon';
import { OpenAIIcon } from '@/ds/icons/OpenAIIcon';

const providers = [
  {
    value: 'openai',
    label: 'OpenAI',
    start: (
      <ModelProviderIcon connected>
        <OpenAIIcon />
      </ModelProviderIcon>
    ),
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    start: (
      <ModelProviderIcon connected>
        <AnthropicMessagesIcon />
      </ModelProviderIcon>
    ),
  },
];

export function SegmentedPicker({ disabled = false }: { disabled?: boolean }) {
  const [selection, setSelection] = useState({ provider: 'openai', model: 'openai/gpt-4.1' });
  return (
    <ModelPickerGroup>
      <ModelPickerCombobox
        segment="provider"
        aria-label="Provider"
        disabled={disabled}
        options={providers}
        value={selection.provider}
        onValueChange={provider => setSelection({ provider, model: '' })}
        placeholder="Select provider…"
        searchPlaceholder="Search providers…"
        emptyText="No providers found"
      />
      <ModelPickerDivider />
      <ModelPickerCombobox
        segment="model"
        aria-label="Model"
        disabled={disabled}
        options={models
          .filter(model => model.provider === selection.provider)
          .map(model => ({ value: model.id, label: model.modelName }))}
        value={selection.model}
        onValueChange={model => setSelection({ ...selection, model })}
        placeholder="Select model…"
        searchPlaceholder="Search models…"
        emptyText="No models found"
      />
    </ModelPickerGroup>
  );
}

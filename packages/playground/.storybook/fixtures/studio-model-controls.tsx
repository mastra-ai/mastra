import { ModelPickerCombobox, ModelPickerGroup, ModelProviderIcon } from '@mastra/playground-ui/components/ModelPicker';
import { AnthropicMessagesIcon } from '@mastra/playground-ui/icons/AnthropicMessagesIcon';
import { OpenAIIcon } from '@mastra/playground-ui/icons/OpenAIIcon';
import { useState } from 'react';
import type { ModelControlState } from '../../../playground-ui/.storybook/fixtures/model-picker/models';
import { models, initialStudioModelSelection } from '../../../playground-ui/.storybook/fixtures/model-picker/models';
import { ComposerModelPickerView } from '../../src/domains/agents/components/composer-model-picker-view';
import { ComposerModelWarnings } from '../../src/domains/agents/components/composer-model-warnings';

export function StudioModelPicker({
  state,
  selection,
  onSelectionChange,
}: {
  state: ModelControlState;
  selection: typeof initialStudioModelSelection;
  onSelectionChange: (selection: typeof initialStudioModelSelection) => void;
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const providers = [
    {
      value: 'openai',
      label: 'OpenAI',
      start: (
        <ModelProviderIcon connected={state !== 'unconfigured'}>
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
  return (
    <div className="flex max-w-full shrink-0 items-center gap-1.5">
      <ModelPickerGroup>
        <ComposerModelPickerView
          loading={state === 'loading'}
          lockedLabel={state === 'locked' ? `${selection.provider}/${selection.model}` : undefined}
          provider={
            <ModelPickerCombobox
              segment="provider"
              aria-label="Provider"
              options={providers}
              value={selection.provider}
              onValueChange={provider => {
                if (provider !== selection.provider) {
                  onSelectionChange({ provider, model: '' });
                  setModelOpen(true);
                }
              }}
              placeholder="Select provider..."
              searchPlaceholder="Search providers..."
              emptyText="No providers found"
            />
          }
          model={
            <ModelPickerCombobox
              segment="model"
              aria-label="Model"
              options={models
                .filter(model => model.provider === selection.provider)
                .map(model => ({
                  value: model.id.slice(model.provider.length + 1),
                  label: model.id.slice(model.provider.length + 1),
                }))}
              value={selection.model}
              onValueChange={model => onSelectionChange({ ...selection, model })}
              open={modelOpen}
              onOpenChange={setModelOpen}
              placeholder="Select model..."
              searchPlaceholder="Search models..."
              emptyText="No models found"
            />
          }
        />
      </ModelPickerGroup>
    </div>
  );
}

export function StudioModelWarnings({ state, provider }: { state: ModelControlState; provider: string }) {
  if (state !== 'unconfigured' || provider !== 'openai') return null;
  return <ComposerModelWarnings environmentVariable="OPENAI_API_KEY" />;
}

export function StudioModelExample({ state }: { state: ModelControlState }) {
  const [selection, setSelection] = useState(initialStudioModelSelection);
  return (
    <div>
      <StudioModelWarnings state={state} provider={selection.provider} />
      <StudioModelPicker state={state} selection={selection} onSelectionChange={setSelection} />
    </div>
  );
}

import {
  ModelPickerCombobox,
  ModelPickerDivider,
  ModelPickerGroup,
  ModelPickerLocked,
  ModelProviderIcon,
} from '@mastra/playground-ui/components/ModelPicker';
import { ModelSettings } from '@mastra/playground-ui/components/ModelSettings';
import type { ModelSettingsValues } from '@mastra/playground-ui/components/ModelSettings';
import { AnthropicMessagesIcon } from '@mastra/playground-ui/icons/AnthropicMessagesIcon';
import { OpenAIIcon } from '@mastra/playground-ui/icons/OpenAIIcon';
import { useState } from 'react';
import type { ModelControlState } from '../../../playground-ui/.storybook/fixtures/model-picker/models';
import { models, initialStudioModelSelection } from '../../../playground-ui/.storybook/fixtures/model-picker/models';
import { ComposerModelWarnings } from '../../src/domains/agents/components/composer-model-warnings';
import { ComposerRunSettings } from '../../src/domains/agents/components/composer-run-settings';

const methods = [
  { value: 'generate', label: 'Generate' },
  { value: 'streamSubscription', label: 'Stream subscription (default)' },
  { value: 'stream', label: 'Stream' },
  {
    value: 'network',
    label: 'Network',
    unavailable: 'Network is not available. Please make sure you have at least one sub-agent.',
  },
];

export function StudioModelControls({
  state,
  selection,
  onSelectionChange,
}: {
  state: ModelControlState;
  selection: typeof initialStudioModelSelection;
  onSelectionChange: (selection: typeof initialStudioModelSelection) => void;
}) {
  const [modelOpen, setModelOpen] = useState(false);
  const [requireToolApproval, setRequireToolApproval] = useState(false);
  const [method, setMethod] = useState('streamSubscription');
  const [settings, setSettings] = useState<ModelSettingsValues>({});
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
  if (state === 'loading') return null;
  return (
    <div className="flex max-w-full shrink-0 items-center gap-1.5">
      <ModelPickerGroup>
        {state === 'locked' ? (
          <ModelPickerLocked label={`${selection.provider}/${selection.model}`} />
        ) : (
          <>
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
            <ModelPickerDivider />
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
          </>
        )}
      </ModelPickerGroup>
      <ModelSettings
        value={settings}
        onChange={setSettings}
        onReset={() => {
          setSettings({});
          setMethod('streamSubscription');
          setRequireToolApproval(false);
        }}
      >
        <ComposerRunSettings
          method={method}
          methods={methods}
          onMethodChange={setMethod}
          requireToolApproval={requireToolApproval}
          onToolApprovalChange={setRequireToolApproval}
        />
      </ModelSettings>
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
      <StudioModelControls state={state} selection={selection} onSelectionChange={setSelection} />
    </div>
  );
}

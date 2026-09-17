import { useState } from 'react';
import { models } from './models';
import type { ModelControlState } from './models';
import {
  ModelPickerCombobox,
  ModelPickerDivider,
  ModelPickerGroup,
  ModelPickerLocked,
  ModelPickerWarnings,
  ModelProviderIcon,
} from '@/ds/components/ModelPicker';
import { ModelSettings } from '@/ds/components/ModelSettings';
import type { ModelSettingsValues } from '@/ds/components/ModelSettings';
import { AnthropicMessagesIcon } from '@/ds/icons/AnthropicMessagesIcon';
import { OpenAIIcon } from '@/ds/icons/OpenAIIcon';

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

export function StudioModelControls({ state }: { state: ModelControlState }) {
  const [selection, setSelection] = useState({ provider: 'openai', model: 'gpt-4.1' });
  const [modelOpen, setModelOpen] = useState(false);
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
                  setSelection({ provider, model: '' });
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
              onValueChange={model => setSelection(current => ({ ...current, model }))}
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
        method={method}
        methods={methods}
        onMethodChange={setMethod}
        onReset={() => {
          setSettings({});
          setMethod('streamSubscription');
        }}
      />
    </div>
  );
}

export function StudioModelWarnings({ state }: { state: ModelControlState }) {
  if (state !== 'unconfigured') return null;
  return <ModelPickerWarnings environmentVariable="OPENAI_API_KEY" />;
}

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { ModelSettings } from './model-settings';
import type { ModelSettingsProps } from './model-settings';

function SettingsExample(props: ModelSettingsProps) {
  const [value, setValue] = useState(props.value);
  const [method, setMethod] = useState(props.method);
  return (
    <ModelSettings
      {...props}
      value={value}
      onChange={setValue}
      method={method}
      onMethodChange={setMethod}
      onReset={() => {
        setValue({});
        setMethod('streamSubscription');
      }}
    />
  );
}
const meta = {
  title: 'AI/Model settings',
  component: ModelSettings,
  render: props => <SettingsExample {...props} />,
  args: {
    value: {},
    method: 'streamSubscription',
    methods: [
      { value: 'generate', label: 'Generate' },
      { value: 'streamSubscription', label: 'Stream subscription (default)' },
      { value: 'stream', label: 'Stream' },
      {
        value: 'network',
        label: 'Network',
        unavailable: 'Network is not available. Please make sure you have at least one sub-agent.',
      },
    ],
    onChange: fn(),
    onMethodChange: fn(),
    onReset: fn(),
  },
} satisfies Meta<typeof ModelSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const ReadOnly: Story = { args: { canEdit: false } };
export const SamplingRestriction: Story = {
  args: {
    value: { temperature: 0.5 },
    samplingNotice: 'Claude 4.5+ models only accept Temperature OR Top P. Clear Temperature to use Top P.',
  },
};
export const LegacyMethods: Story = {
  args: {
    method: 'streamLegacy',
    methods: [
      { value: 'generateLegacy', label: 'Generate (Legacy)' },
      { value: 'streamLegacy', label: 'Stream (Legacy)' },
    ],
  },
};

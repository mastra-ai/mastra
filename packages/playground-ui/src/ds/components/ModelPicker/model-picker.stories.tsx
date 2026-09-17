import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { models, packs } from '../../../../.storybook/fixtures/chat/controls/models';
import { StudioModelControls } from '../../../../.storybook/fixtures/chat/controls/studio-model-controls';
import { ModelPicker } from './model-picker';

const meta = {
  title: 'Inputs/Model picker',
  component: ModelPicker,
  args: { value: 'openai/gpt-4.1', label: 'GPT-4.1', models, onValueChange: fn() },
  parameters: {
    docs: {
      description: {
        component:
          'Shared model selection presentation. Applications own provider filtering, model packs, optimistic selection, persistence and errors. The combined menu and segmented controls preserve the two production presentations.',
      },
    },
  },
} satisfies Meta<typeof ModelPicker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Combined: Story = {};
export const WithPacks: Story = {
  args: {
    packs: {
      options: packs,
      selectedId: 'balanced',
      defaultId: 'balanced',
      onSelect: fn(),
      onReset: fn(),
      onManage: fn(),
    },
    footer: 'Model choices apply to Build mode only. Packs set all three modes.',
  },
};
export const Loading: Story = { args: { loading: true } };
export const Unavailable: Story = { args: { error: 'The model catalog could not be loaded.' } };
export const Busy: Story = { args: { busy: true } };
export const NotConfigured: Story = { args: { notConfigured: true } };
export const ReadOnly: Story = { args: { readOnly: true } };
export const NoModels: Story = { args: { models: [], value: undefined, label: 'No model' } };
export const LongName: Story = {
  args: { label: 'A provider with a very long model identifier for a narrow composer' },
};
export const Segmented: Story = { render: () => <StudioModelControls state="ready" /> };
export const Locked: Story = { render: () => <StudioModelControls state="locked" /> };

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { FactoryModelControls } from '../../../../.storybook/fixtures/model-picker/factory-model-controls';
import { models } from '../../../../.storybook/fixtures/model-picker/models';
import { StudioModelControls } from '../../../../.storybook/fixtures/model-picker/studio-model-controls';
import { ModelPicker, ModelPickerTrigger, ModelPickerContent } from './model-picker';
import { ModelPickerModels } from './model-picker-models';
import { ModelPickerLoading, ModelPickerUnavailable, ModelPickerReadOnly } from './model-picker-status';

const meta = {
  title: 'Inputs/Model picker',
  component: ModelPicker,
  args: { children: undefined },
  parameters: {
    docs: {
      description: {
        component:
          'Compose a trigger, model choices and optional pack choices/actions inside ModelPicker. Studio composes provider and model comboboxes instead. Applications own catalogs, filtering, optimistic selection and persistence; the menu only owns opening, search and dismissal.',
      },
    },
  },
} satisfies Meta<typeof ModelPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

function CombinedPicker({
  busy = false,
  notConfigured = false,
  label,
  empty = false,
}: {
  busy?: boolean;
  notConfigured?: boolean;
  label?: string;
  empty?: boolean;
}) {
  const [modelId, setModelId] = useState('openai/gpt-4.1');
  const selectedModel = models.find(model => model.id === modelId);
  return (
    <ModelPicker busy={busy}>
      <ModelPickerTrigger label={label ?? selectedModel?.modelName ?? modelId} notConfigured={notConfigured} />
      <ModelPickerContent>
        <ModelPickerModels options={empty ? [] : models} value={modelId} onValueChange={setModelId} />
      </ModelPickerContent>
    </ModelPicker>
  );
}

function PersonalPicker() {
  const [mode, setMode] = useState('build');
  return <FactoryModelControls personal mode={mode} onModeChange={setMode} state="ready" />;
}

export const Combined: Story = {
  render: () => <CombinedPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Session model' }));
    await userEvent.type(screen.getByRole('combobox'), 'sonnet');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(canvas.getByRole('button', { name: 'Session model' })).toHaveTextContent('Claude Sonnet 4.5');
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  },
};
export const WithPacks: Story = { render: () => <PersonalPicker /> };
export const Loading: Story = { render: () => <ModelPickerLoading /> };
export const Unavailable: Story = {
  render: () => <ModelPickerUnavailable error="The model catalog could not be loaded." />,
};
export const Busy: Story = { render: () => <CombinedPicker busy /> };
export const NotConfigured: Story = { render: () => <CombinedPicker notConfigured /> };
export const ReadOnly: Story = { render: () => <ModelPickerReadOnly value={'openai/gpt-4.1'} label="GPT-4.1" /> };
export const NoModels: Story = { render: () => <CombinedPicker empty label="No model" /> };
export const LongName: Story = {
  render: () => <CombinedPicker label="A provider with a very long model identifier for a narrow composer" />,
};
export const Segmented: Story = { render: () => <StudioModelControls state="ready" /> };
export const Locked: Story = { render: () => <StudioModelControls state="locked" /> };

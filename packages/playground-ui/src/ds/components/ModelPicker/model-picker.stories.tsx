import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { CombinedPicker, PickerWithPacks } from '../../../../.storybook/fixtures/model-picker/combined-picker';
import { SegmentedPicker } from '../../../../.storybook/fixtures/model-picker/segmented-picker';
import { ModelPicker } from './model-picker';
import { ModelPickerLocked, ModelPickerWarning, ModelPickerWarnings, ModelProviderIcon } from './model-picker-group';
import { ModelPickerLoading, ModelPickerUnavailable, ModelPickerReadOnly } from './model-picker-status';
import { OpenAIIcon } from '@/ds/icons/OpenAIIcon';

const meta = {
  title: 'Inputs/Model picker',
  component: ModelPicker,
  args: { children: undefined },
  parameters: {
    docs: {
      description: {
        component:
          'Compose a trigger, model choices and optional pack choices/actions inside ModelPicker. Provider and model comboboxes can also be composed as segments. Applications own catalogs, filtering, optimistic selection and persistence; the menu only owns opening, search and dismissal.',
      },
    },
  },
} satisfies Meta<typeof ModelPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Combined: Story = {
  render: () => <CombinedPicker />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const screen = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole('button', { name: 'Session model, GPT-4.1' }));
    await userEvent.type(screen.getByRole('combobox'), 'sonnet');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(canvas.getByRole('button', { name: 'Session model, Claude Sonnet 4.5' })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  },
};
export const Loading: Story = {
  render: () => <ModelPickerLoading />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Loading model' })).toBeVisible();
  },
};
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

export const Segmented: Story = {
  render: () => <SegmentedPicker />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('combobox', { name: 'Provider' }));
    await userEvent.click(await page.findByRole('option', { name: 'Connected Anthropic' }));
    await expect(page.getByRole('combobox', { name: 'Model' })).toHaveTextContent('Select model…');
    await userEvent.click(page.getByRole('combobox', { name: 'Model' }));
    await userEvent.click(await page.findByRole('option', { name: 'Claude Sonnet 4.5' }));
    await expect(page.getByRole('combobox', { name: 'Model' })).toHaveTextContent('Claude Sonnet 4.5');
  },
};
export const SegmentedDisabled: Story = { render: () => <SegmentedPicker disabled /> };
export const Locked: Story = { render: () => <ModelPickerLocked label="openai/gpt-4.1" /> };
export const Warnings: Story = {
  render: () => (
    <ModelPickerWarnings>
      <ModelPickerWarning role="alert">This model is unavailable. Choose another model.</ModelPickerWarning>
      <ModelPickerWarning>Connect the provider to use this model.</ModelPickerWarning>
    </ModelPickerWarnings>
  ),
};
export const ProviderConnection: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <ModelProviderIcon connected>
        <OpenAIIcon />
      </ModelProviderIcon>
      <ModelProviderIcon connected={false}>
        <OpenAIIcon />
      </ModelProviderIcon>
    </div>
  ),
};
export const WithPacksAndActions: Story = {
  render: () => <PickerWithPacks />,
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('button', { name: 'Session model, Balanced' }));
    await waitFor(() => expect(page.getByText('Choose a model or a group of models.')).toBeVisible());
    await userEvent.click(await page.findByRole('option', { name: 'Model pack Review' }));
    await userEvent.click(page.getByRole('button', { name: 'Session model, Review' }));
    await userEvent.click(await page.findByRole('option', { name: 'Reset selection' }));
    await expect(page.getByRole('button', { name: 'Session model, Balanced' })).toBeVisible();
  },
};

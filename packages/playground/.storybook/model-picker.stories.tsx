import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ComposerModelWarnings } from '../src/domains/agents/components/composer-model-warnings';
import { StudioModelExample } from './fixtures/studio-model-controls';
const meta = { title: 'Applications/Studio/Model picker' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Segmented: Story = { render: () => <StudioModelExample state="ready" /> };
export const Locked: Story = { render: () => <StudioModelExample state="locked" /> };

export const Warnings: Story = {
  render: () => (
    <>
      <ComposerModelWarnings warning={['The model is unavailable.', 'Choose another model.']} />
      <ComposerModelWarnings warning={[]} staleModel="openai/gpt-4.1" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const alerts = within(canvasElement).getAllByRole('alert');
    await expect(alerts[0]).toHaveTextContent('The model is unavailable. Choose another model.');
    await expect(alerts[1]).toHaveTextContent('openai/gpt-4.1 is no longer allowed by admin policy.');
  },
};

export const UnconfiguredProvider: Story = {
  render: () => <StudioModelExample state="unconfigured" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const screen = within(canvasElement.ownerDocument.body);
    await expect(canvas.getByText('OPENAI_API_KEY')).toBeVisible();
    await userEvent.click(canvas.getByRole('combobox', { name: 'Provider' }));
    await waitFor(() => expect(screen.getByRole('option', { name: 'Not connected OpenAI' })).toBeVisible());
    await userEvent.click(await screen.findByRole('option', { name: 'Connected Anthropic' }));
    await expect(canvas.queryByText('OPENAI_API_KEY')).not.toBeInTheDocument();
  },
};

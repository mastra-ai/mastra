import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ChatConversation } from '../../../../.storybook/fixtures/chat/conversation';

const meta = {
  title: 'AI/Chat',
  component: ChatConversation,
  args: { scenario: 'complete' },
  argTypes: {
    scenario: {
      control: 'select',
      options: ['complete', 'empty', 'streaming', 'stopped', 'question', 'approval', 'declined', 'error', 'long'],
    },
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A complete conversation assembled from playground-ui components: ChatShell, message renderers, grouped tools, plan, edit, question, approvals, tasks, timeline, attachments, and Composer. Send a message or attach a local file; a deterministic fixture produces incoming chunks, and useRevealedParts paces the displayed text just as in Studio and Factory. Reset restores the selected scenario. This is the shared UI reference; transport, persistence, model selection, and application-specific message wrappers remain owned by Studio and Factory.',
      },
    },
  },
} satisfies Meta<typeof ChatConversation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Conversation: Story = {};
export const Empty: Story = { args: { scenario: 'empty' } };
export const Streaming: Story = { args: { scenario: 'streaming' } };
export const Stopped: Story = { args: { scenario: 'stopped' } };
export const AwaitingAnswer: Story = { args: { scenario: 'question' } };
export const AwaitingApproval: Story = { args: { scenario: 'approval' } };
export const Declined: Story = { args: { scenario: 'declined' } };
export const Error: Story = { args: { scenario: 'error' } };
export const LongConversation: Story = { args: { scenario: 'long' } };

export const ReviewAndApprove: Story = {
  args: { scenario: 'question' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(within(canvas.getByRole('group', { name: 'Tool group: 3 steps' })).getByRole('button'));
    await userEvent.click(within(await canvas.findByRole('group', { name: 'Tool: read_file' })).getByRole('button'));
    await waitFor(() => expect(canvas.getByText('Enter currently adds a newline.')).toBeVisible());
    await userEvent.click(canvas.getByRole('radio', { name: /Keyboard access/ }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(canvas.getByText('The conversation is ready for another review.')).toBeVisible(), {
      timeout: 8000,
    });
    await expect(canvas.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  },
};

export const DeclineEdit: Story = {
  args: { scenario: 'approval' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(canvas.getByText(/The edit was declined/)).toBeVisible());
    await expect(canvas.queryByRole('button', { name: 'Stop response' })).not.toBeInTheDocument();
  },
};

export const SendAttachmentsAndStop: Story = {
  args: { scenario: 'empty' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByLabelText('Attach files'), [
      new File(['Review the draft.'], 'draft.txt', { type: 'text/plain' }),
      new File(['Remove this one.'], 'discard.txt', { type: 'text/plain' }),
    ]);
    await canvas.findByRole('button', { name: 'Preview draft.txt' });
    await userEvent.click(canvas.getByRole('button', { name: 'Remove discard.txt' }));
    const input = canvas.getByRole('textbox', { name: 'Message' });
    await userEvent.type(input, 'Review this draft.{shift>}{enter}{/shift}Keep both lines.');
    await expect(input).toHaveValue('Review this draft.\nKeep both lines.');
    await userEvent.keyboard('{enter}');
    await expect(input).toHaveValue('');
    await expect(canvas.getAllByRole('region', { name: /^Turn / })).toHaveLength(1);
    await expect(canvas.queryByRole('region', { name: 'Draft attachments' })).not.toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Preview draft.txt' })).toBeInTheDocument();
    await expect(canvas.queryByText('discard.txt')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(canvas.getByRole('region', { name: 'Turn 1' })).toHaveTextContent(/The composer now keeps attachments/),
    );
    await userEvent.click(await canvas.findByRole('button', { name: 'Stop response' }));
    await expect(input).toHaveFocus();
    await expect(canvas.getByText('Response stopped')).toBeVisible();
    await userEvent.type(input, 'Continue.{enter}');
    await expect(canvas.getAllByRole('region', { name: /^Turn / })).toHaveLength(2);
    await waitFor(() => expect(canvas.getByText('The conversation is ready for another review.')).toBeVisible(), {
      timeout: 8000,
    });
  },
};

export const RetryResponse: Story = {
  args: { scenario: 'error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Retry response' }));
    await waitFor(() => expect(canvas.getByText('The conversation is ready for another review.')).toBeVisible(), {
      timeout: 8000,
    });
    await expect(canvas.getAllByRole('region', { name: /^Turn / })).toHaveLength(1);
    await expect(canvas.queryByRole('button', { name: 'Retry response' })).not.toBeInTheDocument();
  },
};

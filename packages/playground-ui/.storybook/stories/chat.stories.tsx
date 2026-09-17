import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ComposerWithModelMenu, ConversationComposer } from '../fixtures/chat/composer';
import { ChatConversation } from '../fixtures/chat/conversation';
import type { Scenario } from '../fixtures/chat/data';
import { SegmentedPicker } from '../fixtures/model-picker/segmented-picker';

interface ChatStoryArgs {
  scenario: Scenario;
}

const meta = {
  title: 'AI/Chat',
  render: ({ scenario }) => (
    <ChatConversation scenario={scenario}>{controls => <ComposerWithModelMenu {...controls} />}</ChatConversation>
  ),
  args: { scenario: 'complete' },
  argTypes: {
    scenario: {
      control: 'select',
      options: [
        'complete',
        'empty',
        'streaming',
        'stopped',
        'question',
        'approval',
        'declined',
        'error',
        'tool-error',
        'long',
      ],
    },
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'A complete conversation composed only from Playground UI: ChatShell, messages and attachments, reasoning, grouped tools, edits, plan, questions, approvals, activity rows, tasks, timeline and composer. The composer includes shared mode and model controls. The segmented-picker example supplies different controls to the same action area. These are component compositions, not replicas of Studio or Factory. Drafts, selection, file reading and reply playback are local story fixtures; no application contexts, voice, settings, permissions, requests or persistence are loaded. Sending, stopping, retrying, answering and approving are interactive. Streaming snapshots stay running for design review; sending or approving plays incoming chunks. Reset restores the selected conversation scenario. Individual component stories cover their additional variants and states.',
      },
    },
  },
} satisfies Meta<ChatStoryArgs>;
export default meta;
type Story = StoryObj<typeof meta>;

async function expandReviewTools(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await userEvent.click(within(canvas.getByRole('group', { name: /^Tool group:/ })).getByRole('button'));
  await expect(await canvas.findByRole('group', { name: 'Tool: read_file' })).toBeVisible();
}

const verifyStreamingCommand: Story['play'] = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  await expandReviewTools(canvasElement);
  const command = canvas.getByRole('group', { name: 'Tool: execute_command' });
  await expect(command).toHaveAttribute('aria-busy', 'true');
  await expect(canvas.queryByText('6 tests passed.')).not.toBeInTheDocument();
};

export const Conversation: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandReviewTools(canvasElement);
    const command = canvas.getByRole('group', { name: 'Tool: execute_command' });
    await userEvent.click(within(command).getByRole('button'));
    await expect(await canvas.findByText('6 tests passed.')).toBeVisible();
  },
};
export const WithSegmentedPicker: Story = {
  render: ({ scenario }) => (
    <ChatConversation scenario={scenario}>
      {controls => (
        <ConversationComposer {...controls} appearance="round">
          <SegmentedPicker />
        </ConversationComposer>
      )}
    </ChatConversation>
  ),
};
export const Light: Story = { globals: { backgrounds: { value: 'light' } } };
export const Empty: Story = { args: { scenario: 'empty' } };
export const Streaming: Story = { args: { scenario: 'streaming' }, play: verifyStreamingCommand };
export const Stopped: Story = { args: { scenario: 'stopped' } };
export const AwaitingAnswer: Story = { args: { scenario: 'question' } };
export const AwaitingApproval: Story = { args: { scenario: 'approval' } };
export const Declined: Story = { args: { scenario: 'declined' } };
export const ToolFailed: Story = {
  args: { scenario: 'tool-error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandReviewTools(canvasElement);
    const command = canvas.getByRole('group', { name: 'Tool: execute_command' });
    await expect(command).toHaveAttribute('aria-invalid', 'true');
    await expect(
      await canvas.findByText('Keyboard test failed: expected focus to return to the composer.'),
    ).toBeVisible();
    await expect(canvas.queryByText('6 tests passed.')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Retry tool' }));
    await waitFor(() => expect(canvas.getByText('The conversation is ready for another review.')).toBeVisible(), {
      timeout: 8000,
    });
    await expect(canvas.getByRole('group', { name: 'Tool: execute_command' })).toHaveAttribute('aria-busy', 'false');
  },
};
export const Error: Story = { args: { scenario: 'error' } };
export const LongConversation: Story = { args: { scenario: 'long' } };

export const SlashCommands: Story = {
  args: { scenario: 'empty' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Message' });
    await userEvent.type(input, '/');
    await expect(await canvas.findByRole('listbox', { name: 'Slash commands' })).toBeVisible();
    await userEvent.type(input, 'rev');
    await userEvent.keyboard('{Tab}');
    await expect(input).toHaveValue('/review ');
    await expect(await canvas.findByRole('listbox', { name: '/review options' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    await expect(input).toHaveValue('/review');
    await userEvent.keyboard('{Enter}{ArrowDown}{Enter}');
    await expect(input).toHaveValue('');
    await expect(input).toHaveFocus();
    await expect(canvas.getByRole('region', { name: 'Turn 1' })).toHaveTextContent('/review attachments');
    await expect(canvas.getByRole('button', { name: 'Stop response' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Stop response' }));
    await expect(input).toHaveFocus();
  },
};

export const ReviewAndApprove: Story = {
  args: { scenario: 'question' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expandReviewTools(canvasElement);
    await userEvent.click(within(await canvas.findByRole('group', { name: 'Tool: read_file' })).getByRole('button'));
    await waitFor(() => expect(canvas.getByText('Enter currently adds a newline.')).toBeVisible());
    await userEvent.click(canvas.getByRole('radio', { name: /Keyboard access/ }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Approve edit_file' }));
    await waitFor(() => expect(canvas.getByText('The conversation is ready for another review.')).toBeVisible(), {
      timeout: 8000,
    });
    await expect(canvas.queryByRole('button', { name: 'Approve edit_file' })).not.toBeInTheDocument();
  },
};

export const DeclineEdit: Story = {
  args: { scenario: 'approval' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Decline edit_file' }));
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
    await expect(canvas.getByRole('status')).toHaveTextContent('Response stopped');
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

export const EventsAndApproval: Story = {
  args: { scenario: 'approval' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notification = within(canvas.getByRole('group', { name: 'Notification: board' }));
    const trigger = notification.getByRole('button');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const skill = within(canvas.getByRole('group', { name: 'Skill: implementation-review' }));
    await userEvent.click(skill.getByRole('button'));
    await expect(await skill.findByText('Implement the approved plan.')).toBeVisible();
    const approval = within(canvas.getByRole('group', { name: 'Tool approval for edit_file' }));
    await userEvent.click(approval.getByRole('button', { name: 'Approve edit_file' }));
    await waitFor(() => expect(canvas.getByText('The conversation is ready for another review.')).toBeVisible(), {
      timeout: 8000,
    });
    const github = within(canvas.getByRole('group', { name: 'Notification: github' }));
    await userEvent.click(github.getByRole('button'));
    await expect(await github.findByRole('link')).toHaveAttribute(
      'href',
      'https://github.com/mastra-ai/mastra/pull/24263',
    );
  },
};

export const ModelSelection: Story = {
  args: { scenario: 'empty' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('button', { name: 'Session model, GPT-4.1' }));
    await userEvent.click(await page.findByRole('option', { name: 'Claude Sonnet 4.5' }));
    await expect(page.getByRole('button', { name: 'Session model, Claude Sonnet 4.5' })).toBeVisible();
  },
};

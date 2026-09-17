import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { ChatConversation } from '../../../../.storybook/fixtures/chat/conversation';

const meta = {
  title: 'AI/Chat',
  component: ChatConversation,
  args: {
    scenario: 'complete',
    presentation: 'studio',
    tone: 'green',
    factorySession: 'work-item',
    modelState: 'ready',
    canSendWhileStreaming: false,
  },
  argTypes: {
    presentation: { control: 'inline-radio', options: ['studio', 'factory'] },
    tone: { control: 'select', options: ['green', 'purple', 'orange', 'default'] },
    factorySession: { control: 'inline-radio', options: ['work-item', 'personal'] },
    modelState: { control: 'select', options: ['ready', 'loading', 'unconfigured', 'locked'] },
    canSendWhileStreaming: { control: 'boolean' },
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
          'A design workbench using the same playground-ui components as Studio and Factory. Choose the presentation and scenario in Controls. Both include the production Message envelope, attachments, reasoning, grouped tools, edits, plan, question, approvals, tasks, timeline and composer. Studio shows signal cards and notification metadata; Factory shows lane-change notifications, phase signals, skill activation, reminders, time gaps and GitHub links. Factory tool rows include timestamps and command lines; Studio keeps argument data. Approvals use the corresponding inline or standalone presentation. Sending, stopping, retrying, answering and approving run locally against deterministic fixtures. The composer uses the production model picker presentations, settings including advanced fields, attachment menu, dictation and voice controls. Factory personal sessions also expose modes and model packs. Selection and voice state are local fixtures; no model request, microphone capture, audio connection or settings navigation is performed. Dataset actions, browser sessions, request-context/tracing controls and Factory runtime status indicators are not yet included; see the coverage document beside this story. Component stories cover additional states. Streaming snapshots stay running for design review; sending a message or approving an edit plays incoming chunks. Reset restores the selected scenario.',
      },
    },
  },
} satisfies Meta<typeof ChatConversation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Conversation: Story = {};
export const Studio: Story = {};
export const Factory: Story = { args: { presentation: 'factory' } };
export const FactoryAwaitingApproval: Story = { args: { presentation: 'factory', scenario: 'approval' } };
export const FactoryStreaming: Story = { args: { presentation: 'factory', scenario: 'streaming' } };
export const FactoryLongConversation: Story = { args: { presentation: 'factory', scenario: 'long' } };
export const FactoryLight: Story = { args: { presentation: 'factory' }, globals: { backgrounds: { value: 'light' } } };
export const Empty: Story = { args: { scenario: 'empty' } };
export const Streaming: Story = { args: { scenario: 'streaming' } };
export const Stopped: Story = { args: { scenario: 'stopped' } };
export const AwaitingAnswer: Story = { args: { scenario: 'question' } };
export const AwaitingApproval: Story = { args: { scenario: 'approval' } };
export const Declined: Story = { args: { scenario: 'declined' } };
export const ToolFailed: Story = { args: { scenario: 'tool-error' } };
export const Error: Story = { args: { scenario: 'error' } };
export const LongConversation: Story = { args: { scenario: 'long' } };

export const SlashCommands: Story = {
  args: { scenario: 'empty', presentation: 'factory' },
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
    await userEvent.click(within(canvas.getByRole('group', { name: 'Tool group: 3 steps' })).getByRole('button'));
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

export const FactoryEventsAndApproval: Story = {
  args: { presentation: 'factory', scenario: 'approval' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const notification = within(canvas.getByRole('group', { name: 'Notification: factory' }));
    const trigger = notification.getByRole('button');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    const skill = within(canvas.getByRole('group', { name: 'Skill: factory-build' }));
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

export const StudioModelLocked: Story = { args: { modelState: 'locked' } };
export const StudioProviderUnconfigured: Story = { args: { modelState: 'unconfigured' } };
export const StudioInterjection: Story = { args: { scenario: 'streaming', canSendWhileStreaming: true } };
export const FactoryPersonalSession: Story = {
  args: { presentation: 'factory', factorySession: 'personal', scenario: 'empty' },
};
export const FactoryModelLoading: Story = { args: { presentation: 'factory', modelState: 'loading' } };
export const FactoryModelUnconfigured: Story = { args: { presentation: 'factory', modelState: 'unconfigured' } };

export const StudioModelSelection: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('combobox', { name: 'Provider' }));
    await userEvent.click(await page.findByRole('option', { name: 'Anthropic' }));
    await userEvent.click(await page.findByRole('option', { name: 'claude-sonnet-4-5' }));
    await expect(page.getByRole('combobox', { name: 'Model' })).toHaveTextContent('claude-sonnet-4-5');
    await userEvent.click(page.getByRole('button', { name: 'Model settings' }));
    await userEvent.click(await page.findByRole('radio', { name: 'Generate' }));
    await userEvent.click(page.getByRole('button', { name: 'Advanced Settings' }));
    const dialog = within(await page.findByRole('dialog', { name: 'Advanced model settings' }));
    await userEvent.type(dialog.getByRole('spinbutton', { name: 'Max Tokens' }), '2048');
    await expect(dialog.getByRole('spinbutton', { name: 'Max Tokens' })).toHaveValue(2048);
  },
};

export const FactoryModelSelection: Story = {
  args: { presentation: 'factory', factorySession: 'personal', scenario: 'empty' },
  play: async ({ canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(page.getByRole('button', { name: 'Session model' }));
    await userEvent.click(await page.findByRole('option', { name: 'Model pack Review' }));
    await expect(page.getByRole('button', { name: 'Session model' })).toHaveTextContent('Claude Sonnet 4.5');
    await userEvent.click(page.getByRole('button', { name: 'Session model' }));
    await userEvent.click(await page.findByRole('option', { name: 'Reset to default pack' }));
    await expect(page.getByRole('button', { name: 'Session model' })).toHaveTextContent('GPT-4.1');
  },
};

export const StudioVoiceControls: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Start voice call' }));
    await expect(canvas.getByTestId('voice-call-panel')).toHaveTextContent('Listening…');
    await userEvent.click(canvas.getByRole('button', { name: 'End voice call' }));
    await expect(canvas.queryByTestId('voice-call-panel')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Start dictation' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Stop dictation' }));
    await expect(canvas.getByRole('textbox', { name: 'Message' })).toHaveValue('Review the composer keyboard access.');
  },
};

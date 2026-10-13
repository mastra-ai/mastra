import type { Meta, StoryObj } from '@storybook/react-vite';
import { AudioLinesIcon, FocusIcon, StopCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { Message, MessageActions, MessageMetadata } from './message';
import { MessageCopyButton } from './message-copy-button';
import { MessageTimestamp } from './message-timestamp';

const question = 'Can you review the keyboard behavior before we ship this change?';
const answer =
  'The draft stays in place when a request fails.\n\n- **Enter** sends the message.\n- **Shift + Enter** adds a line.\n- Focus returns to the composer after sending.';
const longText =
  'Please check https://example.com/' +
  'long-path-segment/'.repeat(12) +
  '\n\n```ts\nconst result = await agent.generate("Keep this code block scrollable inside the message bubble.");\n```';
const createdAt = '2026-09-16T10:00:00.000Z';

const meta: Meta<typeof Message> = {
  title: 'Elements/Message',
  component: Message,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Shared user/assistant message shell, actions, metadata, copy, and timestamp. The shell owns bubble appearance, width, spacing, and pending borders. Applications supply rendered parts, optional avatars, and footer content. MessageActions defaults to hover/focus visibility and stays visible on touch devices; use visibility="always" for persistent controls. Applications decide what text to copy and when a reply is complete. The previews mirror Factory and Studio footer arrangements without a chat provider or transport.',
      },
    },
  },
  decorators: [
    Story => (
      <div className="mx-auto max-w-3xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Message>;

export const Factory: Story = {
  render: () => (
    <>
      <Message
        from="user"
        footer={
          <MessageActions>
            <MessageCopyButton text={question} />
            <MessageTimestamp value={createdAt} />
          </MessageActions>
        }
      >
        <MarkdownRenderer>{question}</MarkdownRenderer>
      </Message>
      <Message
        from="assistant"
        footer={
          <MessageActions>
            <MessageCopyButton text={answer} />
            <MessageTimestamp value={createdAt} />
          </MessageActions>
        }
      >
        <MarkdownRenderer className="my-3">{answer}</MarkdownRenderer>
      </Message>
    </>
  ),
};

function StudioConversation() {
  const [speaking, setSpeaking] = useState(false);
  const [highlighted, setHighlighted] = useState(false);

  return (
    <>
      <Message
        from="user"
        footer={
          <MessageActions>
            <MessageCopyButton text={question} />
          </MessageActions>
        }
      >
        <MarkdownRenderer>{question}</MarkdownRenderer>
      </Message>
      <Message
        from="assistant"
        footer={
          <MessageActions visibility="always">
            <MessageMetadata>openai/gpt-5-mini</MessageMetadata>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={speaking ? 'Stop' : 'Read aloud'}
              tooltip={speaking ? 'Stop' : 'Read aloud'}
              onClick={() => setSpeaking(!speaking)}
            >
              {speaking ? <StopCircleIcon /> : <AudioLinesIcon />}
            </Button>
            <MessageCopyButton text={answer} />
            <MessageActions>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Highlight spans"
                aria-pressed={highlighted}
                tooltip="Highlight spans"
                onClick={() => setHighlighted(!highlighted)}
              >
                <FocusIcon />
              </Button>
            </MessageActions>
          </MessageActions>
        }
      >
        <MarkdownRenderer>{answer}</MarkdownRenderer>
      </Message>
    </>
  );
}

export const Studio: Story = {
  render: () => <StudioConversation />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Read aloud' }));
    await expect(canvas.getByRole('button', { name: 'Stop' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Stop' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Highlight spans' }));
    await expect(canvas.getByRole('button', { name: 'Highlight spans' })).toHaveAttribute('aria-pressed', 'true');
  },
};

export const OtherSender: Story = {
  render: () => (
    <Message
      from="user"
      avatar={<Avatar name="Alex" size="sm" />}
      footer={
        <>
          <MessageMetadata>via Slack · Alex</MessageMetadata>
          <MessageActions>
            <MessageCopyButton text={question} />
            <MessageTimestamp value={createdAt} />
          </MessageActions>
        </>
      }
    >
      <MarkdownRenderer>{question}</MarkdownRenderer>
    </Message>
  ),
};

export const Pending: Story = {
  render: () => (
    <Message from="user" pending footer={<MessageMetadata>Steering…</MessageMetadata>}>
      <MarkdownRenderer>Keep the existing keyboard shortcuts.</MarkdownRenderer>
    </Message>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Message
      from="user"
      footer={
        <MessageActions>
          <MessageCopyButton text={longText} />
        </MessageActions>
      }
    >
      <MarkdownRenderer>{longText}</MarkdownRenderer>
    </Message>
  ),
};

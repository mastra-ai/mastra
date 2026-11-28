import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ChannelThreadStart } from '../transcript/components/ChannelThreadStart';
import { TranscriptSlotsProvider } from '../transcript/components/slots';
import { ToolFactory } from '../transcript/components/ToolFactory';
import { Button } from '@/ds/components/Button';
import { IconArrowRotateCounterClockwise } from '@/ds/icons/central/IconArrowRotateCounterClockwise';
import { IconChainLink3 } from '@/ds/icons/central/IconChainLink3';

function Reply({ posted }: { posted: boolean }) {
  return (
    <ToolFactory
      toolName="reply_in_thread"
      toolCallId="call-1"
      input={{ text: 'Here’s a draft: “Hi Lee, the pilot results are in. Do you have 15 minutes Thursday?”' }}
      output={{ posted }}
      status="done"
      fallback={() => null}
    />
  );
}

const meta = {
  title: 'AI/Channel thread',
  parameters: {
    docs: {
      description: {
        component:
          'A thread that came in from Slack starts with `ChannelThreadStart`. A reply the agent posts back shows where it went; when it fails, the host draws recovery actions through the `ChannelReplyError` transcript slot.',
      },
    },
  },
  decorators: [
    Story => (
      <div className="max-w-170">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const StartMarker: Story = {
  render: () => (
    <ChannelThreadStart
      platform="slack"
      channelName="sales"
      channelUrl="https://slack.com/app_redirect?channel=sales"
      authorName="Charlie"
    />
  ),
};

export const ReplyFailed: Story = {
  render: () => (
    <TranscriptSlotsProvider
      slots={{
        ChannelReplyError: () => (
          <>
            <Button variant="ghost" size="icon-sm" aria-label="Try again" tooltip="Try again">
              <IconArrowRotateCounterClockwise />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Reconnect Slack" tooltip="Reconnect Slack">
              <IconChainLink3 />
            </Button>
          </>
        ),
      }}
    >
      <ChannelThreadStart
        platform="slack"
        channelName="sales"
        channelUrl="https://slack.com/app_redirect?channel=sales"
        authorName="Charlie"
      />
      <Reply posted={false} />
    </TranscriptSlotsProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Error sending to Slack')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  },
};

export const ReplySent: Story = {
  render: () => <Reply posted />,
};

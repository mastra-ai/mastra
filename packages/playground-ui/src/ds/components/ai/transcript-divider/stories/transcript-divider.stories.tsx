import type { Meta, StoryObj } from '@storybook/react-vite';
import { TranscriptDivider } from '../transcript-divider';

const meta = {
  title: 'AI/Transcript divider',
  component: TranscriptDivider,
  args: { label: '24 minutes later', title: 'Sep 17, 2026, 2:24 PM' },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          'A rule across the transcript marking a boundary between two events. It is a `separator`, not a chat event: nothing folds, nothing is interactive, and it carries a label rather than a message.\n\nFactory renders one for the silence between turns. The elapsed time is the label; the timestamp goes in `title`, so the line stays readable and the full stamp is still there on hover. An empty label renders nothing, because a signal with no text must not leave a bare rule behind.\n\nSee it in a transcript in AI/Chat event → FactoryTranscript.',
      },
    },
  },
} satisfies Meta<typeof TranscriptDivider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TimeGap: Story = {};

export const WithoutTimestamp: Story = { args: { title: undefined, label: 'Earlier today' } };

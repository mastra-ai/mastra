import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatTimeGap } from '../chat-time-gap';

const meta = {
  title: 'AI/Chat events/Time gap',
  component: ChatTimeGap,
  args: { text: '24 minutes later — Sep 17, 2026, 2:24 PM' },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChatTimeGap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTimestamp: Story = {};
export const WithoutTimestamp: Story = { args: { text: '2 days later' } };

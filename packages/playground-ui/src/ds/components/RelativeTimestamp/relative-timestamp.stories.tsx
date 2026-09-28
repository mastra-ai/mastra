import type { Meta, StoryObj } from '@storybook/react-vite';
import { RelativeTimestamp } from './relative-timestamp';

const meta: Meta<typeof RelativeTimestamp> = {
  title: 'Elements/RelativeTimestamp',
  component: RelativeTimestamp,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof RelativeTimestamp>;

const minutesAgo = (minutes: number) => Date.now() - minutes * 60_000;

export const Default: Story = {
  args: {
    value: minutesAgo(3),
  },
};

export const Scale: Story = {
  render: () => (
    <div className="flex gap-6 text-body-sm">
      {[0.5, 3, 90, 60 * 26, 60 * 24 * 9, 60 * 24 * 400, -5].map(minutes => (
        <RelativeTimestamp key={minutes} value={minutesAgo(minutes)} />
      ))}
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from '../EmptyState';
import { Spinner } from '../Spinner';
import { RotatingText } from './rotating-text';

const meta: Meta<typeof RotatingText> = {
  title: 'Elements/RotatingText',
  component: RotatingText,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof RotatingText>;

const messages = ['Calling your target…', 'Working through the items…', 'Consulting the scorers…'];

export const Default: Story = {
  args: {
    messages,
    intervalMs: 1500,
  },
};

export const InEmptyState: Story = {
  render: () => (
    <EmptyState
      iconSlot={<Spinner />}
      titleSlot="Experiment in progress"
      descriptionSlot={<RotatingText messages={messages} intervalMs={1500} />}
    />
  ),
};

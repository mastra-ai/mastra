import type { Meta, StoryObj } from '@storybook/react-vite';
import { Txt } from '../Txt';
import { DiffStat } from './diff-stat';

const meta: Meta<typeof DiffStat> = {
  title: 'Elements/DiffStat',
  component: DiffStat,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof DiffStat>;

export const Default: Story = {
  args: { additions: 12, deletions: 3 },
};

export const InheritsTypography: Story = {
  args: { additions: 1284, deletions: 0 },
  render: args => (
    <Txt as="span" variant="meta" font="mono">
      <DiffStat {...args} />
    </Txt>
  ),
};

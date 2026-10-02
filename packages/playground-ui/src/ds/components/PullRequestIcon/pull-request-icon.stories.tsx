import type { Meta, StoryObj } from '@storybook/react-vite';
import { PullRequestIcon } from './pull-request-icon';

const meta = {
  title: 'Icons/Pull request',
  component: PullRequestIcon,
  args: { status: 'open', 'aria-label': 'Pull request', role: 'img' },
  argTypes: { status: { control: 'select', options: ['draft', 'open', 'closed', 'merged'] } },
} satisfies Meta<typeof PullRequestIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Draft: Story = { args: { status: 'draft' } };
export const Closed: Story = { args: { status: 'closed' } };
export const Merged: Story = { args: { status: 'merged' } };
export const MergedLight: Story = { args: { status: 'merged' }, globals: { backgrounds: { value: 'light' } } };

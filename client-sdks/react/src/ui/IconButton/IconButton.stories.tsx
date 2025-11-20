import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconButton } from './IconButton';
import { AgentIcon } from '../Icons/AgentIcon';

const Component = () => {
  return (
    <IconButton tooltip="Tooltip">
      <AgentIcon />
    </IconButton>
  );
};

const meta = {
  title: 'Components/IconButton',
  component: Component,
  parameters: {},
  tags: ['autodocs'],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

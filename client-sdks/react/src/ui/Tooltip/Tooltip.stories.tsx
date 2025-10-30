import type { Meta, StoryObj } from '@storybook/react-vite';

import { Tooltip, TooltipContent, TooltipTrigger } from './Tooltip';

const Component = () => {
  return (
    <Tooltip>
      <TooltipTrigger>
        <button>Hello world</button>
      </TooltipTrigger>
      <TooltipContent>Hello world</TooltipContent>
    </Tooltip>
  );
};

const meta = {
  title: 'Components/Tooltip',
  component: Component,
  parameters: {},
  tags: ['autodocs'],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

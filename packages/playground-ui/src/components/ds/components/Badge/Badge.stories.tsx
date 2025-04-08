import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { ToolsIcon } from '../../icons/ToolsIcon';

import { Badge } from './Badge';

const Example = () => {
  return (
    <div className="flex flex-row gap-4">
      <Badge>Default</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
      <Badge icon={<ToolsIcon />}>Default</Badge>
      <Badge icon={<ToolsIcon />} variant="success">
        Success
      </Badge>
      <Badge icon={<ToolsIcon />} variant="error">
        Error
      </Badge>
      <Badge icon={<ToolsIcon />} variant="info">
        Info
      </Badge>
    </div>
  );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Primitives/Badge',
  component: Example,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {},

  args: {},
} satisfies Meta<typeof Example>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const All: Story = {
  args: {
    primary: true,
    label: 'Badge',
  },
};

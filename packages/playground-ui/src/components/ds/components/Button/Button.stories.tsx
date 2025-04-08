import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { ApiIcon } from '../../icons/ApiIcon';
import { Icon } from '../../icons/Icon';

import { Button } from './Button';

const Example = () => {
  return (
    <div className="space-y-4">
      <div>
        <Button>I m a button</Button>
      </div>
      <div>
        <Button as="a" href="https://www.google.com">
          <Icon>
            <ApiIcon />
          </Icon>
          I m a link
        </Button>
      </div>
    </div>
  );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Primitives/Button',
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
    label: 'Button',
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Button } from '../Button';

import { Breadcrumb, Crumb } from './Breadcrumb';

const Example = () => {
  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-4 py-12">
      <div>
        <Breadcrumb>
          <Crumb as="a" href="/projects">
            Projects
          </Crumb>
          <Crumb as="a" href="/projects/1" isCurrent>
            Project 1
          </Crumb>
        </Breadcrumb>
      </div>
    </div>
  );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Primitives/Breadcrumb',
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
    label: 'Breadcrumb',
  },
};

import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { Txt } from './Txt';

const Example = () => {
  return (
    <div className="flex flex-col gap-4 text-white">
      Default
      <Txt variant="header-md">Header MD</Txt>
      <Txt variant="ui-lg">UI LG</Txt>
      <Txt variant="ui-md">UI MD</Txt>
      <Txt variant="ui-sm">UI SM</Txt>
      <Txt variant="ui-xs">UI XS</Txt>
      Mono
      <Txt variant="header-md" font="mono">
        Header MD
      </Txt>
      <Txt variant="ui-lg" font="mono">
        UI LG
      </Txt>
      <Txt variant="ui-md" font="mono">
        UI MD
      </Txt>
      <Txt variant="ui-sm" font="mono">
        UI SM
      </Txt>
      <Txt variant="ui-xs" font="mono">
        UI XS
      </Txt>
    </div>
  );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Primitives/Txt',
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
    label: 'Txt',
  },
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '../Button';
import { Shimmer } from './shimmer';

const meta: Meta<typeof Shimmer> = {
  title: 'Motion/Shimmer',
  component: Shimmer,
  parameters: { layout: 'centered' },
  args: {
    active: true,
    children: 'Drafting a response from the available context',
  },
};

export default meta;
type Story = StoryObj<typeof Shimmer>;

export const Default: Story = {};

function StreamingPreview() {
  const [active, setActive] = useState(true);

  return (
    <div className="flex w-120 flex-col items-start gap-4">
      <Shimmer active={active} className="text-ui-md text-neutral5">
        The assistant keeps the same text node while streaming settles.
      </Shimmer>
      <Button onClick={() => setActive(current => !current)}>{active ? 'Finish streaming' : 'Resume streaming'}</Button>
    </div>
  );
}

export const ActiveToSettled: Story = {
  render: () => <StreamingPreview />,
};

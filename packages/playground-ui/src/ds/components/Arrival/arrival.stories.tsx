import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '../Button';
import { ArrivalScope, Arriving } from './arrival';

const meta: Meta<typeof ArrivalScope> = {
  title: 'Motion/Arrival',
  component: ArrivalScope,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ArrivalScope>;

function ArrivalDemo() {
  const [items, setItems] = useState(['Restored conversation', 'Existing tool result']);

  return (
    <div className="flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-4">
      <ArrivalScope>
        <div className="flex flex-col gap-2">
          {items.map(item => (
            <Arriving
              key={item}
              className="border-border1 bg-surface2 text-ui-sm text-neutral5 rounded-lg border px-4 py-3"
            >
              {item}
            </Arriving>
          ))}
        </div>
      </ArrivalScope>
      <Button
        onClick={() => setItems(current => [...current, `New streamed item ${current.length - 1}`])}
        disabled={items.length >= 5}
      >
        Add streamed item
      </Button>
    </div>
  );
}

export const ExistingAndNewContent: Story = {
  render: () => <ArrivalDemo />,
};

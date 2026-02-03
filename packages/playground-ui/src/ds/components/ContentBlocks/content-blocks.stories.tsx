import type { Meta, StoryObj } from '@storybook/react-vite';

import { ContentBlocks } from './content-blocks';
import { ContentBlock } from './content-block';
import { useState } from 'react';
import { useContentBlock } from './content-blocks.context';

const meta: Meta<typeof ContentBlocks> = {
  title: 'Composite/ContentBlocks',
  component: ContentBlocks,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ContentBlocks>;

const CustomBlock = () => {
  const [item, setItem] = useContentBlock();

  return (
    <div>
      <input type="text" value={item} onChange={e => setItem(e.target.value)} />
    </div>
  );
};

const Components = () => {
  const [items, setItems] = useState<Array<string>>([]);

  const addButton = () => {
    setItems(state => [...state, `item content number ${state.length + 1}`]);
  };

  return (
    <div>
      <ContentBlocks items={items} onChange={setItems}>
        {items.map((item, index) => (
          <ContentBlock index={index} key={index}>
            <CustomBlock />
          </ContentBlock>
        ))}
      </ContentBlocks>

      <button onClick={addButton} style={{ backgroundColor: 'white' }}>
        Add item
      </button>
    </div>
  );
};

export const Default: Story = {
  render: () => <Components />,
};

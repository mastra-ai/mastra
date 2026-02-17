import type { Meta, StoryObj } from '@storybook/react-vite';
import { v4 as uuid } from '@lukeed/uuid';

import { ContentBlocks } from './content-blocks';
import { ContentBlock } from './content-block';
import { useState } from 'react';

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

interface Item {
  id: string;
  content: string;
}

interface CustomBlockProps {
  item: Item;
  onChange: (item: Item) => void;
}

const CustomBlock = ({ item, onChange }: CustomBlockProps) => {
  return (
    <div>
      <input type="text" value={item.content} onChange={e => onChange({ ...item, content: e.target.value })} />
    </div>
  );
};

const Components = () => {
  const [items, setItems] = useState<Array<Item>>([]);

  const addButton = () => {
    setItems(state => [...state, { id: uuid(), content: `item content number ${state.length + 1}` }]);
  };

  const handleItemChange = (index: number, newValue: Item) => {
    setItems(items.map((item, idx) => (idx === index ? newValue : item)));
  };

  return (
    <div>
      <ContentBlocks items={items} onChange={setItems}>
        {items.map((item, index) => (
          <ContentBlock index={index} draggableId={item.id} key={item.id}>
            <CustomBlock item={item} onChange={newValue => handleItemChange(index, newValue)} />
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

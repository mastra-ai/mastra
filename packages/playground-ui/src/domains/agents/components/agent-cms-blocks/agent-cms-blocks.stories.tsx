import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AgentCMSBlocks } from './agent-cms-blocks';
import { TooltipProvider } from '@/ds/components/Tooltip';

const meta: Meta<typeof AgentCMSBlocks> = {
  title: 'Domain/Agents/AgentCMSBlocks',
  component: AgentCMSBlocks,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AgentCMSBlocks>;

const InteractiveExample = () => {
  const [items, setItems] = useState<Array<string>>([
    'You are a helpful assistant that answers questions about programming.',
    'Always be polite and professional in your responses.',
  ]);

  return (
    <div className="w-[500px]">
      <TooltipProvider>
        <AgentCMSBlocks items={items} onChange={setItems} placeholder="Enter content..." />
      </TooltipProvider>

      <div className="mt-4 p-3 bg-surface2 rounded-lg">
        <p className="text-xs text-icon3 mb-2">Current state:</p>
        <pre className="text-xs text-icon5 whitespace-pre-wrap">{JSON.stringify(items, null, 2)}</pre>
      </div>
    </div>
  );
};

export const Default: Story = {
  render: () => <InteractiveExample />,
};

const EmptyExample = () => {
  const [items, setItems] = useState<Array<string>>([]);

  return (
    <div className="w-[500px]">
      <TooltipProvider>
        <AgentCMSBlocks items={items} onChange={setItems} placeholder="Add your first content block..." />
      </TooltipProvider>
    </div>
  );
};

export const Empty: Story = {
  render: () => <EmptyExample />,
};

const SingleBlockExample = () => {
  const [items, setItems] = useState<Array<string>>(['Single content block with some text.']);

  return (
    <div className="w-[500px]">
      <TooltipProvider>
        <AgentCMSBlocks items={items} onChange={setItems} placeholder="Enter content..." />
      </TooltipProvider>
    </div>
  );
};

export const SingleBlock: Story = {
  render: () => <SingleBlockExample />,
};

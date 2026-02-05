import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { AgentCMSBlocks } from './agent-cms-blocks';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { complexSchema } from '@/lib/rule-engine/components/fixtures';
import { createInstructionBlock, type InstructionBlock } from '../agent-edit-page/utils/form-validation';

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
  const [items, setItems] = useState<Array<InstructionBlock>>([
    createInstructionBlock('You are a helpful assistant that answers questions about programming.'),
    createInstructionBlock('Always be polite and professional in your responses.'),
  ]);

  return (
    <div className="w-[800px]">
      <TooltipProvider>
        <AgentCMSBlocks items={items} onChange={setItems} placeholder="Enter content..." schema={complexSchema} />
      </TooltipProvider>

      <div className="mt-4 p-3 bg-surface2 rounded-lg">
        <p className="text-xs text-neutral3 mb-2">Current state:</p>
        <pre className="text-xs text-neutral6 whitespace-pre-wrap">{JSON.stringify(items, null, 2)}</pre>
      </div>
    </div>
  );
};

export const Default: Story = {
  render: () => <InteractiveExample />,
};

const EmptyExample = () => {
  const [items, setItems] = useState<Array<InstructionBlock>>([]);

  return (
    <div className="w-[500px]">
      <TooltipProvider>
        <AgentCMSBlocks
          items={items}
          onChange={setItems}
          placeholder="Add your first content block..."
          schema={complexSchema}
        />
      </TooltipProvider>
    </div>
  );
};

export const Empty: Story = {
  render: () => <EmptyExample />,
};

const SingleBlockExample = () => {
  const [items, setItems] = useState<Array<InstructionBlock>>([
    createInstructionBlock('Single content block with some text.'),
  ]);

  return (
    <div className="w-[500px]">
      <TooltipProvider>
        <AgentCMSBlocks items={items} onChange={setItems} placeholder="Enter content..." schema={complexSchema} />
      </TooltipProvider>
    </div>
  );
};

export const SingleBlock: Story = {
  render: () => <SingleBlockExample />,
};

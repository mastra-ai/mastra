import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import type { JsonSchema } from '@mastra/playground-ui/utils/json-schema';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { createInstructionBlock } from '../agent-edit-page/utils/form-validation';
import type { InstructionBlock } from '../agent-edit-page/utils/form-validation';
import { AgentCMSBlocks } from './agent-cms-blocks';

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

const complexSchema: JsonSchema = {
  type: 'object',
  properties: {
    user: {
      type: 'object',
      title: 'User',
      properties: {
        email: { type: 'string', title: 'Email' },
        roles: {
          type: 'array',
          title: 'Roles',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Role Name' },
              permissions: { type: 'string', title: 'Permissions' },
            },
          },
        },
        address: {
          type: 'object',
          title: 'Address',
          properties: {
            street: { type: 'string', title: 'Street' },
            city: { type: 'string', title: 'City' },
            country: { type: 'string', title: 'Country' },
            zipCode: { type: 'string', title: 'Zip Code' },
          },
        },
      },
    },
    metadata: {
      type: 'object',
      title: 'Metadata',
      properties: {
        createdAt: { type: 'string', title: 'Created At' },
        updatedAt: { type: 'string', title: 'Updated At' },
        version: { type: 'number', title: 'Version' },
      },
    },
  },
};

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

      <div className="bg-surface2 mt-4 rounded-lg p-3">
        <p className="text-neutral3 mb-2 text-xs">Current state:</p>
        <pre className="text-neutral6 text-xs whitespace-pre-wrap">{JSON.stringify(items, null, 2)}</pre>
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

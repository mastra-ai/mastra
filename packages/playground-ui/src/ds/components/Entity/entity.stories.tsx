import type { Meta, StoryObj } from '@storybook/react-vite';
import { Entity, EntityIcon, EntityName, EntityDescription, EntityContent } from './entity';
import { Bot, Workflow, Database, Settings } from 'lucide-react';

const meta: Meta<typeof Entity> = {
  title: 'Composite/Entity',
  component: Entity,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Entity>;

export const Default: Story = {
  render: () => (
    <Entity className="w-[300px]">
      <EntityIcon>
        <Bot />
      </EntityIcon>
      <EntityContent>
        <EntityName>My Agent</EntityName>
        <EntityDescription>A helpful AI assistant</EntityDescription>
      </EntityContent>
    </Entity>
  ),
};

export const Clickable: Story = {
  render: () => (
    <Entity className="w-[300px]" onClick={() => console.log('Entity clicked')}>
      <EntityIcon>
        <Workflow />
      </EntityIcon>
      <EntityContent>
        <EntityName>Data Pipeline</EntityName>
        <EntityDescription>Click to view workflow details</EntityDescription>
      </EntityContent>
    </Entity>
  ),
};

export const WithCustomContent: Story = {
  render: () => (
    <Entity className="w-[350px]">
      <EntityIcon>
        <Database />
      </EntityIcon>
      <EntityContent>
        <EntityName>Production Database</EntityName>
        <EntityDescription>PostgreSQL • 2.5GB</EntityDescription>
        <div className="mt-2 flex gap-2">
          <span className="text-xs bg-surface4 px-2 py-1 rounded">Active</span>
          <span className="text-xs bg-surface4 px-2 py-1 rounded">Primary</span>
        </div>
      </EntityContent>
    </Entity>
  ),
};

export const EntityList: Story = {
  render: () => (
    <div className="flex flex-col gap-2 w-[300px]">
      <Entity onClick={() => console.log('Agent 1 clicked')}>
        <EntityIcon>
          <Bot />
        </EntityIcon>
        <EntityContent>
          <EntityName>Customer Support</EntityName>
          <EntityDescription>Handles customer inquiries</EntityDescription>
        </EntityContent>
      </Entity>

      <Entity onClick={() => console.log('Agent 2 clicked')}>
        <EntityIcon>
          <Bot />
        </EntityIcon>
        <EntityContent>
          <EntityName>Sales Assistant</EntityName>
          <EntityDescription>Helps with sales queries</EntityDescription>
        </EntityContent>
      </Entity>

      <Entity onClick={() => console.log('Agent 3 clicked')}>
        <EntityIcon>
          <Settings />
        </EntityIcon>
        <EntityContent>
          <EntityName>Configuration</EntityName>
          <EntityDescription>System settings</EntityDescription>
        </EntityContent>
      </Entity>
    </div>
  ),
};

export const MinimalEntity: Story = {
  render: () => (
    <Entity className="w-[200px]">
      <EntityContent>
        <EntityName>Simple Entity</EntityName>
      </EntityContent>
    </Entity>
  ),
};

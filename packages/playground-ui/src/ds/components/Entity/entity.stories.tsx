import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bot, Workflow, Database } from 'lucide-react';
import { Entity, EntityIcon, EntityName, EntityDescription, EntityContent } from './Entity';

const meta: Meta<typeof Entity> = {
  title: 'Composite/Entity',
  component: Entity,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Entity>;

export const Default: Story = {
  render: () => (
    <Entity className="w-75">
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
    <Entity className="w-75" onClick={() => console.log('Entity clicked')}>
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
          <span className="rounded bg-muted px-2 py-1 text-caption">Active</span>
          <span className="rounded bg-muted px-2 py-1 text-caption">Primary</span>
        </div>
      </EntityContent>
    </Entity>
  ),
};

export const MinimalEntity: Story = {
  render: () => (
    <Entity className="w-50">
      <EntityContent>
        <EntityName>Simple Entity</EntityName>
      </EntityContent>
    </Entity>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bot, Database, Workflow } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '../Badge';
import { Field, FieldLabel } from '../Field';
import { Input } from '../Input';
import { Switch } from '../Switch';
import { Txt } from '../Txt';
import { Entity, EntityBody, EntityContent, EntityDescription, EntityHeader, EntityIcon, EntityName } from './Entity';

const meta = {
  title: 'Composite/Entity',
  component: Entity,
  args: { children: null },
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `Entity is a card used in Studio's agent configuration, integrations, and MCP tools. EntityHeader and EntityBody compose the expandable Memory settings sections. Page-level headings use PageHeader.

Real call sites:

- [Message History](https://github.com/mastra-ai/mastra/blob/refactor/entity-card-composition/packages/playground/src/domains/agents/components/agent-cms-pages/memory/last-messages-entity.tsx)
- [Observational Memory](https://github.com/mastra-ai/mastra/blob/refactor/entity-card-composition/packages/playground/src/domains/agents/components/agent-cms-pages/memory/observational-memory-entity.tsx)
- [Semantic Recall](https://github.com/mastra-ai/mastra/blob/refactor/entity-card-composition/packages/playground/src/domains/agents/components/agent-cms-pages/memory/semantic-recall-entity.tsx)
- [Agent tools](https://github.com/mastra-ai/mastra/blob/refactor/entity-card-composition/packages/playground/src/domains/agents/components/agent-cms-pages/tools-page.tsx)
- [Integration providers](https://github.com/mastra-ai/mastra/blob/refactor/entity-card-composition/packages/playground/src/domains/tool-providers/components/integration-tools-section.tsx)
- [MCP clients](https://github.com/mastra-ai/mastra/blob/refactor/entity-card-composition/packages/playground/src/domains/mcps/components/mcp-client-list/mcp-client-list.tsx)

The agent configuration tabs for Agents, Workflows, Skills, and Scorers also use these cards.`,
      },
    },
  },
  decorators: [
    Story => (
      <div className="mx-auto w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Entity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Entity>
      <EntityIcon>
        <Bot />
      </EntityIcon>
      <EntityContent>
        <EntityName>Customer support agent</EntityName>
        <EntityDescription>Answers questions about orders, delivery, and returns.</EntityDescription>
      </EntityContent>
    </Entity>
  ),
};

function SelectWorkflow() {
  const [selected, setSelected] = useState(false);
  return (
    <div className="space-y-3">
      <Entity onClick={() => setSelected(true)}>
        <EntityIcon>
          <Workflow />
        </EntityIcon>
        <EntityContent>
          <EntityName>Data processing pipeline</EntityName>
          <EntityDescription>Validate incoming records before storing them.</EntityDescription>
        </EntityContent>
      </Entity>
      <Txt variant="caption" tone="muted" role="status">
        {selected ? 'Pipeline selected' : 'Select a pipeline'}
      </Txt>
    </div>
  );
}

export const Clickable: Story = { render: () => <SelectWorkflow /> };

function MessageHistorySettings() {
  const [enabled, setEnabled] = useState(true);
  return (
    <Entity variant="section">
      <EntityHeader>
        <EntityContent>
          <EntityName>Message History</EntityName>
          <EntityDescription>Number of recent messages to include in context</EntityDescription>
        </EntityContent>
        <Switch aria-label="Enable message history" checked={enabled} onCheckedChange={setEnabled} />
      </EntityHeader>
      {enabled && (
        <EntityBody>
          <Field>
            <FieldLabel htmlFor="message-count">Recent messages</FieldLabel>
            <Input id="message-count" type="number" min={1} defaultValue={40} />
          </Field>
        </EntityBody>
      )}
    </Entity>
  );
}

export const SettingsSection: Story = { render: () => <MessageHistorySettings /> };

export const WithMetadata: Story = {
  render: () => (
    <Entity>
      <EntityIcon>
        <Database />
      </EntityIcon>
      <EntityContent>
        <EntityName>Production database</EntityName>
        <EntityDescription>PostgreSQL · 2.5 GB</EntityDescription>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="success">Active</Badge>
          <Badge>Primary</Badge>
        </div>
      </EntityContent>
    </Entity>
  ),
};

export const LongContent: Story = {
  render: () => (
    <Entity>
      <EntityIcon>
        <Bot />
      </EntityIcon>
      <EntityContent>
        <EntityName className="truncate" title="Customer support agent for international enterprise accounts">
          Customer support agent for international enterprise accounts
        </EntityName>
        <EntityDescription>
          Handles order tracking, delivery changes, and returns across regions, including conversations with longer
          descriptions.
        </EntityDescription>
      </EntityContent>
    </Entity>
  ),
};

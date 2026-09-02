import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bot, Workflow, Database, Settings } from 'lucide-react';
import { Badge } from '../Badge';
import { EntityHeader } from './entity-header';

const meta: Meta<typeof EntityHeader> = {
  title: 'Composite/EntityHeader',
  component: EntityHeader,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof EntityHeader>;

export const Default: Story = {
  args: {
    icon: <Bot />,
    title: 'Customer Support Agent',
  },
};

export const Loading: Story = {
  args: {
    icon: <Bot />,
    title: 'Loading Agent',
    isLoading: true,
  },
};

export const WithChildren: Story = {
  render: () => (
    <div className="bg-surface-raised w-100 rounded-lg">
      <EntityHeader icon={<Workflow />} title="Data Processing Pipeline">
        <p className="text-sm text-(--text-secondary)">Processes incoming data and transforms it for analysis</p>
      </EntityHeader>
    </div>
  ),
};

export const WithBadge: Story = {
  render: () => (
    <div className="bg-surface-raised w-100 rounded-lg">
      <EntityHeader icon={<Database />} title="Production Database">
        <div className="flex gap-2">
          <Badge variant="green">Active</Badge>
          <Badge>PostgreSQL</Badge>
        </div>
      </EntityHeader>
    </div>
  ),
};

export const LongTitle: Story = {
  render: () => (
    <div className="w-dropdown-max-height bg-surface-raised rounded-lg">
      <EntityHeader
        icon={<Settings />}
        title="This is a very long title that should be truncated when it exceeds the available width"
      />
    </div>
  ),
};

export const WithRichContent: Story = {
  render: () => (
    <div className="bg-surface-raised w-[450px] rounded-lg">
      <EntityHeader icon={<Bot />} title="AI Assistant">
        <div className="space-y-2">
          <p className="text-sm text-(--text-secondary)">An intelligent assistant for customer support tasks</p>
          <div className="flex items-center gap-4 text-xs text-(--text-secondary)">
            <span>Model: GPT-4</span>
            <span>Temperature: 0.7</span>
            <span>Max Tokens: 4096</span>
          </div>
        </div>
      </EntityHeader>
    </div>
  ),
};

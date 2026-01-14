import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityHeader } from './entity-header';
import { Bot, Workflow, Database, Settings } from 'lucide-react';
import { Badge } from '../Badge';

const meta: Meta<typeof EntityHeader> = {
  title: 'Composite/EntityHeader',
  component: EntityHeader,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
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
    <div className="w-[400px] bg-surface3 rounded-lg">
      <EntityHeader icon={<Workflow />} title="Data Processing Pipeline">
        <p className="text-sm text-icon3">Processes incoming data and transforms it for analysis</p>
      </EntityHeader>
    </div>
  ),
};

export const WithBadge: Story = {
  render: () => (
    <div className="w-[400px] bg-surface3 rounded-lg">
      <EntityHeader icon={<Database />} title="Production Database">
        <div className="flex gap-2">
          <Badge variant="success">Active</Badge>
          <Badge variant="default">PostgreSQL</Badge>
        </div>
      </EntityHeader>
    </div>
  ),
};

export const LongTitle: Story = {
  render: () => (
    <div className="w-[300px] bg-surface3 rounded-lg">
      <EntityHeader
        icon={<Settings />}
        title="This is a very long title that should be truncated when it exceeds the available width"
      />
    </div>
  ),
};

export const WithRichContent: Story = {
  render: () => (
    <div className="w-[450px] bg-surface3 rounded-lg">
      <EntityHeader icon={<Bot />} title="AI Assistant">
        <div className="space-y-2">
          <p className="text-sm text-icon3">An intelligent assistant for customer support tasks</p>
          <div className="flex items-center gap-4 text-xs text-icon3">
            <span>Model: GPT-4</span>
            <span>Temperature: 0.7</span>
            <span>Max Tokens: 4096</span>
          </div>
        </div>
      </EntityHeader>
    </div>
  ),
};

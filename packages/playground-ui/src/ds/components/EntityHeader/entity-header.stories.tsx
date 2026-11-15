import type { Meta, StoryObj } from '@storybook/react-vite';
import { Workflow } from 'lucide-react';
import { Badge } from '../Badge';
import { EntityHeader } from './entity-header';
import { IconRobot } from '@/ds/icons/central/IconRobot';
import { IconServer1 } from '@/ds/icons/central/IconServer1';
import { IconSettingsGear1 } from '@/ds/icons/central/IconSettingsGear1';

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
    icon: <IconRobot />,
    title: 'Customer Support Agent',
  },
};

export const Loading: Story = {
  args: {
    icon: <IconRobot />,
    title: 'Loading Agent',
    isLoading: true,
  },
};

export const WithChildren: Story = {
  render: () => (
    <div className="w-100 rounded-lg bg-card">
      <EntityHeader icon={<Workflow />} title="Data Processing Pipeline">
        <p className="text-body text-muted-foreground">Processes incoming data and transforms it for analysis</p>
      </EntityHeader>
    </div>
  ),
};

export const WithBadge: Story = {
  render: () => (
    <div className="w-100 rounded-lg bg-card">
      <EntityHeader icon={<IconServer1 />} title="Production Database">
        <div className="flex gap-2">
          <Badge variant="success">Active</Badge>
          <Badge>PostgreSQL</Badge>
        </div>
      </EntityHeader>
    </div>
  ),
};

export const LongTitle: Story = {
  render: () => (
    <div className="w-75 rounded-lg bg-card">
      <EntityHeader
        icon={<IconSettingsGear1 />}
        title="This is a very long title that should be truncated when it exceeds the available width"
      />
    </div>
  ),
};

export const WithRichContent: Story = {
  render: () => (
    <div className="w-[450px] rounded-lg bg-card">
      <EntityHeader icon={<IconRobot />} title="AI Assistant">
        <div className="space-y-2">
          <p className="text-body text-muted-foreground">An intelligent assistant for customer support tasks</p>
          <div className="flex items-center gap-4 text-caption text-muted-foreground">
            <span>Model: GPT-4</span>
            <span>Temperature: 0.7</span>
            <span>Max Tokens: 4096</span>
          </div>
        </div>
      </EntityHeader>
    </div>
  ),
};

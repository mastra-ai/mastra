import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, AlertCircle, Info as InfoIcon, TriangleAlert, Tag } from 'lucide-react';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'Elements/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Matrix: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">Default</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="error">Error</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="accent">Accent</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" icon={<Tag />}>
          Default
        </Badge>
        <Badge variant="success" icon={<Check />}>
          Success
        </Badge>
        <Badge variant="error" icon={<AlertCircle />}>
          Error
        </Badge>
        <Badge variant="info" icon={<InfoIcon />}>
          Info
        </Badge>
        <Badge variant="warning" icon={<TriangleAlert />}>
          Warning
        </Badge>
        <Badge variant="accent" icon={<Tag />}>
          Accent
        </Badge>
      </div>
    </div>
  ),
};

export const Indicators: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="success" indicator="dot">
        Connected
      </Badge>
      <Badge variant="info" indicator="pulse">
        Live
      </Badge>
      <Badge variant="warning" indicator="dot">
        Waiting
      </Badge>
      <Badge variant="error" indicator="dot">
        Failed
      </Badge>
    </div>
  ),
};

export const Emphasis: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="accent">Baseline</Badge>
        <Badge variant="accent" emphasis="muted">
          Baseline
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="info">Contender</Badge>
        <Badge variant="info" emphasis="muted">
          Contender
        </Badge>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="w-8 text-ui-sm text-neutral3">md</span>
        <Badge size="md">Default</Badge>
        <Badge size="md" icon={<Tag />}>
          With icon
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-ui-sm text-neutral3">sm</span>
        <Badge size="sm">Default</Badge>
        <Badge size="sm" icon={<Tag />}>
          With icon
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-ui-sm text-neutral3">xs</span>
        <Badge size="xs">Default</Badge>
        <Badge size="xs" icon={<Tag />}>
          With icon
        </Badge>
      </div>
    </div>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Check, AlertCircle, FileText, Image as ImageIcon, Info as InfoIcon, TriangleAlert, Tag } from 'lucide-react';
import { Badge } from './Badge';
import type { BadgeProps } from './Badge';
import { cn } from '@/lib/utils';

const meta: Meta<typeof Badge> = {
  title: 'Elements/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;
type ComparisonBadge = BadgeProps & { children: string };

const comparisonTones = [
  { variant: 'default', children: 'Draft' },
  { variant: 'success', children: 'Published' },
  { variant: 'error', children: 'Failed' },
  { variant: 'info', children: 'Email' },
  { variant: 'warning', children: 'Pending' },
  { variant: 'accent', children: 'Template' },
  { variant: 'orange', children: 'Component' },
  { variant: 'cyan', children: 'Workflow' },
  { variant: 'pink', children: 'Evaluation' },
] satisfies ComparisonBadge[];

const comparisonGroups = [
  {
    label: 'Colors',
    surfaceClassName: '',
    badges: comparisonTones,
  },
  {
    label: 'With icons',
    surfaceClassName: '',
    badges: [
      { variant: 'warning', children: 'Health & wellness', icon: <Tag /> },
      { children: 'SKILL.md, +1', icon: <FileText /> },
      { variant: 'orange', children: 'Image lab', icon: <ImageIcon /> },
    ],
  },
  {
    label: 'On a raised surface',
    surfaceClassName: 'bg-surface3 rounded-md p-4',
    badges: [
      { variant: 'success', children: 'Connected', indicator: 'dot' },
      { variant: 'info', children: 'Running', indicator: 'dot' },
      { children: 'Draft' },
    ],
  },
] satisfies {
  label: string;
  surfaceClassName: string;
  badges: ComparisonBadge[];
}[];

export const StyleComparison: Story = {
  parameters: {
    layout: 'padded',
  },
  render: () => (
    <div className="mx-auto grid w-full max-w-3xl items-start gap-10 py-4 md:grid-cols-2">
      {comparisonGroups.map(group => (
        <section key={group.label} className="flex min-w-0 flex-col gap-4 md:first:col-span-2">
          <h2 className="text-ui-md text-neutral6 font-medium">{group.label}</h2>
          <div className={cn('flex flex-wrap items-center gap-2', group.surfaceClassName)}>
            {group.badges.map(badge => (
              <Badge key={badge.children} {...badge} emphasis="muted" />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

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
        <Badge variant="orange">Orange</Badge>
        <Badge variant="cyan">Cyan</Badge>
        <Badge variant="pink">Pink</Badge>
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
        <Badge variant="success">Success</Badge>
        <Badge variant="success" emphasis="muted">
          Success
        </Badge>
        <Badge variant="accent">Accent</Badge>
        <Badge variant="accent" emphasis="muted">
          Accent
        </Badge>
        <Badge variant="cyan">Cyan</Badge>
        <Badge variant="cyan" emphasis="muted">
          Cyan
        </Badge>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-ui-sm text-neutral3 w-8">md</span>
        <Badge size="md">Default</Badge>
        <Badge size="md" icon={<Tag />}>
          With icon
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-ui-sm text-neutral3 w-8">sm</span>
        <Badge size="sm">Default</Badge>
        <Badge size="sm" icon={<Tag />}>
          With icon
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-ui-sm text-neutral3 w-8">xs</span>
        <Badge size="xs">Default</Badge>
        <Badge size="xs" icon={<Tag />}>
          With icon
        </Badge>
      </div>
    </div>
  ),
};

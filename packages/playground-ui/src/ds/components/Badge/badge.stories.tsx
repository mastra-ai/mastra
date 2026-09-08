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
  { variant: 'neutral', children: 'Draft' },
  { variant: 'green', children: 'Published' },
  { variant: 'red', children: 'Failed' },
  { variant: 'blue', children: 'Email' },
  { variant: 'yellow', children: 'Pending' },
  { variant: 'purple', children: 'Template' },
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
      { variant: 'yellow', children: 'Health & wellness', icon: <Tag /> },
      { children: 'SKILL.md, +1', icon: <FileText /> },
      { variant: 'orange', children: 'Image lab', icon: <ImageIcon /> },
    ],
  },
  {
    label: 'On a raised surface',
    surfaceClassName: 'bg-surface3 rounded-md p-4',
    badges: [
      { variant: 'green', children: 'Connected', indicator: 'dot' },
      { variant: 'blue', children: 'Running', indicator: 'dot' },
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
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="green">Green</Badge>
        <Badge variant="red">Red</Badge>
        <Badge variant="blue">Blue</Badge>
        <Badge variant="yellow">Yellow</Badge>
        <Badge variant="purple">Purple</Badge>
        <Badge variant="orange">Orange</Badge>
        <Badge variant="cyan">Cyan</Badge>
        <Badge variant="pink">Pink</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral" icon={<Tag />}>
          Neutral
        </Badge>
        <Badge variant="green" icon={<Check />}>
          Green
        </Badge>
        <Badge variant="red" icon={<AlertCircle />}>
          Red
        </Badge>
        <Badge variant="blue" icon={<InfoIcon />}>
          Blue
        </Badge>
        <Badge variant="yellow" icon={<TriangleAlert />}>
          Yellow
        </Badge>
        <Badge variant="purple" icon={<Tag />}>
          Purple
        </Badge>
      </div>
    </div>
  ),
};

export const Indicators: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="green" indicator="dot">
        Connected
      </Badge>
      <Badge variant="blue" indicator="pulse">
        Live
      </Badge>
      <Badge variant="yellow" indicator="dot">
        Waiting
      </Badge>
      <Badge variant="red" indicator="dot">
        Failed
      </Badge>
    </div>
  ),
};

export const Emphasis: Story = {
  render: () => (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>Neutral</Badge>
        <Badge emphasis="muted">Neutral muted</Badge>
        <Badge variant="green">Green</Badge>
        <Badge variant="green" emphasis="muted">
          Green muted
        </Badge>
        <Badge variant="purple">Purple</Badge>
        <Badge variant="purple" emphasis="muted">
          Purple muted
        </Badge>
        <Badge variant="cyan">Cyan</Badge>
        <Badge variant="cyan" emphasis="muted">
          Cyan muted
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
        <Badge size="md">Neutral</Badge>
        <Badge size="md" icon={<Tag />}>
          With icon
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-ui-sm text-neutral3 w-8">sm</span>
        <Badge size="sm">Neutral</Badge>
        <Badge size="sm" icon={<Tag />}>
          With icon
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-ui-sm text-neutral3 w-8">xs</span>
        <Badge size="xs">Neutral</Badge>
        <Badge size="xs" icon={<Tag />}>
          With icon
        </Badge>
      </div>
    </div>
  ),
};

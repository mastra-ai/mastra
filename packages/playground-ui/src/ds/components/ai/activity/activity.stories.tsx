import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, Brain, FileText, Layers, Sparkles, Terminal } from 'lucide-react';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import {
  Activity,
  ActivityContent,
  ActivityDetail,
  ActivityDisclosure,
  ActivityHeader,
  ActivityIcon,
  ActivityItem,
  ActivityLabel,
  ActivitySpacer,
  ActivityTrigger,
} from './activity';
import { TranscriptDivider } from '@/ds/components/ai/transcript-divider';
import { Badge } from '@/ds/components/Badge';

const Code = ({ children }: { children: string }) => (
  <pre className="m-0 max-h-60 overflow-auto rounded-md bg-sidebar px-3 py-2 font-mono text-caption whitespace-pre-wrap text-muted-foreground">
    {children}
  </pre>
);

const meta = {
  title: 'AI/Activity',
  component: ActivityItem,
  args: {
    icon: <FileText aria-hidden />,
    label: 'Read file',
    detail: 'src/agent.ts',
    'aria-label': 'Tool: read file',
    children: <Code>{`export const agent = new Agent({\n  name: 'Support agent',\n});`}</Code>,
  },
  argTypes: {
    status: { control: 'inline-radio', options: ['idle', 'running', 'error'] },
    collapsible: { control: 'boolean' },
    icon: { control: false },
    children: { control: false },
  },
  decorators: [
    Story => (
      <div className="w-full max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'One line for everything the agent does: tool calls, reasoning, signals, notifications, skills, and plain "working" rows. `ActivityItem` is the everyday shape — icon, label, detail, badges, and an optional body. A body folds behind a chevron; without one the line stands alone and looks the same. `status="running"` shimmers the line, `status="error"` marks it failed.\n\nThe compound parts (`Activity`, `ActivityTrigger`, `ActivityHeadline`, `ActivityContent`, …) build custom lines, such as a tool row with a timestamp ahead of the icon. `TranscriptDivider` separates turns.',
      },
    },
  },
} satisfies Meta<typeof ActivityItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Folded: Story = {};

export const Expanded: Story = { args: { defaultOpen: true } };

export const WithoutBody: Story = {
  args: {
    icon: <Sparkles aria-hidden />,
    label: 'Thinking',
    detail: undefined,
    status: 'running',
    children: undefined,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button')).not.toBeInTheDocument();
  },
};

export const Running: Story = {
  args: { icon: <Terminal aria-hidden />, label: 'Running command', detail: 'pnpm test', status: 'running' },
};

export const Failed: Story = {
  args: {
    label: 'Write file',
    detail: 'src/config.ts',
    status: 'error',
    defaultOpen: true,
    children: <Code>Permission denied: src/config.ts</Code>,
  },
};

export const KeyboardDisclosure: Story = {
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard(' ');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toHaveFocus();
  },
};

export const EveryKind: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The same line for every kind of event, in the order a run produces them. Only rows with a body carry a chevron; a notification shows its priority as a badge.',
      },
    },
  },
  render: () => (
    <div className="flex flex-col gap-1">
      <ActivityItem icon={<Brain aria-hidden />} label="Reasoning" aria-label="Reasoning">
        <Code>The user wants the config read before any change.</Code>
      </ActivityItem>
      <ActivityItem icon={<FileText aria-hidden />} label="Read file" detail="src/config.ts" aria-label="Tool: view">
        <Code>{'export const config = {};'}</Code>
      </ActivityItem>
      <ActivityItem
        icon={<Layers className="text-purple-400" aria-hidden />}
        label="factory-phase"
        badges={<Badge size="xs">delta</Badge>}
        detail="Stage: building → review"
        aria-label="Signal: factory-phase"
      />
      <ActivityItem
        icon={<Bell className="text-warning1" aria-hidden />}
        label="github / issue-opened"
        badges={
          <Badge size="xs" variant="orange">
            high
          </Badge>
        }
        detail="Opening a workflow shows a blank page."
        detailFont="sans"
        aria-label="Notification: github / issue-opened"
      />
      <TranscriptDivider label="24 minutes later" title="Sep 17, 2026, 2:24 PM" />
      <ActivityItem icon={<Sparkles aria-hidden />} label="Thinking" status="running" aria-label="Thinking" />
    </div>
  ),
};

function ControlledExample() {
  const [open, setOpen] = useState(false);

  return (
    <Activity open={open} onOpenChange={setOpen} aria-label="Custom result">
      <ActivityTrigger>
        <ActivityHeader>
          <ActivityIcon>◆</ActivityIcon>
          <ActivityLabel>Custom result</ActivityLabel>
          <ActivityDetail>{open ? 'Expanded' : 'Collapsed'}</ActivityDetail>
          <ActivitySpacer rule />
          <ActivityDisclosure />
        </ActivityHeader>
      </ActivityTrigger>
      <ActivityContent>
        <div className="rounded-md border border-border bg-sidebar p-3 text-body">
          Arbitrary consumer-rendered content
        </div>
      </ActivityContent>
    </Activity>
  );
}

export const ComposedAndControlled: Story = {
  render: () => <ControlledExample />,
};

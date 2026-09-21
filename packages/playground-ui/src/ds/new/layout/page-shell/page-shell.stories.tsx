import type { Meta, StoryObj } from '@storybook/react-vite';
import { BotIcon } from 'lucide-react';

import { PageShell } from './page-shell';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';

/** Body long enough to make the content area scroll, for the loaded stories. */
function ExampleContent() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 8 }, (_, index) => (
        <article key={index} className="rounded-studio-panel border-border1 bg-surface3 border p-4">
          <p className="text-column text-foreground">Activity {index + 1}</p>
          <p className="text-meta text-muted-foreground mt-1">
            A representative row that makes the content area scroll.
          </p>
        </article>
      ))}
    </div>
  );
}

/** Placeholder body paired with `isLoading`, matching what a real caller renders. */
function SkeletonContent() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="rounded-studio-panel border-border1 bg-surface3 h-16 animate-pulse border" />
      ))}
    </div>
  );
}

type PageShellStoryProps = {
  description: string;
  isLoading: boolean;
  showAction: boolean;
  showDescription: boolean;
  showIcon: boolean;
  showMeta: boolean;
  title: string;
};

/** Wraps PageShell so Storybook controls stay text and boolean, never ReactNode args. */
function PageShellStory({
  description,
  isLoading,
  showAction,
  showDescription,
  showIcon,
  showMeta,
  title,
}: PageShellStoryProps) {
  return (
    <PageShell
      title={title}
      icon={showIcon ? <BotIcon strokeWidth={2.5} /> : undefined}
      description={showDescription ? description : undefined}
      meta={showMeta ? <Badge variant="green">Read only</Badge> : undefined}
      action={showAction ? <Button size="sm">Edit agent</Button> : undefined}
      isLoading={isLoading}
    >
      {isLoading ? <SkeletonContent /> : <ExampleContent />}
    </PageShell>
  );
}

const meta = {
  title: 'Layout/PageShell',
  component: PageShellStory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'The standard page wrapper: composes `PageLayout` and `PageHeader` so every page puts',
          'its title, icon, description, meta, and action in the same place, without callers',
          'hand-composing that structure themselves.',
          '',
          'Use it for full-bleed application pages that own the whole content area (agent detail,',
          'workflow detail, and similar top-level routes).',
          '',
          'Do not use it for settings-style pages. `ds/components/SettingsLayout` is the existing',
          'shell for those: it constrains content to `max-w-5xl` and hand-rolls its own `h1`',
          'instead of using `PageHeader`. The two overlap in purpose and their header',
          'implementations are currently separate; reach for `SettingsLayout` for narrow settings',
          'pages until that overlap is resolved.',
          '',
          'Slot order in JSX does not affect layout: `PageHeaderRoot` places each slot by named',
          'grid column, not by source order. DOM order still drives screen reader and tab order,',
          'so slots are still passed in reading order (icon, title, description, meta, action).',
          '',
          '`isLoading` only affects the header: it blanks the title and description into animated',
          'placeholders and hides the icon. It does not touch `children`. Callers are responsible',
          'for rendering their own loading body underneath.',
        ].join('\n'),
      },
    },
  },
  args: {
    description: 'Searches trusted sources and writes cited summaries.',
    isLoading: false,
    showAction: false,
    showDescription: false,
    showIcon: false,
    showMeta: false,
    title: 'Research agent',
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    isLoading: { control: 'boolean' },
    showAction: { control: 'boolean' },
    showDescription: { control: 'boolean' },
    showIcon: { control: 'boolean' },
    showMeta: { control: 'boolean' },
  },
} satisfies Meta<typeof PageShellStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Title only. The minimum a page needs: no icon, description, meta, or action.',
      },
    },
  },
};

export const WithIconAndDescription: Story = {
  args: {
    showIcon: true,
    showDescription: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Adds the icon and description slots, the most common header shape for a detail page.',
      },
    },
  },
};

export const WithAction: Story = {
  args: {
    showIcon: true,
    showDescription: true,
    showAction: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Adds a primary action to the header, right-aligned regardless of where it sits in JSX.',
      },
    },
  },
};

export const WithMetaAndAction: Story = {
  args: {
    showIcon: true,
    showDescription: true,
    showMeta: true,
    showAction: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Adds a beside-meta badge next to the title alongside the action, the shape a read-only status pill and an edit action need.',
      },
    },
  },
};

export const Loading: Story = {
  args: {
    showIcon: true,
    showDescription: true,
    isLoading: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Title and description render as animated placeholders and the icon is hidden. `isLoading` only affects the header, so this story swaps in a placeholder body too, that body is the caller's responsibility, not something PageShell provides.",
      },
    },
  },
};

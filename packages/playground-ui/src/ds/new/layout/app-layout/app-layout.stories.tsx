import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentPropsWithRef } from 'react';

import {
  SidebarNewStoryContent,
  SidebarNewStoryShortcuts,
} from '../../../../../.storybook/fixtures/sidebar/sidebar-new-story-content';
import { PageHeader } from '../page-header/page-header';
import { AppFrame } from './app-frame';
import { AppLayout } from './app-layout';
import { PageContent } from './page-content';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { Txt } from '@/ds/components/Txt';
import { KeyboardShortcutsProvider } from '@/lib/keyboard/keyboard-shortcuts-context';

function StoryLink({ href, ...props }: ComponentPropsWithRef<'a'>) {
  return <a href={`#${href}`} {...props} />;
}

function Activity() {
  return (
    <section aria-label="Recent activity" className="grid gap-3">
      <Txt as="h2" variant="header-sm" className="font-medium">
        Recent activity
      </Txt>
      {Array.from({ length: 24 }, (_, index) => (
        <article key={index} className="rounded-studio-panel border-border bg-card grid gap-1 border p-4">
          <Txt variant="ui-md">Research run {index + 1}</Txt>
          <Txt variant="ui-sm" className="text-muted-foreground">
            Summary saved with citations from verified sources.
          </Txt>
          <Txt variant="ui-xs" className="text-muted-foreground">
            Completed · 12 sources
          </Txt>
        </article>
      ))}
    </section>
  );
}

const meta = {
  title: 'Layout/AppLayout',
  component: AppLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The canonical app composition example: AppLayout places SidebarNew beside AppFrame, and PageContent owns page scrolling. These stories cover optional chrome and responsive layout. Sidebar content is shared with [New / SidebarNew](?path=/docs/new-sidebarnew--docs), which covers navigation behavior. [Layout / AppShell](?path=/docs/layout-appshell--docs) remains regression coverage for existing consumers, not the starting point for new layouts.',
      },
    },
  },
  decorators: [
    (Story, context) => (
      <KeyboardShortcutsProvider>
        <TooltipProvider>
          <Story
            args={{
              ...context.args,
              sidebarProviderProps: { storageKey: `app-layout:${context.id}`, LinkComponent: StoryLink },
            }}
          />
        </TooltipProvider>
      </KeyboardShortcutsProvider>
    ),
  ],
  args: {
    sidebar: <SidebarNewStoryContent />,
    mobileHeader: (
      <Txt as="span" variant="ui-md" className="font-medium">
        Mastra Platform
      </Txt>
    ),
  },
  render: args => (
    <AppLayout {...args}>
      <SidebarNewStoryShortcuts />
      <AppFrame
        breadcrumb={
          <Breadcrumb.Bar>
            <Breadcrumb.Item pathname="/agents">
              <Crumb as="a" to="#agents">
                Agents
              </Crumb>
            </Breadcrumb.Item>
            <Breadcrumb.Item pathname="/agents/research">
              <Crumb as="span" isCurrent>
                Research agent
              </Crumb>
            </Breadcrumb.Item>
          </Breadcrumb.Bar>
        }
      >
        <PageContent
          aria-label="Research agent"
          pageHeader={
            <PageHeader>
              <PageHeader.Title>Research agent</PageHeader.Title>
              <PageHeader.Description>Searches trusted sources and writes cited summaries.</PageHeader.Description>
            </PageHeader>
          }
        >
          <Activity />
        </PageContent>
      </AppFrame>
    </AppLayout>
  ),
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullChrome: Story = {};

export const NoBreadcrumb: Story = {
  render: args => (
    <AppLayout {...args}>
      <SidebarNewStoryShortcuts />
      <AppFrame>
        <PageContent aria-label="Research agent" pageHeader={<PageHeader title="Research agent" />}>
          <Activity />
        </PageContent>
      </AppFrame>
    </AppLayout>
  ),
};

export const NoPageHeader: Story = {
  render: args => (
    <AppLayout {...args}>
      <SidebarNewStoryShortcuts />
      <AppFrame
        breadcrumb={
          <Breadcrumb.Bar>
            <Breadcrumb.Item>
              <Crumb as="span" isCurrent>
                Activity
              </Crumb>
            </Breadcrumb.Item>
          </Breadcrumb.Bar>
        }
      >
        <PageContent aria-label="Agent activity">
          <Activity />
        </PageContent>
      </AppFrame>
    </AppLayout>
  ),
};

export const BodyOnly: Story = {
  render: args => (
    <AppLayout {...args}>
      <SidebarNewStoryShortcuts />
      <AppFrame>
        <PageContent aria-label="Agent activity">
          <Activity />
        </PageContent>
      </AppFrame>
    </AppLayout>
  ),
};

export const MobileTriggerOnly: Story = {
  ...BodyOnly,
  args: { mobileHeader: undefined },
};

export const Phone: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  parameters: { viewport: { options: { phone: { name: 'Phone', styles: { width: '390px', height: '844px' } } } } },
};

export const IPhoneSE: Story = {
  globals: { viewport: { value: 'iphone-se', isRotated: false } },
  parameters: {
    viewport: { options: { 'iphone-se': { name: 'iPhone SE', styles: { width: '375px', height: '667px' } } } },
  },
};

export const Drawer: Story = { args: { mobileMode: 'drawer' } };
export const Light: Story = { globals: { backgrounds: { value: 'light' } } };

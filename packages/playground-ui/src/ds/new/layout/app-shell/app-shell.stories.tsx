import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bot, Boxes, Search, Settings, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';

import { PageHeader } from '../page-header';
import { AppShell } from './app-shell';
import { MainCard } from './main-card';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { PageLayout } from '@/ds/components/PageLayout';
import { Sidebar, SidebarProvider, useSidebar } from '@/ds/components/Sidebar';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

function DemoSidebarBrand() {
  const { state, isMobile } = useSidebar();

  if (state === 'collapsed') {
    return (
      <div className="flex justify-center pt-2">
        <div className="relative grid size-9 place-items-center">
          <Boxes
            className={cn(
              'size-5 shrink-0 transition-opacity duration-150',
              !isMobile && 'group-hover/sidebar:opacity-0',
            )}
          />
          {!isMobile && (
            <div className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
              <Sidebar.Trigger />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Boxes className="size-5 shrink-0" />
      <span className="text-subheading text-foreground">Workspace</span>
      {!isMobile && <Sidebar.Trigger />}
    </div>
  );
}

function DemoSidebar() {
  return (
    <Sidebar>
      <DemoSidebarBrand />
      <Sidebar.Nav>
        <Sidebar.NavSection>
          <Sidebar.NavList>
            <Sidebar.NavLink link={{ name: 'Agents', url: '#agents', icon: <Bot /> }} isActive />
            <Sidebar.NavLink link={{ name: 'Workflows', url: '#workflows', icon: <Workflow /> }} />
          </Sidebar.NavList>
        </Sidebar.NavSection>
      </Sidebar.Nav>
      <Sidebar.Footer>
        <Sidebar.NavList>
          <Sidebar.NavLink link={{ name: 'Settings', url: '#settings', icon: <Settings /> }} />
        </Sidebar.NavList>
      </Sidebar.Footer>
    </Sidebar>
  );
}

function MobileHeader() {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-sidebar px-3 lg:hidden">
      <span className="flex items-center gap-3">
        <Sidebar.MobileTrigger />
        <span className="text-subheading text-foreground">Workspace</span>
      </span>
      <button type="button" aria-label="Search">
        <Search className="size-5" />
      </button>
    </div>
  );
}

const crumbs = (
  <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
    <Crumb as="span" isCurrent icon={<Bot />}>
      Research agent
    </Crumb>
  </Breadcrumb>
);

function MainContent({ withHeader = true }: { withHeader?: boolean }) {
  return (
    <PageLayout breadcrumbs={withHeader ? crumbs : undefined}>
      <div className="grid gap-4">
        <PageHeader>
          <PageHeader.Icon>
            <Bot />
          </PageHeader.Icon>
          <PageHeader.Title>Research agent</PageHeader.Title>
          <PageHeader.Description>Configuration and recent activity.</PageHeader.Description>
        </PageHeader>
        {Array.from({ length: 14 }, (_, index) => (
          <article key={index} className={cn(raisedSurfaceStyle, 'rounded-studio-panel p-4')}>
            <p className="text-column text-foreground">Activity {index + 1}</p>
            <p className="mt-1 text-meta text-muted-foreground">
              A representative row that makes the content area scroll.
            </p>
          </article>
        ))}
      </div>
    </PageLayout>
  );
}

function FrameWithPanel({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1">
      <MainCard>{children}</MainCard>
      <aside className="hidden w-72 shrink-0 border-l border-border bg-sidebar p-4 xl:block">
        <p className="text-column text-foreground">Details panel</p>
        <p className="mt-1 text-meta text-muted-foreground">
          A consumer-owned panel rendered beside the framed content.
        </p>
      </aside>
    </div>
  );
}

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: { children: null },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StandardDesktop: Story = {
  render: () => (
    <TooltipProvider>
      <SidebarProvider defaultWidth={240} minWidth={200} maxWidth={360} collapseBelow={160}>
        <div className="h-dvh w-dvw bg-sidebar font-body">
          <AppShell sidebar={<DemoSidebar />} mobileHeader={<MobileHeader />}>
            <MainCard>
              <MainContent />
            </MainCard>
          </AppShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  ),
};

export const CollapsedSidebar: Story = {
  render: () => (
    <TooltipProvider>
      <SidebarProvider
        defaultState="collapsed"
        defaultWidth={240}
        minWidth={200}
        maxWidth={360}
        collapseBelow={160}
        storageKey="app-shell-story-collapsed"
      >
        <div className="h-dvh w-dvw bg-sidebar font-body">
          <AppShell sidebar={<DemoSidebar />} mobileHeader={<MobileHeader />}>
            <MainCard>
              <MainContent />
            </MainCard>
          </AppShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <TooltipProvider>
      <SidebarProvider>
        <div className="h-dvh w-dvw bg-sidebar font-body">
          <AppShell sidebar={<DemoSidebar />} mobileHeader={<MobileHeader />}>
            <MainCard>
              <MainContent />
            </MainCard>
          </AppShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  ),
};

export const WithoutRouteHeader: Story = {
  render: () => (
    <TooltipProvider>
      <SidebarProvider>
        <div className="h-dvh w-dvw bg-sidebar font-body">
          <AppShell sidebar={<DemoSidebar />} mobileHeader={<MobileHeader />}>
            <MainCard>
              <MainContent withHeader={false} />
            </MainCard>
          </AppShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  ),
};

export const WithFrameWrapper: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Consumers own the frame: a details panel is rendered beside the framed page inside the AppShell content column.',
      },
    },
  },
  render: () => (
    <TooltipProvider>
      <SidebarProvider>
        <div className="h-dvh w-dvw bg-sidebar font-body">
          <AppShell sidebar={<DemoSidebar />} mobileHeader={<MobileHeader />}>
            <FrameWithPanel>
              <MainContent />
            </FrameWithPanel>
          </AppShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  ),
};

export const LightTheme: Story = {
  globals: { backgrounds: { value: 'light' } },
  render: () => (
    <TooltipProvider>
      <SidebarProvider>
        <div className="h-dvh w-dvw bg-sidebar font-body">
          <AppShell sidebar={<DemoSidebar />} mobileHeader={<MobileHeader />}>
            <MainCard>
              <MainContent />
            </MainCard>
          </AppShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  ),
};

export const DarkTheme: Story = {
  globals: { backgrounds: { value: 'dark' } },
  render: () => (
    <TooltipProvider>
      <SidebarProvider>
        <div className="h-dvh w-dvw bg-sidebar font-body">
          <AppShell sidebar={<DemoSidebar />} mobileHeader={<MobileHeader />}>
            <MainCard>
              <MainContent />
            </MainCard>
          </AppShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  ),
};

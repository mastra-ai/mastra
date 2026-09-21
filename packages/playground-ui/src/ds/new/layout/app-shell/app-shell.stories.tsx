import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bot, Boxes, Search, Settings, Workflow } from 'lucide-react';

import { PageHeader } from '../page-header';
import { AppShell } from './app-shell';
import type { AppShellFrameProps } from './app-shell';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { Header } from '@/ds/components/Header';
import { MainSidebar, MainSidebarProvider, useMainSidebar } from '@/ds/components/MainSidebar';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

function SidebarBrand() {
  const { state, isMobile } = useMainSidebar();

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
              <MainSidebar.Trigger />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Boxes className="size-5 shrink-0" />
      <span className="text-ui-md text-foreground font-semibold">Workspace</span>
      {!isMobile && <MainSidebar.Trigger />}
    </div>
  );
}

function Sidebar() {
  return (
    <MainSidebar>
      <SidebarBrand />
      <MainSidebar.Nav>
        <MainSidebar.NavSection>
          <MainSidebar.NavList>
            <MainSidebar.NavLink link={{ name: 'Agents', url: '#agents', icon: <Bot /> }} isActive />
            <MainSidebar.NavLink link={{ name: 'Workflows', url: '#workflows', icon: <Workflow /> }} />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>
      <MainSidebar.Bottom>
        <MainSidebar.NavList>
          <MainSidebar.NavLink link={{ name: 'Settings', url: '#settings', icon: <Settings /> }} />
        </MainSidebar.NavList>
      </MainSidebar.Bottom>
    </MainSidebar>
  );
}

function MobileHeader() {
  return (
    <div className="border-border1 bg-surface1 flex h-12 shrink-0 items-center justify-between border-b px-3 lg:hidden">
      <span className="flex items-center gap-3">
        <MainSidebar.MobileTrigger />
        <span className="text-ui-md text-foreground font-semibold">Workspace</span>
      </span>
      <button type="button" aria-label="Search">
        <Search className="size-5" />
      </button>
    </div>
  );
}

function ExampleRouteHeader() {
  return (
    <Header className="h-10 min-h-10 gap-2 overflow-hidden px-2">
      <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
        <Crumb as="span" isCurrent icon={<Bot />}>
          Research agent
        </Crumb>
      </Breadcrumb>
    </Header>
  );
}

function MainContent() {
  return (
    <main className="grid min-h-full content-start gap-4 p-5">
      <PageHeader>
        <PageHeader.Icon>
          <Bot />
        </PageHeader.Icon>
        <PageHeader.Title>Research agent</PageHeader.Title>
        <PageHeader.Description>Configuration and recent activity.</PageHeader.Description>
      </PageHeader>
      {Array.from({ length: 14 }, (_, index) => (
        <article key={index} className="rounded-studio-panel border-border1 bg-surface3 border p-4">
          <p className="text-ui-sm text-foreground font-medium">Activity {index + 1}</p>
          <p className="text-ui-xs text-muted-foreground mt-1">A representative row that makes the content area scroll.</p>
        </article>
      ))}
    </main>
  );
}

function FrameWithPanel({ children, className }: AppShellFrameProps) {
  return (
    <div className={className}>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">{children}</div>
        <aside className="border-border1 bg-surface1 hidden w-72 shrink-0 border-l p-4 xl:block">
          <p className="text-ui-sm text-foreground font-medium">Details panel</p>
          <p className="text-ui-xs text-muted-foreground mt-1">A consumer-owned panel rendered outside the framed content.</p>
        </aside>
      </div>
    </div>
  );
}

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: { children: null, mainLabel: 'Page content' },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StandardDesktop: Story = {
  render: () => (
    <TooltipProvider>
      <MainSidebarProvider defaultWidth={240} minWidth={200} maxWidth={360} collapseBelow={160}>
        <div className="bg-surface1 h-dvh w-dvw font-sans lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
          <Sidebar />
          <AppShell
            mainLabel="Research agent content"
            mobileHeader={<MobileHeader />}
            routeHeader={<ExampleRouteHeader />}
          >
            <MainContent />
          </AppShell>
        </div>
      </MainSidebarProvider>
    </TooltipProvider>
  ),
};

export const CollapsedSidebar: Story = {
  render: () => (
    <TooltipProvider>
      <MainSidebarProvider
        defaultState="collapsed"
        defaultWidth={240}
        minWidth={200}
        maxWidth={360}
        collapseBelow={160}
        storageKey="app-shell-story-collapsed"
      >
        <div className="bg-surface1 h-dvh w-dvw font-sans lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
          <Sidebar />
          <AppShell
            mainLabel="Research agent content"
            mobileHeader={<MobileHeader />}
            routeHeader={<ExampleRouteHeader />}
          >
            <MainContent />
          </AppShell>
        </div>
      </MainSidebarProvider>
    </TooltipProvider>
  ),
};

export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <TooltipProvider>
      <MainSidebarProvider>
        <div className="bg-surface1 h-dvh w-dvw font-sans lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
          <Sidebar />
          <AppShell
            mainLabel="Research agent content"
            mobileHeader={<MobileHeader />}
            routeHeader={<ExampleRouteHeader />}
          >
            <MainContent />
          </AppShell>
        </div>
      </MainSidebarProvider>
    </TooltipProvider>
  ),
};

export const WithoutRouteHeader: Story = {
  render: () => (
    <TooltipProvider>
      <MainSidebarProvider>
        <div className="bg-surface1 h-dvh w-dvw font-sans lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
          <Sidebar />
          <AppShell mainLabel="Research agent content" mobileHeader={<MobileHeader />}>
            <MainContent />
          </AppShell>
        </div>
      </MainSidebarProvider>
    </TooltipProvider>
  ),
};

export const WithFrameWrapper: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Uses `renderFrame` to place a consumer-owned details panel beside the framed page while AppShell keeps control of the frame geometry.',
      },
    },
  },
  render: () => (
    <TooltipProvider>
      <MainSidebarProvider>
        <div className="bg-surface1 h-dvh w-dvw font-sans lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
          <Sidebar />
          <AppShell
            mainLabel="Research agent content"
            mobileHeader={<MobileHeader />}
            routeHeader={<ExampleRouteHeader />}
            renderFrame={FrameWithPanel}
          >
            <MainContent />
          </AppShell>
        </div>
      </MainSidebarProvider>
    </TooltipProvider>
  ),
};

export const LightTheme: Story = {
  globals: { backgrounds: { value: 'light' } },
  render: () => (
    <TooltipProvider>
      <MainSidebarProvider>
        <div className="bg-surface1 h-dvh w-dvw font-sans lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
          <Sidebar />
          <AppShell
            mainLabel="Research agent content"
            mobileHeader={<MobileHeader />}
            routeHeader={<ExampleRouteHeader />}
          >
            <MainContent />
          </AppShell>
        </div>
      </MainSidebarProvider>
    </TooltipProvider>
  ),
};

export const DarkTheme: Story = {
  globals: { backgrounds: { value: 'dark' } },
  render: () => (
    <TooltipProvider>
      <MainSidebarProvider>
        <div className="bg-surface1 h-dvh w-dvw font-sans lg:grid lg:grid-cols-[auto_1fr] lg:grid-rows-[1fr]">
          <Sidebar />
          <AppShell
            mainLabel="Research agent content"
            mobileHeader={<MobileHeader />}
            routeHeader={<ExampleRouteHeader />}
          >
            <MainContent />
          </AppShell>
        </div>
      </MainSidebarProvider>
    </TooltipProvider>
  ),
};

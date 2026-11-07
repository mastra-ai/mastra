import type { Meta, StoryObj } from '@storybook/react-vite';
import { BookOpen, Bot, Search, Settings, Workflow } from 'lucide-react';
import type { ReactNode } from 'react';

import { verifyChromeRows } from '../../../../../.storybook/tests/app-shell-mobile-row';
import { PageHeader } from '../page-header';
import { AppShell } from './app-shell';
import { MainCard } from './main-card';
import { Breadcrumb, Crumb } from '@/ds/components/Breadcrumb';
import { Button } from '@/ds/components/Button';
import { Combobox } from '@/ds/components/Combobox';
import { LogoWithoutText } from '@/ds/components/Logo';
import { PageLayout } from '@/ds/components/PageLayout';
import { Sidebar, SidebarProvider } from '@/ds/components/Sidebar';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

function DemoSidebar() {
  return (
    <Sidebar>
      <Sidebar.Header collapsedLogo={<LogoWithoutText className="size-6" />}>
        <Sidebar.Brand logo={<LogoWithoutText className="size-6" />} title="Workspace" />
        <Sidebar.Trigger />
      </Sidebar.Header>
      <Sidebar.Nav>
        <Sidebar.NavList>
          <Sidebar.NavLink link={{ name: 'Agents', url: '#agents', icon: <Bot /> }} isActive />
          <Sidebar.NavLink link={{ name: 'Workflows', url: '#workflows', icon: <Workflow /> }} />
        </Sidebar.NavList>
      </Sidebar.Nav>
      <Sidebar.Footer>
        <Sidebar.NavList>
          <Sidebar.NavLink link={{ name: 'Settings', url: '#settings', icon: <Settings /> }} />
        </Sidebar.NavList>
      </Sidebar.Footer>
    </Sidebar>
  );
}

const mobileBrand = <Sidebar.Brand logo={<LogoWithoutText className="size-6" />} title="Workspace" />;

const mobileActions = (
  <Button type="button" variant="ghost" size="icon-sm" aria-label="Search">
    <Search />
  </Button>
);

function DemoShell({ children }: { children: ReactNode }) {
  return (
    <AppShell sidebar={<DemoSidebar />} mobileBrand={mobileBrand} mobileActions={mobileActions}>
      {children}
    </AppShell>
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
          <DemoShell>
            <MainCard>
              <MainContent />
            </MainCard>
          </DemoShell>
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
          <DemoShell>
            <MainCard>
              <MainContent />
            </MainCard>
          </DemoShell>
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
          <DemoShell>
            <MainCard>
              <MainContent />
            </MainCard>
          </DemoShell>
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
          <DemoShell>
            <MainCard>
              <MainContent withHeader={false} />
            </MainCard>
          </DemoShell>
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
          <DemoShell>
            <FrameWithPanel>
              <MainContent />
            </FrameWithPanel>
          </DemoShell>
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
          <DemoShell>
            <MainCard>
              <MainContent />
            </MainCard>
          </DemoShell>
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
          <DemoShell>
            <MainCard>
              <MainContent />
            </MainCard>
          </DemoShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  ),
};

const projects = [
  { label: 'PLTFRM-1389 browser automation sandbox', value: 'pltfrm-1389' },
  { label: 'Support triage', value: 'support-triage' },
];

const projectTrail = (
  <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
    <Crumb
      as="a"
      to="#project"
      action={
        <Combobox
          options={projects}
          value="pltfrm-1389"
          variant="ghost"
          size="icon-sm"
          align="end"
          aria-label="Switch project"
        />
      }
    >
      PLTFRM-1389 browser automation sandbox
    </Crumb>
    <Crumb as="span" isCurrent>
      Overview
    </Crumb>
  </Breadcrumb>
);

function MobileFrame({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider storageKey="app-shell-story-mobile-row">
        <div className="h-dvh w-dvw bg-sidebar font-body">
          <DemoShell>
            <MainCard>{children}</MainCard>
          </DemoShell>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function ProjectOverview() {
  return (
    <PageLayout
      breadcrumbs={projectTrail}
      headerActions={
        <Button variant="link" size="sm">
          <BookOpen />
          Docs
        </Button>
      }
    >
      <div className="grid gap-4">
        <p className="text-column text-foreground">Project overview</p>
      </div>
    </PageLayout>
  );
}

const longTrail = (
  <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
    <Crumb as="a" to="#project">
      PLTFRM-1389 browser automation sandbox for the customer success team
    </Crumb>
    <Crumb as="a" to="#datasets">
      Datasets
    </Crumb>
    <Crumb as="a" to="#dataset">
      Support conversations sampled from the last ninety days of production traffic
    </Crumb>
    <Crumb as="a" to="#versions">
      Versions
    </Crumb>
    <Crumb as="span" isCurrent>
      Version 42 with relabelled escalation outcomes and deduplicated threads
    </Crumb>
  </Breadcrumb>
);

function UntitledPage() {
  return (
    <PageLayout>
      <p className="text-column text-foreground">A page with no breadcrumb trail.</p>
    </PageLayout>
  );
}

export const MobileRowWithTrail: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: verifyChromeRows({ desktopRows: 1 }),
  render: () => (
    <MobileFrame>
      <ProjectOverview />
    </MobileFrame>
  ),
};

export const MobileRowWithBrand: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: verifyChromeRows({ desktopRows: 0 }),
  render: () => (
    <MobileFrame>
      <UntitledPage />
    </MobileFrame>
  ),
};

export const MobileRowWithLongTrail: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  play: verifyChromeRows({ desktopRows: 1, mobileCrumbs: 2 }),
  render: () => (
    <MobileFrame>
      <PageLayout breadcrumbs={longTrail}>
        <p className="text-column text-foreground">Dataset version</p>
      </PageLayout>
    </MobileFrame>
  ),
};

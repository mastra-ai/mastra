import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronUp,
  Code2,
  Database,
  FileText,
  Folder,
  Home,
  KeyRound,
  LayoutGrid,
  MessageSquare,
  Plus,
  Settings,
  SlidersHorizontal,
  Users,
  Workflow,
  Wrench,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { SidebarNew, useSidebarNew } from '.';
import { Avatar } from '@/ds/components/Avatar';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { LogoWithoutText } from '@/ds/components/Logo';
import { TooltipProvider } from '@/ds/components/Tooltip';
import { LogsIcon, MetricsIcon, TraceIcon } from '@/ds/icons';

const meta: Meta<typeof SidebarNew> = {
  title: 'New/SidebarNew',
  component: SidebarNew,
  decorators: [
    Story => (
      <SidebarNew.Provider defaultWidth={240} minWidth={200} maxWidth={480} collapseBelow={180}>
        <TooltipProvider>
          <Story />
        </TooltipProvider>
      </SidebarNew.Provider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof SidebarNew>;

function ProjectPicker({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="pb-2">
        <button
          type="button"
          aria-label="Select project"
          className="border-border bg-card text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex h-8 w-full items-center justify-center rounded-lg border transition-colors"
        >
          <Folder className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="border-border bg-card flex w-full items-center rounded-lg border">
        <button
          type="button"
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex h-8 min-w-0 flex-1 items-center gap-2 rounded-l-lg px-2.5 text-left transition-colors"
        >
          <span className="text-ui-md min-w-0 flex-1 truncate">Select project</span>
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="New project"
          className="border-border text-muted-foreground hover:bg-sidebar-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-r-lg border-l transition-colors"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function AccountMenu({
  state,
  menuTriggerRef,
  openSettings,
}: {
  state: 'default' | 'collapsed';
  menuTriggerRef: React.RefObject<HTMLButtonElement | null>;
  openSettings: (view: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        ref={menuTriggerRef}
        render={<button type="button" />}
        className="hover:bg-sidebar-accent focus-visible:ring-ring flex min-h-10 w-full items-center rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:ring-1 focus-visible:outline-none"
      >
        <Avatar name="Justin Levine" size="sm" />
        {state === 'default' ? (
          <>
            <span className="ml-2 flex min-w-0 flex-1 flex-col">
              <span className="text-ui-sm text-foreground truncate font-medium">Justin Levine</span>
              <span className="text-ui-xs text-muted-foreground truncate">Mastra Internal</span>
            </span>
            <ChevronUp className="text-muted-foreground size-4 shrink-0" aria-hidden />
          </>
        ) : null}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" side="top" sideOffset={8} className="w-64">
        <div className="text-ui-xs text-muted-foreground px-2 py-1">justin@mastra.ai</div>
        <DropdownMenu.Separator />
        <DropdownMenu.Item onSelect={() => openSettings('account-settings')}>
          <Settings />
          Account settings
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <div className="text-ui-xs text-muted-foreground px-2 py-1">Mastra Internal</div>
        <DropdownMenu.Item onSelect={() => openSettings('organization-settings')}>
          <Users />
          Organization settings
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function SidebarNewStory() {
  const { state, expand } = useSidebarNew();
  const [view, setView] = useState('root');
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  function openSettings(nextView: string) {
    expand();
    setView(nextView);
  }

  return (
    <div className="bg-background flex h-dvh w-dvw">
      <SidebarNew className="border-border border-r">
        <SidebarNew.Header>
          {state === 'collapsed' ? (
            <SidebarNew.Trigger />
          ) : (
            <>
              <SidebarNew.Brand logo={<LogoWithoutText className="size-6" />} title="Mastra Platform" />
              <SidebarNew.Trigger />
            </>
          )}
        </SidebarNew.Header>

        <ProjectPicker collapsed={state === 'collapsed'} />

        <SidebarNew.Nav>
          <SidebarNew.NavStack value={view} onValueChange={setView}>
            <SidebarNew.NavStack.Root>
              <SidebarNew.Sections
                sections={[
                  {
                    key: 'project',
                    links: [
                      { name: 'Overview', url: '/', icon: <Home /> },
                      { name: 'Workflows', url: '/workflows', icon: <Workflow /> },
                    ],
                  },
                  {
                    key: 'observability',
                    title: 'Observability',
                    links: [
                      { name: 'Metrics', url: '/metrics', icon: <MetricsIcon /> },
                      { name: 'Traces', url: '/traces', icon: <TraceIcon /> },
                      { name: 'Intelligence', url: '/intelligence', icon: <LayoutGrid /> },
                      { name: 'Logs', url: '/logs', icon: <LogsIcon /> },
                    ],
                  },
                  {
                    key: 'databases',
                    title: 'Databases',
                    links: [
                      { name: 'Overview', url: '/database', icon: <Database /> },
                      { name: 'Usage', url: '/database/usage', icon: <BarChart3 />, isActive: true },
                    ],
                  },
                  {
                    key: 'gateway',
                    title: 'Gateway',
                    links: [
                      { name: 'API keys', url: '/gateway', icon: <KeyRound /> },
                      { name: 'Usage', url: '/gateway/usage', icon: <BarChart3 /> },
                      { name: 'Threads', url: '/gateway/threads', icon: <MessageSquare /> },
                      { name: 'Logs', url: '/gateway/logs', icon: <LogsIcon /> },
                      { name: 'Code setup', url: '/gateway/code-setup', icon: <Code2 /> },
                      { name: 'Settings', url: '/gateway/settings', icon: <SlidersHorizontal /> },
                    ],
                  },
                  {
                    key: 'project-settings',
                    title: 'Project settings',
                    links: [
                      { name: 'General', url: '/settings', icon: <Settings /> },
                      { name: 'API tokens', url: '/settings/tokens', icon: <Wrench /> },
                    ],
                  },
                ]}
              />
            </SidebarNew.NavStack.Root>

            <SidebarNew.NavStack.View value="account-settings" title="Account settings" returnFocusRef={menuTriggerRef}>
              <SidebarNew.NavList>
                <SidebarNew.NavLink link={{ name: 'General', url: '/account', icon: <Settings /> }} isActive />
                <SidebarNew.NavLink link={{ name: 'API tokens', url: '/account/tokens', icon: <Wrench /> }} />
                <SidebarNew.NavLink link={{ name: 'Preferences', url: '/account/preferences', icon: <Bell /> }} />
              </SidebarNew.NavList>
            </SidebarNew.NavStack.View>

            <SidebarNew.NavStack.View
              value="organization-settings"
              title="Organization settings"
              returnFocusRef={menuTriggerRef}
            >
              <SidebarNew.NavList>
                <SidebarNew.NavLink link={{ name: 'General', url: '/organization', icon: <Settings /> }} isActive />
                <SidebarNew.NavLink link={{ name: 'Members', url: '/organization/members', icon: <Users /> }} />
                <SidebarNew.NavLink link={{ name: 'Billing', url: '/organization/billing', icon: <FileText /> }} />
              </SidebarNew.NavList>
            </SidebarNew.NavStack.View>
          </SidebarNew.NavStack>
        </SidebarNew.Nav>

        <SidebarNew.Footer>
          <SidebarNew.Meter
            label="Credits"
            value="$5"
            status="Auto top-ups Off"
            tone="neutral"
            href="/organization/billing"
            linkLabel="Credit balance"
          />
          <AccountMenu state={state} menuTriggerRef={menuTriggerRef} openSettings={openSettings} />
        </SidebarNew.Footer>
      </SidebarNew>

      <main className="min-w-0 flex-1 p-6">
        <SidebarNew.MobileTrigger className="mb-4" />
        <h1 className="text-header-md text-foreground font-medium">Main content</h1>
        <p className="text-ui-md text-muted-foreground mt-2">
          Primary navigation remains grouped. Account and organization settings take over only the sidebar body.
        </p>
      </main>
    </div>
  );
}

export const Default: Story = {
  render: () => <SidebarNewStory />,
};

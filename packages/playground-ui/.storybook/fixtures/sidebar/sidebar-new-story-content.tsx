import {
  AlertTriangle,
  Bell,
  Box,
  Database,
  FlaskConical,
  Home,
  Key,
  LayoutGrid,
  ListTodo,
  Plug,
  Search,
  Settings,
  Users,
  Waypoints,
  Workflow,
  Wrench,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Avatar } from '@/ds/components/Avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ds/components/Dialog';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { Input } from '@/ds/components/Input';
import { LogoWithoutText } from '@/ds/components/Logo';
import { LogsIcon, MetricsIcon, TraceIcon } from '@/ds/icons';
import { SidebarNew, useSidebarNew } from '@/ds/new/sidebar';
import { useKeydown } from '@/lib/keyboard/use-keydown';

export type SidebarNewStoryContentProps = {
  header?: 'default' | 'command';
  version?: string;
};

function SidebarSearchDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <SidebarNew.SearchTrigger aria-label="Search" shortcut="⌘ K">
          <Search />
        </SidebarNew.SearchTrigger>
      </DialogTrigger>
      <DialogContent className="new-theme border-border bg-popover text-foreground">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Find projects, pages, and settings.</DialogDescription>
        </DialogHeader>
        <Input aria-label="Search projects, pages, and settings" placeholder="Search" autoFocus />
      </DialogContent>
    </Dialog>
  );
}

export function SidebarNewStoryContent({ header = 'default', version }: SidebarNewStoryContentProps) {
  const { state, expand } = useSidebarNew();
  const [view, setView] = useState('root');
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  function openView(nextView: string) {
    expand();
    setView(nextView);
  }

  return (
    <>
      {header === 'command' ? (
        <SidebarNew.CommandHeader>
          <a
            href="/projects"
            aria-label="Project list"
            className="focus-visible:shadow-focus-ring focus-visible:ring-accent1 flex min-w-0 flex-1 rounded-md focus-visible:ring-1 focus-visible:outline-hidden"
          >
            <SidebarNew.Brand
              logo={<LogoWithoutText className="size-6" />}
              title={
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">Mastra</span>
                  <span className="bg-muted text-ui-xs text-muted-foreground inline-flex h-5 items-center rounded px-1.5 font-medium">
                    Beta
                  </span>
                </span>
              }
            />
          </a>
          <SidebarSearchDialog />
        </SidebarNew.CommandHeader>
      ) : (
        <SidebarNew.Header>
          {state === 'collapsed' ? (
            <div className="group/brand relative mx-auto grid size-9 place-items-center">
              <LogoWithoutText className="duration-normal size-6 transition-opacity group-hover/brand:opacity-0 motion-reduce:transition-none" />
              <div className="duration-normal absolute inset-0 opacity-0 transition-opacity group-hover/brand:opacity-100 focus-within:opacity-100 motion-reduce:transition-none">
                <SidebarNew.Trigger />
              </div>
            </div>
          ) : (
            <>
              <a
                href="/projects"
                aria-label="Project list"
                className="focus-visible:shadow-focus-ring focus-visible:ring-accent1 flex min-w-0 flex-1 rounded-md focus-visible:ring-1 focus-visible:outline-hidden"
              >
                <SidebarNew.Brand logo={<LogoWithoutText className="size-6" />} title="Mastra Platform" />
              </a>
              <span className="bg-muted text-ui-xs text-muted-foreground inline-flex h-5 items-center rounded-full px-2">
                Staging
              </span>
              <SidebarNew.Trigger />
            </>
          )}
        </SidebarNew.Header>
      )}

      <SidebarNew.Nav>
        <SidebarNew.NavStack value={view} onValueChange={setView}>
          <SidebarNew.NavStack.Root>
            <SidebarNew.Sections
              sections={[
                {
                  key: 'overview',
                  links: [{ name: 'Overview', url: '/', icon: <Home /> }],
                },
                {
                  key: 'observability',
                  title: 'Observability',
                  links: [
                    { name: 'Metrics', url: '/metrics', icon: <MetricsIcon /> },
                    { name: 'Traces', url: '/traces', icon: <TraceIcon />, isActive: true },
                    { name: 'Intelligence', url: '/intelligence', icon: <LayoutGrid /> },
                    { name: 'Logs', url: '/logs', icon: <LogsIcon /> },
                  ],
                },
                {
                  key: 'infrastructure',
                  title: 'Infrastructure',
                  links: [
                    { name: 'Deploys', url: '/deploys', icon: <Box /> },
                    { name: 'Gateway', url: '/gateway', icon: <Workflow /> },
                    { name: 'Databases', url: '/databases', icon: <Database /> },
                  ],
                  moreLinks: [
                    { name: 'Tools', url: '/tools', icon: <Wrench /> },
                    { name: 'Workspaces', url: '/workspaces', icon: <LayoutGrid /> },
                  ],
                },
                {
                  key: 'evals',
                  title: 'Evals',
                  links: [{ name: 'Experiments', url: '/experiments', icon: <FlaskConical /> }],
                },
                {
                  key: 'agent-learning',
                  title: 'Agent Learning',
                  links: [{ name: 'Issues', url: '/issues', icon: <ListTodo /> }],
                },
                {
                  key: 'project-settings',
                  separator: true,
                  links: [
                    { name: 'Environments', url: '/environments', icon: <Waypoints /> },
                    { name: 'Settings', url: '/settings', icon: <Settings /> },
                  ],
                },
              ]}
            />
          </SidebarNew.NavStack.Root>

          <SidebarNew.NavStack.View value="gateway" title="Gateway" returnFocusRef={menuTriggerRef}>
            <SidebarNew.NavList>
              <SidebarNew.NavLink link={{ name: 'API keys', url: '/gateway/api-keys', icon: <Key /> }} isActive />
              <SidebarNew.NavLink link={{ name: 'Usage', url: '/gateway/usage', icon: <MetricsIcon /> }} />
              <SidebarNew.NavLink link={{ name: 'Threads', url: '/gateway/threads', icon: <Workflow /> }} />
              <SidebarNew.NavLink link={{ name: 'Logs', url: '/gateway/logs', icon: <LogsIcon /> }} />
              <SidebarNew.NavLink link={{ name: 'Settings', url: '/gateway/settings', icon: <Settings /> }} />
            </SidebarNew.NavList>
          </SidebarNew.NavStack.View>

          <SidebarNew.NavStack.View value="environments" title="Environments" returnFocusRef={menuTriggerRef}>
            <SidebarNew.NavList>
              <SidebarNew.NavLink link={{ name: 'Environments', url: '/environments', icon: <Waypoints /> }} isActive />
              <SidebarNew.NavLink link={{ name: 'Environment variables', url: '/variables', icon: <Key /> }} />
            </SidebarNew.NavList>
          </SidebarNew.NavStack.View>

          <SidebarNew.NavStack.View value="settings" title="Settings" returnFocusRef={menuTriggerRef}>
            <SidebarNew.NavList>
              <SidebarNew.NavLink link={{ name: 'General', url: '/settings', icon: <Settings /> }} isActive />
              <SidebarNew.NavLink link={{ name: 'Connect', url: '/settings/connect', icon: <Plug /> }} />
            </SidebarNew.NavList>
          </SidebarNew.NavStack.View>
        </SidebarNew.NavStack>
      </SidebarNew.Nav>

      <SidebarNew.Footer className="flex flex-col gap-1.5 pb-1">
        <SidebarNew.Meter
          label="Credits"
          value="$4"
          status="Credits are low"
          tone="warning"
          icon={<AlertTriangle className="text-notice-warning size-3 shrink-0" aria-hidden />}
          href="/organization/billing"
          linkLabel="Credit balance"
        />
        <DropdownMenu>
          <SidebarNew.NavList>
            <SidebarNew.NavLink
              link={{ name: 'Justin Levine', url: '#', icon: <Avatar name="Justin Levine" size="sm" /> }}
              render={
                <DropdownMenu.Trigger
                  ref={menuTriggerRef}
                  aria-label={state === 'collapsed' ? 'Justin Levine menu' : undefined}
                >
                  <Avatar name="Justin Levine" size="sm" />
                  <SidebarNew.NavLabel state={state}>Justin Levine</SidebarNew.NavLabel>
                </DropdownMenu.Trigger>
              }
            />
          </SidebarNew.NavList>
          <DropdownMenu.Content
            align="start"
            sideOffset={8}
            className="new-theme border-border bg-popover text-foreground w-64"
          >
            <div className="text-ui-xs text-muted-foreground px-2 py-1">justin@mastra.ai</div>
            <DropdownMenu.Separator />
            <DropdownMenu.Item onSelect={() => openView('gateway')}>
              <Workflow />
              Gateway
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => openView('environments')}>
              <Waypoints />
              Environments
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => openView('settings')}>
              <Settings />
              Settings
            </DropdownMenu.Item>
            <DropdownMenu.Separator />
            <div className="text-ui-xs text-muted-foreground px-2 py-1">Mastra</div>
            <DropdownMenu.Item>
              <Users />
              Organization settings
            </DropdownMenu.Item>
            <DropdownMenu.Item>
              <Bell />
              Notifications
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu>
        {header === 'command' || version ? (
          <SidebarNew.FooterMeta action={header === 'command' ? <SidebarNew.Trigger /> : undefined}>
            {version}
          </SidebarNew.FooterMeta>
        ) : null}
      </SidebarNew.Footer>
    </>
  );
}

export function SidebarNewStoryShortcuts() {
  const { toggleSidebar } = useSidebarNew();
  useKeydown({ '[': toggleSidebar });
  return null;
}

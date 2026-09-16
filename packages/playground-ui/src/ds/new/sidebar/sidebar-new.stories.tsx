import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertTriangle, Bell, FileText, Home, Settings, Users, Workflow, Wrench } from 'lucide-react';
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

function SidebarNewStory() {
  const { state, expand } = useSidebarNew();
  const [view, setView] = useState('root');
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  function openSettings(nextView: string) {
    expand();
    setView(nextView);
  }

  return (
    <div className="mastra-theme bg-mastra-background flex h-dvh w-dvw">
      <SidebarNew className="border-mastra-border border-r">
        <SidebarNew.Header>
          {state === 'collapsed' ? (
            <SidebarNew.Trigger />
          ) : (
            <>
              <SidebarNew.Brand logo={<LogoWithoutText className="size-6" />} title="Mastra" />
              <span className="bg-surface4 text-ui-xs text-neutral4 inline-flex h-5 items-center rounded-full px-2">
                Staging
              </span>
              <SidebarNew.Trigger />
            </>
          )}
        </SidebarNew.Header>

        <SidebarNew.Nav>
          <SidebarNew.NavStack value={view} onValueChange={setView}>
            <SidebarNew.NavStack.Root>
              <SidebarNew.Sections
                sections={[
                  {
                    key: 'project',
                    title: 'Project',
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
                      { name: 'Traces', url: '/traces', icon: <TraceIcon />, isActive: true },
                      { name: 'Logs', url: '/logs', icon: <LogsIcon /> },
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

        <SidebarNew.Footer className="space-y-1.5 pb-1">
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
                  <DropdownMenu.Trigger ref={menuTriggerRef}>
                    <Avatar name="Justin Levine" size="sm" />
                    <SidebarNew.NavLabel state={state}>Justin Levine</SidebarNew.NavLabel>
                  </DropdownMenu.Trigger>
                }
              />
            </SidebarNew.NavList>
            <DropdownMenu.Content
              align="start"
              sideOffset={8}
              className="mastra-theme border-mastra-border bg-mastra-popover text-mastra-foreground w-64"
            >
              <div className="text-ui-xs text-neutral3 px-2 py-1">justin@mastra.ai</div>
              <DropdownMenu.Separator />
              <DropdownMenu.Item onSelect={() => openSettings('account-settings')}>
                <Settings />
                Account settings
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <div className="text-ui-xs text-neutral3 px-2 py-1">Mastra</div>
              <DropdownMenu.Item onSelect={() => openSettings('organization-settings')}>
                <Users />
                Organization settings
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </SidebarNew.Footer>
      </SidebarNew>

      <main className="min-w-0 flex-1 p-6">
        <SidebarNew.MobileTrigger className="mb-4" />
        <h1 className="text-header-md text-neutral6 font-medium">Main content</h1>
        <p className="text-ui-md text-neutral4 mt-2">
          Primary navigation remains grouped. Account and organization settings take over only the sidebar body.
        </p>
      </main>
    </div>
  );
}

export const Default: Story = {
  render: () => <SidebarNewStory />,
};

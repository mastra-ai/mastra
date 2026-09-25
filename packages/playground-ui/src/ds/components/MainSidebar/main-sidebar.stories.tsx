import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Brain,
  CalendarClock,
  Home,
  Bot,
  Workflow,
  Settings,
  Database,
  FileText,
  History,
  Users,
  Bell,
  LifeBuoy,
  BookOpen,
  Radio,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { useState, forwardRef } from 'react';
import { TooltipProvider } from '../Tooltip';
import { getIsLinkActive, MainSidebar, MainSidebarProvider, useMainSidebar } from './main-sidebar';
import type { MainSidebarProviderProps, NavSection } from './main-sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ds/components/Dialog';
import { LogoWithoutText } from '@/ds/components/Logo';
import {
  AgentIcon,
  DatasetsIcon,
  ExperimentsIcon,
  LogsIcon,
  McpServerIcon,
  MetricsIcon,
  ProcessorIcon,
  PromptIcon,
  RequestContextIcon,
  ScorersIcon,
  SettingsIcon,
  ToolsIcon,
  TraceIcon,
  WorkflowIcon,
  WorkspacesIcon,
} from '@/ds/icons';
import { raisedSurfaceStyle } from '@/ds/primitives/raised-surface';
import type { LinkComponentProps } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

const StoryLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href, children, ...props }, ref) => (
  <a ref={ref} href={href} {...props}>
    {children}
  </a>
));

/* ------------------------------------------------------------------------- */
/* Layout frames — plain components so `render` source shows the real markup */
/* ------------------------------------------------------------------------- */

const HelperCopy = () => (
  <>
    <p className="text-subheading text-foreground">Main content area</p>
    <p className="mt-2 max-w-[40ch] text-caption text-muted-foreground">
      Hover the sidebar edge to reveal the handle. Drag to resize, or click to toggle.
    </p>
  </>
);

const DefaultFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-125 w-210 rounded-lg border border-border bg-sidebar">
    {children}
    <div className="min-w-0 flex-1 p-6">
      <HelperCopy />
    </div>
  </div>
);

const StudioFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-180 w-270 overflow-hidden bg-sidebar">
    {children}
    <main className="flex min-w-0 flex-1 flex-col pr-1.5 pb-1.5 lg:pr-2 lg:pb-2">
      <header className="mx-2 mt-1.5 flex h-12 shrink-0 items-center justify-between px-3">
        <div className="min-w-0">
          <p className="truncate text-heading text-foreground">Traces</p>
          <p className="truncate text-meta text-muted-foreground">Observability / Traces</p>
        </div>
        <span className="rounded-md border border-border bg-card px-2.5 py-1 text-meta text-foreground">Live</span>
      </header>
      <section className="min-h-0 flex-1 overflow-y-auto rounded-studio-frame bg-card shadow-raised [--studio-frame-inset:0.5rem] [--studio-frame-radius:1.5rem]">
        <div className="grid min-h-full grid-rows-[auto_minmax(0,1fr)] gap-4 p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Trace volume', '1,284'],
              ['p95 latency', '428ms'],
              ['Error rate', '0.8%'],
            ].map(([label, value]) => (
              <div key={label} className={`${raisedSurfaceStyle} rounded-studio-panel p-4`}>
                <p className="text-meta text-muted-foreground uppercase">{label}</p>
                <p className="mt-2 text-title text-foreground">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_280px] gap-4">
            <div className={`${raisedSurfaceStyle} min-h-0 rounded-studio-panel p-4`}>
              <div className="mb-4 flex items-center justify-between">
                <p className="text-subheading text-foreground">Recent spans</p>
                <p className="text-meta text-muted-foreground">Updated now</p>
              </div>
              <div className="grid gap-2">
                {['agent.generate', 'tool.weather.lookup', 'workflow.evaluate', 'llm.call'].map((name, index) => (
                  <div
                    key={name}
                    className="grid grid-cols-[minmax(0,1fr)_80px_64px] items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <span className="truncate text-caption text-foreground">{name}</span>
                    <span className="text-right text-meta text-muted-foreground">
                      {index === 1 ? '91ms' : `${220 + index * 56}ms`}
                    </span>
                    <span className="text-right text-meta text-accent1">ok</span>
                  </div>
                ))}
              </div>
            </div>
            <aside className={`${raisedSurfaceStyle} min-h-0 rounded-studio-panel p-4`}>
              <p className="text-subheading text-foreground">Trace detail</p>
              <dl className="mt-4 grid gap-3 text-caption">
                <div>
                  <dt className="text-muted-foreground">Service</dt>
                  <dd className="mt-1 text-foreground">studio</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Environment</dt>
                  <dd className="mt-1 text-foreground">development</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="mt-1 text-foreground">Completed</dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </section>
    </main>
  </div>
);

const MobileFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-screen w-screen flex-col overflow-hidden bg-sidebar">
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
      <MainSidebar.MobileTrigger />
      <span className="text-subheading text-foreground">Mastra Studio</span>
    </header>
    {children}
    <div className="min-w-0 flex-1 p-4">
      <p className="text-subheading text-foreground">Mobile viewport</p>
      <p className="mt-2 max-w-[34ch] text-caption text-muted-foreground">
        Switch viewports in the toolbar. The sidebar auto-detects via <code>matchMedia</code> against the iframe
        viewport — no manual prop needed.
      </p>
    </div>
  </div>
);

/* ------------------------------------------------------------------------- */
/* Decorator — providers only (TooltipProvider + MainSidebarProvider).        */
/* The frame lives inside `render` so Storybook's "Show code" is accurate.    */
/* ------------------------------------------------------------------------- */

const withProvider = (provider?: Omit<MainSidebarProviderProps, 'children'>) => (Story: React.ComponentType) => (
  <TooltipProvider>
    <MainSidebarProvider LinkComponent={StoryLink} {...provider}>
      <Story />
    </MainSidebarProvider>
  </TooltipProvider>
);

const studioSections: NavSection[] = [
  {
    key: 'primitives',
    title: 'Primitives',
    links: [
      { name: 'Agents', url: '/agents', icon: <AgentIcon /> },
      { name: 'Prompts', url: '/prompts', icon: <PromptIcon /> },
      { name: 'Workflows', url: '/workflows', icon: <WorkflowIcon /> },
      { name: 'Processors', url: '/processors', icon: <ProcessorIcon /> },
      { name: 'MCP Servers', url: '/mcps', icon: <McpServerIcon /> },
      { name: 'Tools', url: '/tools', icon: <ToolsIcon /> },
      { name: 'Workspaces', url: '/workspaces', icon: <WorkspacesIcon /> },
      { name: 'Request Context', url: '/request-context', icon: <RequestContextIcon /> },
    ],
  },
  {
    key: 'evaluation',
    title: 'Evaluation',
    links: [
      { name: 'Scorers', url: '/scorers', icon: <ScorersIcon /> },
      { name: 'Datasets', url: '/datasets', icon: <DatasetsIcon /> },
      { name: 'Experiments', url: '/experiments', icon: <ExperimentsIcon /> },
    ],
  },
  {
    key: 'observability',
    title: 'Observability',
    links: [
      { name: 'Metrics', url: '/metrics', icon: <MetricsIcon /> },
      { name: 'Traces', url: '/traces', icon: <TraceIcon /> },
      { name: 'Logs', url: '/logs', icon: <LogsIcon /> },
    ],
  },
];

const StudioSidebarBody = () => {
  const { state, isMobile } = useMainSidebar();
  const activePath = '/traces/live';

  return (
    <MainSidebar>
      <div className="mb-2 pt-2">
        {state === 'collapsed' ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative grid size-9 place-items-center">
              <LogoWithoutText
                className={cn(
                  'size-[1.5rem] shrink-0 transition-opacity duration-150',
                  !isMobile && 'group-hover/sidebar:opacity-0',
                )}
              />
              {!isMobile && (
                <div className="absolute inset-0 opacity-0 transition-opacity duration-150 group-hover/sidebar:opacity-100">
                  <MainSidebar.Trigger />
                </div>
              )}
            </div>
            <span className="size-6 rounded-full border border-border bg-muted" aria-label="Signed in" />
          </div>
        ) : (
          <span className="flex items-center justify-between pr-2 pl-3">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <LogoWithoutText className="size-[1.5rem] shrink-0" />
              <span className="truncate font-display text-subheading tracking-tight whitespace-nowrap">
                Mastra Studio
              </span>
              {!isMobile && <MainSidebar.Trigger />}
            </span>
            <span className="size-7 rounded-full border border-border bg-muted" aria-label="Signed in" />
          </span>
        )}
      </div>

      <div className="mb-2">
        <MainSidebar.NavList>
          <MainSidebar.NavLink asChild state={state} link={{ name: 'Search', url: '#', icon: <Search /> }}>
            <button
              type="button"
              aria-label="Search and navigate"
              className={`${raisedSurfaceStyle} state-layer text-foreground hover:text-foreground [&_svg]:text-muted-foreground [&:hover_svg]:text-foreground`}
            >
              <Search />
              <MainSidebar.NavLabel state={state}>Search</MainSidebar.NavLabel>
              {state !== 'collapsed' && (
                <kbd
                  aria-hidden="true"
                  className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-meta leading-none text-muted-foreground"
                >
                  ⌘K
                </kbd>
              )}
            </button>
          </MainSidebar.NavLink>
        </MainSidebar.NavList>
      </div>

      <div className="mb-1">
        <MainSidebar.NavList>
          <MainSidebar.NavLink
            state={state}
            link={{ name: 'Agent Builder', url: '/agent-builder', icon: <Wrench /> }}
          />
        </MainSidebar.NavList>
      </div>

      <MainSidebar.Nav>
        <MainSidebar.Sections
          sections={studioSections}
          isActive={(link, siblings) => getIsLinkActive(link, activePath, siblings)}
        />
      </MainSidebar.Nav>

      <MainSidebar.Bottom className="pb-3">
        <MainSidebar.NavList>
          <MainSidebar.NavLink state={state} link={{ name: 'Settings', url: '/settings', icon: <SettingsIcon /> }} />
          <MainSidebar.NavLink state={state} link={{ name: 'Resources', url: '/resources', icon: <BookOpen /> }} />
        </MainSidebar.NavList>
        {state !== 'collapsed' && (
          <>
            <hr className="mx-6 my-2 h-px border-0 bg-border" />
            <span className="ml-3 inline-flex h-5 items-center rounded-full bg-fill px-2.5 font-body text-meta leading-none text-muted-foreground">
              v0.0.0
            </span>
          </>
        )}
      </MainSidebar.Bottom>
    </MainSidebar>
  );
};

const meta: Meta<typeof MainSidebar> = {
  title: 'Layout/MainSidebar',
  component: MainSidebar,
  decorators: [withProvider()],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MainSidebar>;

export const Default: Story = {
  render: () => (
    <DefaultFrame>
      <MainSidebar className="border-r border-border bg-background">
        <MainSidebar.Nav>
          <MainSidebar.NavSection>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Home', url: '/', icon: <Home /> }} isActive />
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents', icon: <Bot /> }} />
              <MainSidebar.NavLink link={{ name: 'Workflows', url: '/workflows', icon: <Workflow /> }} />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        </MainSidebar.Nav>
        <MainSidebar.Bottom>
          <MainSidebar.Trigger />
        </MainSidebar.Bottom>
      </MainSidebar>
    </DefaultFrame>
  ),
};

export const WithSections: Story = {
  render: () => (
    <DefaultFrame>
      <MainSidebar className="border-r border-border bg-background">
        <MainSidebar.Nav>
          <MainSidebar.NavSection>
            <MainSidebar.NavHeader>Main</MainSidebar.NavHeader>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Dashboard', url: '/', icon: <Home /> }} isActive />
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents', icon: <Bot /> }} />
              <MainSidebar.NavLink link={{ name: 'Workflows', url: '/workflows', icon: <Workflow /> }} />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>

          <MainSidebar.NavSeparator />

          <MainSidebar.NavSection>
            <MainSidebar.NavHeader>Data</MainSidebar.NavHeader>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Storage', url: '/storage', icon: <Database /> }} />
              <MainSidebar.NavLink link={{ name: 'Logs', url: '/logs', icon: <FileText /> }} />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        </MainSidebar.Nav>
        <MainSidebar.Bottom>
          <MainSidebar.Trigger />
        </MainSidebar.Bottom>
      </MainSidebar>
    </DefaultFrame>
  ),
};

export const WithNestedItems: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`MainSidebar.Sections` accepts `children` on a link for nested navigation. Parent rows remain real links, child rows render as subitems, nested rows can include their own icons, and `getIsLinkActive` keeps descendant routes from highlighting the parent at the same time.',
      },
    },
  },
  render: () => (
    <DefaultFrame>
      <MainSidebar className="border-r border-border bg-background">
        <MainSidebar.Nav>
          <MainSidebar.Sections
            sections={[
              {
                key: 'workspace',
                title: 'Workspace',
                links: [
                  {
                    name: 'Agents',
                    url: '/agents',
                    icon: <Bot />,
                    children: [
                      { name: 'Templates', url: '/agents/templates', icon: <Sparkles /> },
                      { name: 'Memory', url: '/agents/memory', icon: <Brain /> },
                      { name: 'Channels', url: '/agents/channels', icon: <Radio /> },
                    ],
                  },
                  {
                    name: 'Workflows',
                    url: '/workflows',
                    icon: <Workflow />,
                    children: [
                      { name: 'Runs', url: '/workflows/runs', icon: <History /> },
                      { name: 'Schedules', url: '/workflows/schedules', icon: <CalendarClock /> },
                    ],
                  },
                ],
              },
              {
                key: 'settings',
                title: 'Admin',
                separator: true,
                links: [{ name: 'Settings', url: '/settings', icon: <Settings /> }],
              },
            ]}
            isActive={(link, siblings) => getIsLinkActive(link, '/agents/templates', siblings)}
          />
        </MainSidebar.Nav>
        <MainSidebar.Bottom>
          <MainSidebar.Trigger />
        </MainSidebar.Bottom>
      </MainSidebar>
    </DefaultFrame>
  ),
};

export const WithBottom: Story = {
  render: () => (
    <DefaultFrame>
      <MainSidebar className="border-r border-border bg-background">
        <MainSidebar.Nav>
          <MainSidebar.NavSection>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Home', url: '/', icon: <Home /> }} isActive />
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents', icon: <Bot /> }} />
              <MainSidebar.NavLink link={{ name: 'Workflows', url: '/workflows', icon: <Workflow /> }} />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        </MainSidebar.Nav>

        <MainSidebar.Bottom>
          <MainSidebar.NavList>
            <MainSidebar.NavLink link={{ name: 'Team', url: '/team', icon: <Users /> }} />
            <MainSidebar.NavLink link={{ name: 'Notifications', url: '/notifications', icon: <Bell /> }} />
            <MainSidebar.NavLink link={{ name: 'Settings', url: '/settings', icon: <Settings /> }} />
          </MainSidebar.NavList>
          <MainSidebar.Trigger />
        </MainSidebar.Bottom>
      </MainSidebar>
    </DefaultFrame>
  ),
};

export const FullSidebar: Story = {
  name: 'Studio full sidebar',
  decorators: [withProvider({ defaultWidth: 272, minWidth: 232, maxWidth: 420, collapseBelow: 200 })],
  parameters: {
    docs: {
      description: {
        story:
          'Full Studio shell using the same sidebar composition pattern as `AppSidebar`: brand header, command search, Agent Builder link, primary sections, bottom links, and main content layout.',
      },
    },
  },
  render: () => (
    <StudioFrame>
      <StudioSidebarBody />
    </StudioFrame>
  ),
};

/* ------------------------------------------------------------------------- */
/* Resizable / Collapsed variants — NavLink/NavHeader auto-inherit state      */
/* ------------------------------------------------------------------------- */

const SidebarBody = () => (
  <MainSidebar className="border-r border-border bg-background">
    <MainSidebar.Nav>
      <MainSidebar.NavSection>
        <MainSidebar.NavHeader>Workspace</MainSidebar.NavHeader>
        <MainSidebar.NavList>
          <MainSidebar.NavLink link={{ name: 'Overview', url: '/', icon: <Home /> }} isActive />
          <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents', icon: <Bot /> }} />
          <MainSidebar.NavLink link={{ name: 'Workflows', url: '/workflows', icon: <Workflow /> }} />
        </MainSidebar.NavList>
      </MainSidebar.NavSection>
    </MainSidebar.Nav>
    <MainSidebar.Bottom>
      <MainSidebar.Trigger />
    </MainSidebar.Bottom>
  </MainSidebar>
);

export const Resizable: Story = {
  decorators: [withProvider({ defaultWidth: 260, minWidth: 200, maxWidth: 420, collapseBelow: 180 })],
  parameters: {
    docs: {
      description: {
        story:
          'Drag the right edge to resize between min and max width. Width is persisted to `localStorage` under `sidebar:width`. Dragging below `collapseBelow` snaps the sidebar to its collapsed state; the toggle restores the last expanded width.',
      },
    },
  },
  render: () => (
    <DefaultFrame>
      <SidebarBody />
    </DefaultFrame>
  ),
};

export const Collapsed: Story = {
  decorators: [withProvider({ defaultState: 'collapsed' })],
  parameters: {
    docs: {
      description: {
        story:
          'Icon-only mode. `NavLink` and `NavHeader` both render compact when their `state` prop (or context state) is `"collapsed"`. Use the trigger to expand.',
      },
    },
  },
  render: () => (
    <DefaultFrame>
      <SidebarBody />
    </DefaultFrame>
  ),
};

export const FullyCollapsible: Story = {
  decorators: [
    withProvider({
      defaultWidth: 280,
      minWidth: 220,
      maxWidth: 420,
      collapseBelow: 160,
      collapsedWidth: 0,
    }),
  ],
  parameters: {
    docs: {
      description: {
        story:
          'Set `collapsedWidth: 0` for a fully hidden sidebar. The drag handle persists at the edge so users can re-open it. Drag below `collapseBelow` to snap closed; click the handle to restore the previous width.',
      },
    },
  },
  render: () => (
    <DefaultFrame>
      <SidebarBody />
    </DefaultFrame>
  ),
};

/* ------------------------------------------------------------------------- */
/* Floating variant — consumer composition, not a new prop                   */
/* ------------------------------------------------------------------------- */

export const Floating: Story = {
  decorators: [withProvider({ defaultWidth: 240, minWidth: 200, maxWidth: 400, collapseBelow: 180 })],
  parameters: {
    docs: {
      description: {
        story:
          'Floating variant via pure composition: parent gets `m-3` and `gap-3`, the `MainSidebar` gets `rounded-2xl shadow-raised`. Works with resize, collapse, and mobile drawer exactly like the default variant.',
      },
    },
  },
  render: () => (
    <DefaultFrame>
      <MainSidebar className="m-1 rounded-2xl bg-card shadow-raised">
        <MainSidebar.Nav>
          <MainSidebar.NavSection>
            <MainSidebar.NavHeader>Workspace</MainSidebar.NavHeader>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Overview', url: '/', icon: <Home /> }} isActive />
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents', icon: <Bot /> }} />
              <MainSidebar.NavLink link={{ name: 'Workflows', url: '/workflows', icon: <Workflow /> }} />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        </MainSidebar.Nav>
        <MainSidebar.Bottom>
          <MainSidebar.Trigger />
        </MainSidebar.Bottom>
      </MainSidebar>
    </DefaultFrame>
  ),
};

/* ------------------------------------------------------------------------- */
/* State parity — expanded vs collapsed side-by-side                         */
/* ------------------------------------------------------------------------- */

const ParityFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-125 w-210 gap-4 rounded-lg border border-border bg-sidebar p-3">{children}</div>
);

const ParityBody = () => (
  <MainSidebar className="rounded-md border border-border bg-background">
    <MainSidebar.Nav>
      <MainSidebar.NavSection>
        <MainSidebar.NavHeader>Workspace</MainSidebar.NavHeader>
        <MainSidebar.NavList>
          <MainSidebar.NavLink link={{ name: 'Overview', url: '/', icon: <Home /> }} isActive />
          <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents', icon: <Bot /> }} />
          <MainSidebar.NavLink link={{ name: 'Workflows', url: '/workflows', icon: <Workflow /> }} />
        </MainSidebar.NavList>
      </MainSidebar.NavSection>
    </MainSidebar.Nav>
    <MainSidebar.Bottom>
      <MainSidebar.NavList>
        <MainSidebar.NavLink link={{ name: 'Settings', url: '/settings', icon: <Settings /> }} />
      </MainSidebar.NavList>
      <MainSidebar.Trigger />
    </MainSidebar.Bottom>
  </MainSidebar>
);

export const StateParity: Story = {
  // No global decorator — each panel owns its own provider so the two
  // sidebars can render in opposite states simultaneously.
  decorators: [Story => <TooltipProvider>{Story()}</TooltipProvider>],
  parameters: {
    docs: {
      description: {
        story:
          'Side-by-side expanded vs collapsed. NavLink rows and the Trigger all share **h-7 (28px)** so toggling collapse never reflows surrounding rows. Use this story to visually verify row alignment.',
      },
    },
  },
  render: () => (
    <ParityFrame>
      <MainSidebarProvider defaultState="default" storageKey="story:parity-expanded">
        <ParityBody />
      </MainSidebarProvider>
      <MainSidebarProvider defaultState="collapsed" storageKey="story:parity-collapsed">
        <ParityBody />
      </MainSidebarProvider>
    </ParityFrame>
  ),
};

/* ------------------------------------------------------------------------- */
/* Mobile drawer                                                             */
/* ------------------------------------------------------------------------- */

/* ------------------------------------------------------------------------- */
/* asChild — slot any element (button, custom Link, anything) as the item.    */
/* ------------------------------------------------------------------------- */

export const AsChild: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`MainSidebar.NavLink` accepts `asChild`. The slotted child receives the full row styling, so a `<button>`, a custom `<Link>`, or any element behaves identically to the default anchor — without needing to wrap or override styles. Active state, indicator bar, hover, focus ring, and collapsed icon-only mode all apply automatically.',
      },
    },
  },
  render: () => {
    function SidebarBodyAsChild() {
      const [activeKey, setActiveKey] = useState('home');
      const [supportOpen, setSupportOpen] = useState(false);

      return (
        <MainSidebar className="border-r border-border bg-background">
          <MainSidebar.Nav>
            <MainSidebar.NavSection>
              <MainSidebar.NavHeader>Navigation</MainSidebar.NavHeader>
              <MainSidebar.NavList>
                {/* Default anchor (link={...}) */}
                <MainSidebar.NavLink
                  link={{ name: 'Home', url: '/', icon: <Home /> }}
                  isActive={activeKey === 'home'}
                />

                {/* asChild: <button> as the item — fires onClick instead of navigating. */}
                <MainSidebar.NavLink asChild isActive={activeKey === 'agents'}>
                  <button type="button" onClick={() => setActiveKey('agents')}>
                    <Bot />
                    <MainSidebar.NavLabel>Agents (button)</MainSidebar.NavLabel>
                  </button>
                </MainSidebar.NavLink>

                {/* asChild: opens a Dialog. Replaces the old `<div onClick>` wrapper hack. */}
                <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
                  <DialogTrigger asChild>
                    <MainSidebar.NavLink asChild>
                      <button type="button">
                        <LifeBuoy />
                        <MainSidebar.NavLabel>Contact support</MainSidebar.NavLabel>
                      </button>
                    </MainSidebar.NavLink>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Contact support</DialogTitle>
                      <DialogDescription>asChild lets a NavLink act as a Dialog trigger.</DialogDescription>
                    </DialogHeader>
                    <p className="text-caption text-muted-foreground">
                      Anything that can be clicked can be a sidebar item.
                    </p>
                  </DialogContent>
                </Dialog>

                {/* asChild: external link with custom attrs. */}
                <MainSidebar.NavLink asChild>
                  <a href="https://mastra.ai/docs" target="_blank" rel="noreferrer">
                    <BookOpen />
                    <MainSidebar.NavLabel>Docs (custom anchor)</MainSidebar.NavLabel>
                  </a>
                </MainSidebar.NavLink>
              </MainSidebar.NavList>
            </MainSidebar.NavSection>
          </MainSidebar.Nav>

          <MainSidebar.Bottom>
            <MainSidebar.Trigger />
          </MainSidebar.Bottom>
        </MainSidebar>
      );
    }

    return (
      <DefaultFrame>
        <SidebarBodyAsChild />
      </DefaultFrame>
    );
  },
};

export const Mobile: Story = {
  decorators: [withProvider()],
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        story:
          'Below `mobileBreakpoint` (default `1024px`), `MainSidebar` renders as an off-canvas drawer. Use the viewport toolbar to switch between mobile/tablet/desktop — the sidebar reacts via `matchMedia`, no story-level overrides required. Place `MainSidebar.MobileTrigger` in your top bar; it only renders on mobile.',
      },
    },
  },
  render: () => (
    <MobileFrame>
      <MainSidebar className="border-r border-border bg-background">
        <MainSidebar.Nav>
          <MainSidebar.NavSection>
            <MainSidebar.NavHeader>Workspace</MainSidebar.NavHeader>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Overview', url: '/', icon: <Home /> }} isActive />
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents', icon: <Bot /> }} />
              <MainSidebar.NavLink link={{ name: 'Workflows', url: '/workflows', icon: <Workflow /> }} />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        </MainSidebar.Nav>
      </MainSidebar>
    </MobileFrame>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { Home, Bot, Workflow, Settings, Database, FileText, Users, Bell, LifeBuoy, BookOpen } from 'lucide-react';
import { useState, forwardRef } from 'react';
import { TooltipProvider } from '../Tooltip';
import { MainSidebar, MainSidebarProvider } from './main-sidebar';
import type { MainSidebarProviderProps } from './main-sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ds/components/Dialog';
import type { LinkComponentProps } from '@/ds/types/link-component';

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
    <p className="text-neutral5 text-ui-md font-medium">Main content area</p>
    <p className="text-neutral4 text-ui-sm mt-2 max-w-[40ch]">
      Hover the sidebar edge to reveal the handle. Drag to resize, click to toggle, or hit{' '}
      <kbd className="rounded bg-surface5 px-1 font-mono text-[0.65rem] text-neutral4">⌘B</kbd>.
    </p>
  </>
);

const DefaultFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-[500px] w-[840px] bg-surface1 border border-border1 rounded-lg">
    {children}
    <div className="flex-1 min-w-0 p-6">
      <HelperCopy />
    </div>
  </div>
);

const MobileFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col h-screen w-screen bg-surface1 overflow-hidden">
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border1 px-3">
      <MainSidebar.MobileTrigger />
      <span className="text-neutral6 text-sm font-medium">Mastra Studio</span>
    </header>
    {children}
    <div className="flex-1 min-w-0 p-4">
      <p className="text-neutral5 text-ui-md font-medium">Mobile viewport</p>
      <p className="text-neutral4 text-ui-sm mt-2 max-w-[34ch]">
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
      <MainSidebar className="border-r border-border1 bg-surface2">
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
      <MainSidebar className="border-r border-border1 bg-surface2">
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

export const WithBottom: Story = {
  render: () => (
    <DefaultFrame>
      <MainSidebar className="border-r border-border1 bg-surface2">
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
  render: () => (
    <DefaultFrame>
      <MainSidebar className="border-r border-border1 bg-surface2">
        <MainSidebar.Nav>
          <MainSidebar.NavSection>
            <MainSidebar.NavHeader>Workspace</MainSidebar.NavHeader>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Overview', url: '/', icon: <Home /> }} isActive />
              <MainSidebar.NavLink link={{ name: 'Agents', url: '/agents', icon: <Bot /> }} />
              <MainSidebar.NavLink link={{ name: 'Workflows', url: '/workflows', icon: <Workflow /> }} />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>

          <MainSidebar.NavSeparator />

          <MainSidebar.NavSection>
            <MainSidebar.NavHeader>Resources</MainSidebar.NavHeader>
            <MainSidebar.NavList>
              <MainSidebar.NavLink link={{ name: 'Storage', url: '/storage', icon: <Database /> }} />
              <MainSidebar.NavLink link={{ name: 'Logs', url: '/logs', icon: <FileText /> }} />
            </MainSidebar.NavList>
          </MainSidebar.NavSection>
        </MainSidebar.Nav>

        <MainSidebar.Bottom>
          <MainSidebar.NavSeparator />
          <MainSidebar.NavList>
            <MainSidebar.NavLink link={{ name: 'Settings', url: '/settings', icon: <Settings /> }} />
          </MainSidebar.NavList>
          <MainSidebar.Trigger />
        </MainSidebar.Bottom>
      </MainSidebar>
    </DefaultFrame>
  ),
};

/* ------------------------------------------------------------------------- */
/* Resizable / Collapsed variants — NavLink/NavHeader auto-inherit state      */
/* ------------------------------------------------------------------------- */

const SidebarBody = () => (
  <MainSidebar className="border-r border-border1 bg-surface2">
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
          'Drag the right edge to resize between min and max width. Width is persisted to `localStorage` under `sidebar:width`. Dragging below `collapseBelow` snaps the sidebar to its collapsed state; the toggle (or `Ctrl+B`) restores the last expanded width.',
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
          'Icon-only mode. `NavLink` and `NavHeader` both render compact when their `state` prop (or context state) is `"collapsed"`. Use the trigger or `Ctrl+B` to expand.',
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
          'Set `collapsedWidth: 0` for a fully hidden sidebar. The drag handle persists at the edge so users can re-open it. Drag below `collapseBelow` to snap closed; click the handle (or `Ctrl+B`) to restore the previous width.',
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
          'Floating variant via pure composition: parent gets `m-3` and `gap-3`, the `MainSidebar` gets `rounded-xl border shadow-lg`. Works with resize, collapse, and mobile drawer exactly like the default variant.',
      },
    },
  },
  render: () => (
    <DefaultFrame>
      <MainSidebar className="m-1 bg-surface2 border border-border1/30 rounded-2xl shadow-xl">
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
  <div className="flex h-[500px] w-[840px] gap-4 bg-surface1 border border-border1 rounded-lg p-3">{children}</div>
);

const ParityBody = () => (
  <MainSidebar className="border border-border1 bg-surface2 rounded-md">
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
          'Side-by-side expanded vs collapsed. NavLink rows and the Trigger all share **h-9 (36px)** so toggling collapse never reflows surrounding rows. Use this story to visually verify row alignment.',
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
          '`MainSidebar.NavLink` accepts `asChild` (Radix `Slot`). The slotted child receives the full row styling, so a `<button>`, a custom `<Link>`, or any element behaves identically to the default anchor — without needing to wrap or override styles. Active state, indicator bar, hover, focus ring, and collapsed icon-only mode all apply automatically.',
      },
    },
  },
  render: () => {
    function SidebarBodyAsChild() {
      const [activeKey, setActiveKey] = useState('home');
      const [supportOpen, setSupportOpen] = useState(false);

      return (
        <MainSidebar className="border-r border-border1 bg-surface2">
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
                    <p className="text-neutral4 text-ui-sm">Anything that can be clicked can be a sidebar item.</p>
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
          'Below `mobileBreakpoint` (default `1024px`), `MainSidebar` renders as an off-canvas drawer (Radix Dialog). Use the viewport toolbar to switch between mobile/tablet/desktop — the sidebar reacts via `matchMedia`, no story-level overrides required. Place `MainSidebar.MobileTrigger` in your top bar; it only renders on mobile.',
      },
    },
  },
  render: () => (
    <MobileFrame>
      <MainSidebar className="border-r border-border1 bg-surface2">
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

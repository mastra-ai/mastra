import type { Meta, StoryObj } from '@storybook/react-vite';
import { Home, Bot, Workflow, Settings, Database, FileText, Users, Bell } from 'lucide-react';
import { forwardRef } from 'react';
import { TooltipProvider } from '../Tooltip';
import { MainSidebar, MainSidebarProvider } from './main-sidebar';
import type { LinkComponentProps } from '@/ds/types/link-component';

const StoryLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href, children, ...props }, ref) => (
  <a ref={ref} href={href} {...props}>
    {children}
  </a>
));

const meta: Meta<typeof MainSidebar> = {
  title: 'Layout/MainSidebar',
  component: MainSidebar,
  decorators: [
    Story => (
      <TooltipProvider>
        <MainSidebarProvider>
          <div className="flex h-[500px] bg-surface1 border border-border1 rounded-lg overflow-hidden">
            <Story />
            <div className="flex-1 p-4">
              <p className="text-neutral5">Main content area</p>
            </div>
          </div>
        </MainSidebarProvider>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof MainSidebar>;

export const Default: Story = {
  render: () => (
    <MainSidebar className="border-r border-border1 bg-surface2">
      <MainSidebar.Nav>
        <MainSidebar.NavSection>
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Home', url: '/', icon: <Home />, isOnMastraPlatform: true }}
              isActive
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Agents', url: '/agents', icon: <Bot />, isOnMastraPlatform: true }}
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Workflows', url: '/workflows', icon: <Workflow />, isOnMastraPlatform: true }}
            />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>
    </MainSidebar>
  ),
};

export const WithSections: Story = {
  render: () => (
    <MainSidebar className="border-r border-border1 bg-surface2">
      <MainSidebar.Nav>
        <MainSidebar.NavSection>
          <MainSidebar.NavHeader>Main</MainSidebar.NavHeader>
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Dashboard', url: '/', icon: <Home />, isOnMastraPlatform: true }}
              isActive
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Agents', url: '/agents', icon: <Bot />, isOnMastraPlatform: true }}
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Workflows', url: '/workflows', icon: <Workflow />, isOnMastraPlatform: true }}
            />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>

        <MainSidebar.NavSeparator />

        <MainSidebar.NavSection>
          <MainSidebar.NavHeader>Data</MainSidebar.NavHeader>
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Storage', url: '/storage', icon: <Database />, isOnMastraPlatform: true }}
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Logs', url: '/logs', icon: <FileText />, isOnMastraPlatform: true }}
            />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>
    </MainSidebar>
  ),
};

export const WithBottom: Story = {
  render: () => (
    <MainSidebar className="border-r border-border1 bg-surface2">
      <MainSidebar.Nav>
        <MainSidebar.NavSection>
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Home', url: '/', icon: <Home />, isOnMastraPlatform: true }}
              isActive
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Agents', url: '/agents', icon: <Bot />, isOnMastraPlatform: true }}
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Workflows', url: '/workflows', icon: <Workflow />, isOnMastraPlatform: true }}
            />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
        <MainSidebar.NavList>
          <MainSidebar.NavLink
            LinkComponent={StoryLink}
            link={{ name: 'Team', url: '/team', icon: <Users />, isOnMastraPlatform: true }}
          />
          <MainSidebar.NavLink
            LinkComponent={StoryLink}
            link={{ name: 'Notifications', url: '/notifications', icon: <Bell />, isOnMastraPlatform: true }}
          />
          <MainSidebar.NavLink
            LinkComponent={StoryLink}
            link={{ name: 'Settings', url: '/settings', icon: <Settings />, isOnMastraPlatform: true }}
          />
        </MainSidebar.NavList>
      </MainSidebar.Bottom>
    </MainSidebar>
  ),
};

export const FullSidebar: Story = {
  render: () => (
    <MainSidebar className="border-r border-border1 bg-surface2">
      <MainSidebar.Nav>
        <MainSidebar.NavSection>
          <MainSidebar.NavHeader>Workspace</MainSidebar.NavHeader>
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Overview', url: '/', icon: <Home />, isOnMastraPlatform: true }}
              isActive
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Agents', url: '/agents', icon: <Bot />, isOnMastraPlatform: true }}
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Workflows', url: '/workflows', icon: <Workflow />, isOnMastraPlatform: true }}
            />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>

        <MainSidebar.NavSeparator />

        <MainSidebar.NavSection>
          <MainSidebar.NavHeader>Resources</MainSidebar.NavHeader>
          <MainSidebar.NavList>
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Storage', url: '/storage', icon: <Database />, isOnMastraPlatform: true }}
            />
            <MainSidebar.NavLink
              LinkComponent={StoryLink}
              link={{ name: 'Logs', url: '/logs', icon: <FileText />, isOnMastraPlatform: true }}
            />
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
        <MainSidebar.NavSeparator />
        <MainSidebar.NavList>
          <MainSidebar.NavLink
            LinkComponent={StoryLink}
            link={{ name: 'Settings', url: '/settings', icon: <Settings />, isOnMastraPlatform: true }}
          />
        </MainSidebar.NavList>
      </MainSidebar.Bottom>
    </MainSidebar>
  ),
};

import type { Meta, StoryObj } from '@storybook/react-vite';
import { MainSidebar, MainSidebarProvider } from './main-sidebar';
import { TooltipProvider } from '../Tooltip';
import { Home, Bot, Workflow, Settings, Database, FileText, Users, Bell } from 'lucide-react';

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
              <p className="text-icon5">Main content area</p>
            </div>
          </div>
        </MainSidebarProvider>
      </TooltipProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MainSidebar>;

export const Default: Story = {
  render: () => (
    <MainSidebar className="border-r border-border1 bg-surface2">
      <MainSidebar.Nav>
        <MainSidebar.NavSection>
          <MainSidebar.NavList>
            <MainSidebar.NavLink href="/" icon={<Home />} isActive>
              Home
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/agents" icon={<Bot />}>
              Agents
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/workflows" icon={<Workflow />}>
              Workflows
            </MainSidebar.NavLink>
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
            <MainSidebar.NavLink href="/" icon={<Home />} isActive>
              Dashboard
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/agents" icon={<Bot />}>
              Agents
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/workflows" icon={<Workflow />}>
              Workflows
            </MainSidebar.NavLink>
          </MainSidebar.NavList>
        </MainSidebar.NavSection>

        <MainSidebar.NavSeparator />

        <MainSidebar.NavSection>
          <MainSidebar.NavHeader>Data</MainSidebar.NavHeader>
          <MainSidebar.NavList>
            <MainSidebar.NavLink href="/storage" icon={<Database />}>
              Storage
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/logs" icon={<FileText />}>
              Logs
            </MainSidebar.NavLink>
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
            <MainSidebar.NavLink href="/" icon={<Home />} isActive>
              Home
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/agents" icon={<Bot />}>
              Agents
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/workflows" icon={<Workflow />}>
              Workflows
            </MainSidebar.NavLink>
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
        <MainSidebar.NavList>
          <MainSidebar.NavLink href="/team" icon={<Users />}>
            Team
          </MainSidebar.NavLink>
          <MainSidebar.NavLink href="/notifications" icon={<Bell />}>
            Notifications
          </MainSidebar.NavLink>
          <MainSidebar.NavLink href="/settings" icon={<Settings />}>
            Settings
          </MainSidebar.NavLink>
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
            <MainSidebar.NavLink href="/" icon={<Home />} isActive>
              Overview
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/agents" icon={<Bot />}>
              Agents
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/workflows" icon={<Workflow />}>
              Workflows
            </MainSidebar.NavLink>
          </MainSidebar.NavList>
        </MainSidebar.NavSection>

        <MainSidebar.NavSeparator />

        <MainSidebar.NavSection>
          <MainSidebar.NavHeader>Resources</MainSidebar.NavHeader>
          <MainSidebar.NavList>
            <MainSidebar.NavLink href="/storage" icon={<Database />}>
              Storage
            </MainSidebar.NavLink>
            <MainSidebar.NavLink href="/logs" icon={<FileText />}>
              Logs
            </MainSidebar.NavLink>
          </MainSidebar.NavList>
        </MainSidebar.NavSection>
      </MainSidebar.Nav>

      <MainSidebar.Bottom>
        <MainSidebar.NavSeparator />
        <MainSidebar.NavList>
          <MainSidebar.NavLink href="/settings" icon={<Settings />}>
            Settings
          </MainSidebar.NavLink>
        </MainSidebar.NavList>
      </MainSidebar.Bottom>
    </MainSidebar>
  ),
};

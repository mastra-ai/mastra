import { Outlet } from 'react-router';
import { ToolNavigation } from './components/tool-navigation';
import { ResourceDetailShell } from '@/components/resource-detail-shell';
import { SidebarContent } from '@/components/ui/sidebar-content';

export function ToolsShell() {
  return (
    <ResourceDetailShell navigationId="tools" label="Tools navigation" back={{ label: 'All tools', href: '/tools' }}>
      <SidebarContent>
        <ToolNavigation />
      </SidebarContent>
      <Outlet />
    </ResourceDetailShell>
  );
}

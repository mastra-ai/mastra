import { Outlet } from 'react-router';
import { WorkspaceNavigation } from './components/workspace-navigation';
import { FeatureShell } from '@/components/feature-shell';
import { SidebarSlotProvider } from '@/components/ui/sidebar-slot-provider';

export function WorkspaceShell() {
  return (
    <SidebarSlotProvider>
      <FeatureShell navigationId="workspaces" label="Workspace navigation" sidebar={<WorkspaceNavigation />}>
        <Outlet />
      </FeatureShell>
    </SidebarSlotProvider>
  );
}

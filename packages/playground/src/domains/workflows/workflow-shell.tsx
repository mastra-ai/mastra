import { Outlet } from 'react-router';
import { WorkflowNavigation } from './components/workflow-navigation';
import { WorkflowLayout } from './workflow-layout';
import { FeatureShell } from '@/components/feature-shell';
import { SidebarSlotProvider } from '@/components/ui/sidebar-slot-provider';

/** The route owns one sidebar for recent workflows and the selected workflow's runs. */
export function WorkflowShell() {
  return (
    <SidebarSlotProvider>
      <FeatureShell
        navigationId="workflows"
        navigationWidth={380}
        navigationMinWidth={320}
        label="Workflow navigation"
        sidebar={<WorkflowNavigation />}
      >
        <WorkflowLayout>
          <Outlet />
        </WorkflowLayout>
      </FeatureShell>
    </SidebarSlotProvider>
  );
}

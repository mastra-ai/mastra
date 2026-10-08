import { WorkflowLayout } from '@mastra/playground-ui/domains/workflows/components/workflow-layout';
import type { ReactNode } from 'react';
import { SidebarContent } from '@/components/ui/sidebar-content';
import { useSidebarSlot } from '@/components/ui/sidebar-slot-context';

/** The graph has no floating navigation panel when its controls occupy the route sidebar. */
export function WorkflowWorkspaceView({ navigation, children }: { navigation: ReactNode; children: ReactNode }) {
  const slot = useSidebarSlot();
  if (!slot) return <WorkflowLayout leftSlot={navigation}>{children}</WorkflowLayout>;
  return (
    <>
      <SidebarContent>{navigation}</SidebarContent>
      <WorkflowLayout>{children}</WorkflowLayout>
    </>
  );
}

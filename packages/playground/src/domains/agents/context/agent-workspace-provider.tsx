import { useContext } from 'react';
import type { ReactNode } from 'react';
import { usePanelRef } from 'react-resizable-panels';
import { AgentWorkspaceContext } from './agent-workspace-context';
import { FeatureWorkspaceContext } from '@/components/feature-workspace-context';
import { useSidebarSlotTarget } from '@/components/ui/use-sidebar-slot-target';

/** The route owns panel geometry; view portals retain their thread/editor providers. */
export function AgentWorkspaceProvider({ children }: { children: ReactNode }) {
  const { target, registerTarget } = useSidebarSlotTarget();
  const internalPanel = usePanelRef();
  const navigationPanel = useContext(FeatureWorkspaceContext)?.panel ?? internalPanel;

  return (
    <AgentWorkspaceContext.Provider
      value={{ navigationTarget: target, registerNavigationTarget: registerTarget, navigationPanel }}
    >
      {children}
    </AgentWorkspaceContext.Provider>
  );
}

import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { usePanelRef } from 'react-resizable-panels';
import { useMatches } from 'react-router';
import { featureNavigationLabel } from './feature-navigation-label';
import { FeatureShellFrame } from './feature-shell-frame';
import { FeatureWorkspaceContext } from './feature-workspace-context';
import { useSidebarSlotTarget } from './ui/use-sidebar-slot-target';

/** Sidebar geometry belongs to the shared router layout, independently of its active feature. */
export function FeatureWorkspaceLayout({ children }: { children: ReactNode }) {
  const label = featureNavigationLabel(useMatches());
  const { target, registerTarget } = useSidebarSlotTarget();
  const panel = usePanelRef();
  const handle = useRef<CollapsiblePanelHandle>(null);
  if (!label) return children;
  return (
    <FeatureWorkspaceContext.Provider value={{ target, panel, handle }}>
      <FeatureShellFrame
        navigationId="shared"
        navigationWidth={280}
        label={label}
        navigationRef={handle}
        navigationPanelRef={panel}
        sidebar={
          <aside
            aria-label={label}
            className="flex h-full min-h-0 min-w-0 flex-col border-r border-surface-rim bg-card"
          >
            <div ref={registerTarget} className="flex min-h-0 flex-1 flex-col" />
          </aside>
        }
      >
        {children}
      </FeatureShellFrame>
    </FeatureWorkspaceContext.Provider>
  );
}

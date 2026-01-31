import { useEffect } from 'react';
import { Panel, useDefaultLayout, Group, usePanelRef } from 'react-resizable-panels';
import { getMainContentContentClassName } from '@/ds/components/MainContent';
import { PanelSeparator } from '@/lib/resize/separator';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';
import { useBrowserSession } from '../context/browser-session-context';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  browserSlot?: React.ReactNode;
}

export const AgentLayout = ({ agentId, children, leftSlot, rightSlot, browserSlot }: AgentLayoutProps) => {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-v2-${agentId}`,
    storage: localStorage,
  });

  const browserPanelRef = usePanelRef();
  const { isActive, panelRef: sessionPanelRef } = useBrowserSession();

  // Expose the local panel ref to the session context so other components can access it
  useEffect(() => {
    sessionPanelRef.current = browserPanelRef.current;
  });

  // Auto-expand/collapse browser panel based on session activity
  useEffect(() => {
    if (!browserSlot) return;
    if (!browserPanelRef.current) return;

    if (isActive) {
      browserPanelRef.current.expand();
    } else {
      browserPanelRef.current.collapse();
    }
  }, [isActive, browserSlot, browserPanelRef]);

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: Boolean(leftSlot),
  });

  return (
    <Group className={computedClassName} defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
      {leftSlot && (
        <>
          <CollapsiblePanel
            direction="left"
            id="left-slot"
            minSize={200}
            maxSize={'30%'}
            defaultSize={200}
            collapsedSize={60}
            collapsible={true}
          >
            {leftSlot}
          </CollapsiblePanel>
          <PanelSeparator />
        </>
      )}
      <Panel id="main-slot" className="grid overflow-y-auto relative bg-surface1 py-4">
        {children}
      </Panel>
      {browserSlot && (
        <>
          <PanelSeparator />
          <Panel
            id="browser-slot"
            panelRef={browserPanelRef}
            collapsible={true}
            collapsedSize={0}
            defaultSize={0}
            minSize={300}
            maxSize={'50%'}
            className="overflow-hidden"
          >
            {browserSlot}
          </Panel>
        </>
      )}
      {rightSlot && (
        <>
          <PanelSeparator />
          <CollapsiblePanel
            direction="right"
            id="right-slot"
            minSize={300}
            maxSize={'50%'}
            defaultSize="30%"
            collapsedSize={60}
            collapsible={true}
          >
            {rightSlot}
          </CollapsiblePanel>
        </>
      )}
    </Group>
  );
};

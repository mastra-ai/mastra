import { Panel, useDefaultLayout, Group, usePanelRef } from 'react-resizable-panels';
import { getMainContentContentClassName } from '@/ds/components/MainContent';
import { PanelSeparator } from '@/lib/resize/separator';
import { CollapsiblePanel, CollapsiblePanelTriggerProps } from '@/lib/resize/collapsible-panel';
import { Button } from '@/ds/components/Button/Button';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  rightDefaultCollapsed?: boolean;
  rightCollapsedTrigger?: CollapsiblePanelTriggerProps;
}

export const AgentLayout = ({
  agentId,
  children,
  leftSlot,
  rightSlot,
  rightDefaultCollapsed = false,
  rightCollapsedTrigger,
}: AgentLayoutProps) => {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-${agentId}`,
    storage: localStorage,
  });
  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(Boolean(rightDefaultCollapsed));

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: Boolean(leftSlot),
  });

  useEffect(() => {
    setIsLeftCollapsed(Boolean(leftPanelRef.current?.isCollapsed?.()));
    setIsRightCollapsed(Boolean(rightPanelRef.current?.isCollapsed?.()));
  }, [leftPanelRef, rightPanelRef]);

  const handleOpenConversations = () => {
    leftPanelRef.current?.expand();
    setIsLeftCollapsed(false);
  };

  const handleOpenDetails = () => {
    rightPanelRef.current?.expand();
    setIsRightCollapsed(false);
  };

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
            collapsedSize={0}
            collapsible={true}
            panelRef={leftPanelRef}
            showCollapsedTrigger={false}
            onCollapsedChange={setIsLeftCollapsed}
            className={cn(isLeftCollapsed && '!overflow-hidden !min-w-0 !border-0')}
          >
            {leftSlot}
          </CollapsiblePanel>
          <div className={cn(isLeftCollapsed && 'hidden')}>
            <PanelSeparator />
          </div>
        </>
      )}
      <Panel id="main-slot" className="grid overflow-y-auto relative bg-surface1 py-4">
        {leftSlot && isLeftCollapsed && (
          <div className="absolute left-4 top-4 z-10">
            <Button data-testid="open-conversations-button" size="sm" variant="outline" onClick={handleOpenConversations}>
              Open conversations
            </Button>
          </div>
        )}
        {rightSlot && isRightCollapsed && (
          <div className="absolute right-4 top-4 z-10">
            <Button data-testid="open-details-button" size="sm" variant="outline" onClick={handleOpenDetails}>
              Open details
            </Button>
          </div>
        )}
        {children}
      </Panel>
      {rightSlot && (
        <>
          <div className={cn(isRightCollapsed && 'hidden')}>
            <PanelSeparator />
          </div>
          <CollapsiblePanel
            direction="right"
            id="right-slot"
            minSize={300}
            maxSize={'50%'}
            defaultSize={rightDefaultCollapsed ? 0 : '30%'}
            collapsedSize={0}
            collapsible={true}
            collapsedTrigger={rightCollapsedTrigger}
            panelRef={rightPanelRef}
            showCollapsedTrigger={false}
            onCollapsedChange={setIsRightCollapsed}
            className={cn(isRightCollapsed && '!overflow-hidden !min-w-0 !border-0')}
          >
            {rightSlot}
          </CollapsiblePanel>
        </>
      )}
    </Group>
  );
};

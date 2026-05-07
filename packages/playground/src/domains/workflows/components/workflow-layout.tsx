import {
  getMainContentContentClassName,
  CollapsiblePanel,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  WorkflowIcon,
  transitions,
  cn,
} from '@mastra/playground-ui';
import { History } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Panel, useDefaultLayout, Group, usePanelRef } from 'react-resizable-panels';

export interface WorkflowLayoutProps {
  workflowId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const WorkflowLayout = ({ workflowId, children, leftSlot, rightSlot }: WorkflowLayoutProps) => {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `workflow-layout-${workflowId}`,
    storage: localStorage,
  });
  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(false);

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: Boolean(leftSlot),
  });

  useEffect(() => {
    setIsLeftCollapsed(Boolean(leftPanelRef.current?.isCollapsed?.()));
    setIsRightCollapsed(Boolean(rightPanelRef.current?.isCollapsed?.()));
  }, [leftPanelRef, rightPanelRef]);

  const toggleLeft = useCallback(() => {
    if (isLeftCollapsed) {
      leftPanelRef.current?.expand();
    } else {
      leftPanelRef.current?.collapse();
    }
  }, [isLeftCollapsed, leftPanelRef]);

  const toggleRight = useCallback(() => {
    if (isRightCollapsed) {
      rightPanelRef.current?.expand();
    } else {
      rightPanelRef.current?.collapse();
    }
  }, [isRightCollapsed, rightPanelRef]);

  return (
    <Group className={computedClassName} defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
      {leftSlot && (
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
          className={cn('border-r border-border2', isLeftCollapsed && '!overflow-hidden !min-w-0 !border-0')}
        >
          {leftSlot}
        </CollapsiblePanel>
      )}
      <Panel id="main-slot" className="grid overflow-y-auto relative bg-surface1 py-4 px-7">
        {leftSlot && (
          <div
            className={cn(
              'absolute top-0 left-0 z-10 flex flex-col',
              'bg-surface2 border-r border-b border-border2 rounded-br-lg overflow-hidden',
            )}
            data-testid="left-sidebar-tabs"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-testid="left-tab-workflow-runs"
                  onClick={toggleLeft}
                  className={cn(
                    'flex items-center justify-center h-9 w-9',
                    transitions.all,
                    !isLeftCollapsed
                      ? 'bg-surface4 text-neutral6'
                      : 'text-neutral3 hover:bg-surface3 hover:text-neutral5',
                  )}
                  aria-label="Workflow Runs"
                  aria-pressed={!isLeftCollapsed}
                >
                  <History className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Workflow Runs</TooltipContent>
            </Tooltip>
          </div>
        )}
        {rightSlot && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-testid="toggle-right-sidebar"
                onClick={toggleRight}
                className={cn(
                  'absolute top-0 right-0 z-10',
                  'flex items-center justify-center h-10 w-10',
                  'rounded-bl-lg',
                  'bg-surface2 text-neutral3 border-l border-b border-border2',
                  transitions.all,
                  'hover:bg-surface4 hover:text-neutral5',
                )}
                aria-label="Workflow Details"
              >
                <WorkflowIcon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Workflow Details</TooltipContent>
          </Tooltip>
        )}
        {children}
      </Panel>
      {rightSlot && (
        <CollapsiblePanel
          direction="right"
          id="right-slot"
          minSize={300}
          maxSize={'50%'}
          defaultSize={300}
          collapsedSize={0}
          collapsible={true}
          panelRef={rightPanelRef}
          showCollapsedTrigger={false}
          onCollapsedChange={setIsRightCollapsed}
          className={cn('border-l border-border2', isRightCollapsed && '!overflow-hidden !min-w-0 !border-0')}
        >
          {rightSlot}
        </CollapsiblePanel>
      )}
    </Group>
  );
};

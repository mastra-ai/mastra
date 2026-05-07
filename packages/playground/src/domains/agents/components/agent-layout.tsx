import {
  getMainContentContentClassName,
  CollapsiblePanel,
  MemoryIcon,
  AgentIcon,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  transitions,
  cn,
} from '@mastra/playground-ui';
import { MessagesSquare } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Panel, useDefaultLayout, Group, usePanelRef } from 'react-resizable-panels';
import { LeftSidebarTabProvider } from './left-sidebar-context';
import type { LeftSidebarTab } from './left-sidebar-context';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  rightDefaultCollapsed?: boolean;
  browserOverlay?: React.ReactNode;
}

export const AgentLayout = ({
  agentId,
  children,
  leftSlot,
  rightSlot,
  rightDefaultCollapsed = false,
  browserOverlay,
}: AgentLayoutProps) => {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-${agentId}`,
    storage: localStorage,
  });
  const leftPanelRef = usePanelRef();
  const rightPanelRef = usePanelRef();
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState(Boolean(rightDefaultCollapsed));
  const [activeLeftTab, setActiveLeftTab] = useState<LeftSidebarTab>('conversations');

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: Boolean(leftSlot),
  });

  useEffect(() => {
    setIsLeftCollapsed(Boolean(leftPanelRef.current?.isCollapsed?.()));
    setIsRightCollapsed(Boolean(rightPanelRef.current?.isCollapsed?.()));
  }, [leftPanelRef, rightPanelRef]);

  const handleLeftTabClick = useCallback(
    (tab: LeftSidebarTab) => {
      if (tab === activeLeftTab && !isLeftCollapsed) {
        leftPanelRef.current?.collapse();
      } else {
        setActiveLeftTab(tab);
        if (isLeftCollapsed) {
          leftPanelRef.current?.expand();
        }
      }
    },
    [activeLeftTab, isLeftCollapsed, leftPanelRef],
  );

  const toggleRight = () => {
    if (isRightCollapsed) {
      rightPanelRef.current?.expand();
    } else {
      rightPanelRef.current?.collapse();
    }
  };

  const leftSidebarCtx = useMemo(() => ({ activeTab: activeLeftTab }), [activeLeftTab]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Group className={computedClassName} defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
        {leftSlot && (
          <CollapsiblePanel
            direction="left"
            id="left-slot"
            minSize={240}
            maxSize={'35%'}
            defaultSize={280}
            collapsedSize={0}
            collapsible={true}
            panelRef={leftPanelRef}
            showCollapsedTrigger={false}
            onCollapsedChange={setIsLeftCollapsed}
            className={cn('border-r border-border2', isLeftCollapsed && '!overflow-hidden !min-w-0 !border-0')}
          >
            <LeftSidebarTabProvider value={leftSidebarCtx}>{leftSlot}</LeftSidebarTabProvider>
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
              <LeftSidebarIconTab
                icon={<MessagesSquare className="h-4 w-4" />}
                isActive={activeLeftTab === 'conversations' && !isLeftCollapsed}
                tooltip="Conversations"
                onClick={() => handleLeftTabClick('conversations')}
                testId="left-tab-conversations"
              />
              <LeftSidebarIconTab
                icon={<MemoryIcon className="h-4 w-4" />}
                isActive={activeLeftTab === 'memory' && !isLeftCollapsed}
                tooltip="Memory"
                onClick={() => handleLeftTabClick('memory')}
                testId="left-tab-memory"
              />
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
                  aria-label="Agent Details"
                >
                  <AgentIcon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">Agent Details</TooltipContent>
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
            defaultSize={rightDefaultCollapsed ? 0 : '30%'}
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
      {/* Browser modal overlay - center view mode */}
      {browserOverlay}
    </div>
  );
};

interface LeftSidebarIconTabProps {
  icon: React.ReactNode;
  isActive: boolean;
  tooltip: string;
  onClick: () => void;
  testId: string;
}

const LeftSidebarIconTab = ({ icon, isActive, tooltip, onClick, testId }: LeftSidebarIconTabProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        data-testid={testId}
        onClick={onClick}
        className={cn(
          'flex items-center justify-center h-9 w-9',
          transitions.all,
          isActive ? 'bg-surface4 text-neutral6' : 'text-neutral3 hover:bg-surface3 hover:text-neutral5',
        )}
        aria-label={tooltip}
        aria-pressed={isActive}
      >
        {icon}
      </button>
    </TooltipTrigger>
    <TooltipContent side="right">{tooltip}</TooltipContent>
  </Tooltip>
);

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Panel, useDefaultLayout } from 'react-resizable-panels';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';
import type { CollapsiblePanelHandle } from '@/lib/resize/collapsible-panel';
import { PanelDrawer } from '@/lib/resize/panel-drawer';
import { PanelGroup } from '@/lib/resize/panel-group';
import { PanelSeparator } from '@/lib/resize/separator';

export interface AgentPanelLayoutProps {
  agentId: string;
  children: ReactNode;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  leftDrawerLabel?: string;
  rightDrawerLabel?: string;
  browserOverlay?: ReactNode;
  isMemoryTimelineOpen?: boolean;
  registerThreadsPanel?: (handle: CollapsiblePanelHandle | null, hasSavedLayout: boolean) => void;
}

export function AgentPanelLayout({
  agentId,
  children,
  leftSlot,
  rightSlot,
  leftDrawerLabel = 'Open left panel',
  rightDrawerLabel = 'Open right panel',
  browserOverlay,
  isMemoryTimelineOpen = false,
  registerThreadsPanel,
}: AgentPanelLayoutProps) {
  const isMobile = useIsMobile();
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const wasMemoryTimelineOpen = useRef(false);
  const sizeBeforeMemoryDetail = useRef<string | undefined>(undefined);
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-v6-${agentId}`,
    storage: typeof localStorage === 'undefined' ? { getItem: () => null, setItem: () => {} } : localStorage,
  });

  useEffect(() => {
    const leftPanel = leftPanelRef.current;
    if (!leftPanel) return;
    const wasOpen = wasMemoryTimelineOpen.current;
    wasMemoryTimelineOpen.current = isMemoryTimelineOpen;
    if (isMemoryTimelineOpen && !wasOpen) {
      sizeBeforeMemoryDetail.current = `${leftPanel.getSize().inPixels}px`;
      leftPanel.resize('50%');
    } else if (!isMemoryTimelineOpen && wasOpen) {
      leftPanel.resize(sizeBeforeMemoryDetail.current ?? '300px');
      sizeBeforeMemoryDetail.current = undefined;
    }
  }, [isMemoryTimelineOpen]);

  if (isMobile) {
    return (
      <div className="relative size-full overflow-hidden">
        <div className="size-full min-w-0">{children}</div>
        {leftSlot && (
          <PanelDrawer direction="left" label={leftDrawerLabel}>
            {leftSlot}
          </PanelDrawer>
        )}
        {rightSlot && (
          <PanelDrawer direction="right" label={rightDrawerLabel}>
            {rightSlot}
          </PanelDrawer>
        )}
        {browserOverlay}
      </div>
    );
  }

  return (
    <div className="relative size-full overflow-hidden">
      <PanelGroup className="size-full min-h-0 min-w-0" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
        {leftSlot && (
          <CollapsiblePanel
            id="left-slot"
            direction="left"
            ref={handle => registerThreadsPanel?.(handle, Boolean(defaultLayout))}
            panelRef={leftPanelRef}
            collapsible
            collapsedSize={0}
            expandShortcut="{"
            minSize={256}
            maxSize="50%"
            defaultSize={300}
            className="min-w-0"
          >
            {leftSlot}
          </CollapsiblePanel>
        )}
        {leftSlot && <PanelSeparator />}
        <Panel id="main-slot" className="relative grid min-w-0 overflow-y-auto">
          {children}
        </Panel>
        {rightSlot && (
          <>
            <PanelSeparator />
            <Panel id="right-slot" minSize={320} maxSize="45%" defaultSize={420} className="min-w-0">
              {rightSlot}
            </Panel>
          </>
        )}
      </PanelGroup>
      {browserOverlay}
    </div>
  );
}

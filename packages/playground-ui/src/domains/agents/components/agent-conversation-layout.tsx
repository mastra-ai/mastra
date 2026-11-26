import type { ReactNode, RefObject } from 'react';
import { Panel, useDefaultLayout } from 'react-resizable-panels';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';
import type { CollapsiblePanelHandle } from '@/lib/resize/collapsible-panel';
import { PanelDrawer } from '@/lib/resize/panel-drawer';
import { PanelGroup } from '@/lib/resize/panel-group';
import { PanelSeparator } from '@/lib/resize/separator';

export interface AgentConversationLayoutProps {
  layoutId: string;
  children: ReactNode;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  leftDrawerLabel?: string;
  rightDrawerLabel?: string;
  browserOverlay?: ReactNode;
  leftPanelRef?: RefObject<PanelImperativeHandle | null>;
  onLeftPanelRegister?: (handle: CollapsiblePanelHandle | null, hasSavedLayout: boolean) => void;
}

/** Resizable desktop shell with edge drawers for narrow viewports. The host owns all panel content and state. */
export const AgentConversationLayout = ({
  layoutId,
  children,
  leftSlot,
  rightSlot,
  leftDrawerLabel = 'Open left panel',
  rightDrawerLabel = 'Open right panel',
  browserOverlay,
  leftPanelRef,
  onLeftPanelRegister,
}: AgentConversationLayoutProps) => {
  const isMobile = useIsMobile();
  const { defaultLayout, onLayoutChange } = useDefaultLayout({ id: layoutId, storage: localStorage });

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
            ref={handle => onLeftPanelRegister?.(handle, Boolean(defaultLayout))}
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
};

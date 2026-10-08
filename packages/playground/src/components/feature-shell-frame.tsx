import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { CollapsiblePanel } from '@mastra/playground-ui/resize/collapsible-panel';
import type { CollapsiblePanelHandle } from '@mastra/playground-ui/resize/collapsible-panel';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import type { ReactNode, Ref, RefObject } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { Panel, useDefaultLayout, usePanelRef } from 'react-resizable-panels';
import type { Layout, PanelImperativeHandle } from 'react-resizable-panels';
import { MobileFeatureNavigation } from './mobile-feature-navigation';

// ResizeObserver can report constrained widths before the breakpoint hook commits.
// Those mobile measurements must not replace the desktop preference.
function isDesktopViewport() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

/** A route owns its navigation; mobile access shares the app header. */
export function FeatureShellFrame({
  navigationId,
  sidebar,
  label,
  children,
  navigationRef,
  navigationPanelRef,
  navigationWidth = 240,
  navigationMinWidth = 200,
}: FeatureShellFrameProps) {
  const isMobile = useIsMobile();
  const internalPanel = usePanelRef();
  const navigationPanel = navigationPanelRef ?? internalPanel;
  const desktopWidth = useRef<number | undefined>(undefined);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `mastra:studio:feature-navigation:v1:${navigationId}`,
    storage: localStorage,
  });
  const savedWidth = defaultLayout?.['feature-navigation'];
  // Resolve the initial preference against the measured group. Ancestor panels
  // can settle after registration, before the first ResizeObserver notification.
  const pendingWidth = useRef<number | `${number}%` | undefined>(
    savedWidth === undefined ? navigationWidth : `${savedWidth}%`,
  );

  useLayoutEffect(() => {
    if (isMobile) {
      const savedWidth = defaultLayout?.['feature-navigation'];
      pendingWidth.current = desktopWidth.current ?? (savedWidth === undefined ? navigationWidth : `${savedWidth}%`);
    }
  }, [isMobile, defaultLayout, navigationWidth]);
  return (
    <PanelGroup
      className="min-h-0 flex-1"
      orientation="horizontal"
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout: Layout) => {
        if (!isMobile && isDesktopViewport()) onLayoutChanged(layout);
      }}
      disabled={isMobile}
    >
      {!isMobile && (
        <CollapsiblePanel
          key="navigation"
          ref={navigationRef}
          direction="left"
          collapsible
          collapsedSize={0}
          hideExpandButton={false}
          id="feature-navigation"
          defaultSize={navigationWidth}
          minSize={navigationMinWidth}
          maxSize="50%"
          groupResizeBehavior="preserve-pixel-size"
          panelRef={navigationPanel}
          onResize={size => {
            if (isMobile || !isDesktopViewport()) return;
            const restoreWidth = pendingWidth.current;
            if (restoreWidth !== undefined) {
              // The group has measured its desktop container before this callback.
              pendingWidth.current = undefined;
              navigationPanel.current?.resize(restoreWidth);
              return;
            }
            desktopWidth.current = size.inPixels;
          }}
          className="min-w-0"
        >
          {sidebar}
        </CollapsiblePanel>
      )}
      {!isMobile && <PanelSeparator key="divider" aria-label={`Resize ${label}`} />}
      <Panel key="content" id="feature-content" minSize={320} className="flex min-h-0 min-w-0 flex-col">
        {isMobile && <MobileFeatureNavigation label={label}>{sidebar}</MobileFeatureNavigation>}
        <div className="min-h-0 flex-1">{children}</div>
      </Panel>
    </PanelGroup>
  );
}

export interface FeatureShellFrameProps {
  navigationId: string;
  sidebar: ReactNode;
  label: string;
  children: ReactNode;
  navigationRef?: Ref<CollapsiblePanelHandle>;
  navigationPanelRef?: RefObject<PanelImperativeHandle | null>;
  navigationWidth?: number;
  navigationMinWidth?: number;
}

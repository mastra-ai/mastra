import { Button } from '@mastra/playground-ui/components/Button';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { PanelDrawer } from '@mastra/playground-ui/resize/panel-drawer';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { PanelRightIcon } from 'lucide-react';

import { ViewportLayout } from './PageLayout';

type ChatLayoutProps = {
  sidebar: ReactNode;
  /** Optional bar above the chat content (e.g. mobile sidebar toggle). */
  header?: ReactNode;
  content?: ReactNode;
  /** A complete main area when content and footer need to share one provider boundary. */
  main?: ReactNode;
  /** Optional pinned region below the chat content (e.g. composer). */
  footer?: ReactNode;
  /** Optional workspace panel rendered inline on desktop and in a drawer on mobile. */
  rightPanel?: ReactNode;
  rightPanelExpanded?: boolean;
  rightPanelAvailable?: boolean;
  onRightPanelOpen?: () => void;
  onRightPanelClose?: () => void;
};

const COMPACT_RIGHT_PANEL_WIDTH = 320;
const EXPANDED_RIGHT_PANEL_WIDTH = 720;
const MIN_RIGHT_PANEL_WIDTH = 260;
const MIN_CHAT_WIDTH = 420;

/** Slot-based chat content arrangement inside the shared application page frame. */
export function ChatLayout({
  sidebar,
  header,
  content,
  main,
  footer,
  rightPanel,
  rightPanelExpanded = false,
  rightPanelAvailable = false,
  onRightPanelOpen,
  onRightPanelClose,
}: ChatLayoutProps) {
  const isMobile = useIsMobile();

  return (
    <ViewportLayout sidebar={sidebar} header={header}>
      <div className="relative flex h-full min-w-0 flex-1 overflow-visible">
        <DesktopRightPanelFrame
          initialWidth={rightPanelExpanded ? EXPANDED_RIGHT_PANEL_WIDTH : COMPACT_RIGHT_PANEL_WIDTH}
          rightPanel={isMobile ? undefined : rightPanel}
          onRightPanelClose={onRightPanelClose}
        >
          <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
            {main ?? (
              <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
                {content}
                {footer}
              </div>
            )}
          </div>
        </DesktopRightPanelFrame>
        {isMobile && rightPanel ? (
          <PanelDrawer direction="right" label="Open workspace files">
            {rightPanel}
          </PanelDrawer>
        ) : null}
        {!rightPanel && rightPanelAvailable ? (
          <Button
            size="icon-md"
            variant="ghost"
            tooltip="Open workspace files"
            className="absolute top-2 right-2 z-10 hidden rounded-md lg:inline-flex"
            onClick={onRightPanelOpen}
            aria-label="Open workspace files"
            aria-expanded="false"
          >
            <PanelRightIcon className="rotate-180" />
          </Button>
        ) : null}
      </div>
    </ViewportLayout>
  );
}

function DesktopRightPanelFrame({
  initialWidth,
  rightPanel,
  children,
  onRightPanelClose,
}: {
  initialWidth: number;
  rightPanel?: ReactNode;
  children: ReactNode;
  onRightPanelClose?: () => void;
}) {
  const rightPanelRef = usePanelRef();
  const hasRightPanel = rightPanel !== undefined;
  const previousInitialWidthRef = useRef(initialWidth);
  const previousHasRightPanelRef = useRef(hasRightPanel);

  useEffect(() => {
    const previousInitialWidth = previousInitialWidthRef.current;
    const previouslyHadRightPanel = previousHasRightPanelRef.current;
    previousInitialWidthRef.current = initialWidth;
    previousHasRightPanelRef.current = hasRightPanel;
    if (hasRightPanel && previouslyHadRightPanel && previousInitialWidth !== initialWidth) {
      rightPanelRef.current?.resize(initialWidth);
    }
  }, [hasRightPanel, initialWidth, rightPanelRef]);

  return (
    <PanelGroup className="h-full min-h-0 w-full min-w-0">
      <Panel id="chat-main-slot" minSize={MIN_CHAT_WIDTH} className="min-w-0">
        {children}
      </Panel>
      {hasRightPanel ? (
        <>
          <PanelSeparator />
          <Panel
            id="chat-right-slot"
            panelRef={rightPanelRef}
            minSize={MIN_RIGHT_PANEL_WIDTH}
            defaultSize={initialWidth}
            groupResizeBehavior="preserve-pixel-size"
            className="min-w-0"
          >
            <div className="relative h-full min-w-0">
              {rightPanel}
              {onRightPanelClose ? (
                <Button
                  size="icon-md"
                  variant="ghost"
                  tooltip="Close workspace files"
                  className="absolute top-2 right-2 z-10 rounded-md"
                  onClick={onRightPanelClose}
                  aria-label="Close workspace files"
                  aria-expanded="true"
                >
                  <PanelRightIcon />
                </Button>
              ) : null}
            </div>
          </Panel>
        </>
      ) : null}
    </PanelGroup>
  );
}

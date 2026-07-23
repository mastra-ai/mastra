import { Button } from '@mastra/playground-ui/components/Button';
import { ResizeHandleIndicator } from '@mastra/playground-ui/primitives/resize-handle-indicator';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { PanelDrawer } from '@mastra/playground-ui/resize/panel-drawer';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
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
            className="absolute right-2 top-2 z-10 hidden rounded-md lg:inline-flex"
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
  const frameRef = useRef<HTMLDivElement>(null);
  const rightPanelSlotRef = useRef<HTMLDivElement>(null);
  const resizeCleanupRef = useRef<(() => void) | undefined>(undefined);
  const hasRightPanel = rightPanel !== undefined;

  useEffect(() => {
    frameRef.current?.style.setProperty('--chat-right-panel-width', `${initialWidth}px`);
    return () => resizeCleanupRef.current?.();
  }, [initialWidth]);

  const setPanelWidth = (requestedWidth: number, frameWidth?: number) => {
    const frame = frameRef.current;
    if (!frame) return;

    const availableWidth = frameWidth ?? frame.getBoundingClientRect().width;
    const maximumWidth = Math.min(EXPANDED_RIGHT_PANEL_WIDTH, Math.max(0, availableWidth - 16));
    const minimumWidth = Math.min(MIN_RIGHT_PANEL_WIDTH, maximumWidth);
    const nextWidth = Math.min(maximumWidth, Math.max(minimumWidth, requestedWidth));
    frame.style.setProperty('--chat-right-panel-width', `${nextWidth}px`);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const panelSlot = rightPanelSlotRef.current;
    if (!panelSlot) return;

    event.preventDefault();
    resizeCleanupRef.current?.();
    frameRef.current?.setAttribute('data-panel-gesture', 'active');
    const startX = event.clientX;
    const startWidth = panelSlot.getBoundingClientRect().width || initialWidth;
    const frameWidth = frameRef.current?.getBoundingClientRect().width;
    const onPointerMove = (moveEvent: PointerEvent) => {
      setPanelWidth(startWidth - (moveEvent.clientX - startX), frameWidth);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      frameRef.current?.removeAttribute('data-panel-gesture');
      resizeCleanupRef.current = undefined;
    };

    resizeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  const resizeWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const currentWidth = rightPanelSlotRef.current?.getBoundingClientRect().width || initialWidth;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPanelWidth(currentWidth + 24);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPanelWidth(currentWidth - 24);
    }
  };

  return (
    <div
      ref={frameRef}
      data-expanded={initialWidth === EXPANDED_RIGHT_PANEL_WIDTH}
      className="relative h-full min-h-0 w-full min-w-0 flex-1 [--chat-right-panel-width:320px] data-[expanded=true]:[--chat-right-panel-width:720px]"
    >
      <div id="chat-main-slot" className="h-full min-h-0 min-w-0">
        {children}
      </div>
      {hasRightPanel ? (
        <div
          ref={rightPanelSlotRef}
          id="chat-right-slot"
          className="absolute right-0 top-0 z-20 flex max-h-[70dvh] w-(--chat-right-panel-width) max-w-[calc(100%-1rem)] min-w-0 p-2"
        >
          <button
            type="button"
            className="group absolute inset-y-2 left-2 z-20 flex w-2 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center focus-visible:outline-hidden"
            onPointerDown={startResize}
            onKeyDown={resizeWithKeyboard}
            aria-label="Resize workspace files"
          >
            <ResizeHandleIndicator className="group-hover:opacity-100 group-focus-visible:via-accent1 group-focus-visible:opacity-100 in-data-[panel-gesture=active]:via-neutral6/45 in-data-[panel-gesture=active]:opacity-100" />
          </button>
          <div className="relative flex max-h-[calc(70dvh-1rem)] min-h-0 w-full overflow-hidden rounded-xl border border-border1/40 bg-surface3 shadow-main-frame">
            {rightPanel}
            {onRightPanelClose ? (
              <Button
                size="icon-md"
                variant="ghost"
                tooltip="Close workspace files"
                className="absolute right-2 top-2 z-10 rounded-md"
                onClick={onRightPanelClose}
                aria-label="Close workspace files"
                aria-expanded="true"
              >
                <PanelRightIcon />
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { PageLayout } from './PageLayout';

function FilledArrowLeft() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" focusable="false">
      <path d="M7 1.5L3 5L7 8.5V1.5Z" fill="currentColor" />
    </svg>
  );
}

type ChatLayoutProps = {
  sidebar: ReactNode;
  /** Optional bar above the chat content (e.g. mobile sidebar toggle). */
  header?: ReactNode;
  content?: ReactNode;
  /** A complete main area when content and footer need to share one provider boundary. */
  main?: ReactNode;
  /** Optional pinned region below the chat content (e.g. composer). */
  footer?: ReactNode;
  /** Optional desktop-only panel attached to the right side of chat. */
  rightPanel?: ReactNode;
  rightPanelExpanded?: boolean;
  rightPanelAvailable?: boolean;
  onRightPanelOpen?: () => void;
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
}: ChatLayoutProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  return (
    <PageLayout sidebar={sidebar} header={header}>
      <div ref={frameRef} className="relative flex h-full min-w-0 flex-1 overflow-visible">
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          {main ?? (
            <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
              {content}
              {footer}
            </div>
          )}
        </div>
        {rightPanel ? (
          <DesktopRightPanelFrame
            frameRef={frameRef}
            initialWidth={rightPanelExpanded ? EXPANDED_RIGHT_PANEL_WIDTH : COMPACT_RIGHT_PANEL_WIDTH}
          >
            {rightPanel}
          </DesktopRightPanelFrame>
        ) : null}
        {!rightPanel && rightPanelAvailable ? (
          <button
            type="button"
            className="absolute right-2 top-2 hidden items-center text-icon6 lg:inline-flex"
            onClick={onRightPanelOpen}
            aria-label="Open workspace files"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border2 bg-surface1 shadow-sm hover:bg-surface2">
              <FilledArrowLeft />
            </span>
          </button>
        ) : null}
      </div>
    </PageLayout>
  );
}

function DesktopRightPanelFrame({
  frameRef,
  initialWidth,
  children,
}: {
  frameRef: RefObject<HTMLDivElement | null>;
  initialWidth: number;
  children: ReactNode;
}) {
  const [resizedWidth, setResizedWidth] = useState<number | undefined>();
  const resizeCleanupRef = useRef<(() => void) | undefined>(undefined);
  const rightPanelWidth = resizedWidth ?? initialWidth;

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const clampRightPanelWidth = (width: number) => {
    const frameWidth = frameRef.current?.clientWidth ?? window.innerWidth;
    const maxWidth = Math.max(MIN_RIGHT_PANEL_WIDTH, frameWidth - MIN_CHAT_WIDTH);
    return Math.min(maxWidth, Math.max(MIN_RIGHT_PANEL_WIDTH, width));
  };

  const startRightPanelResize = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startWidth = rightPanelWidth;
    const onPointerMove = (moveEvent: PointerEvent) => {
      setResizedWidth(clampRightPanelWidth(startWidth - (moveEvent.clientX - startX)));
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      resizeCleanupRef.current = undefined;
    };
    resizeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  return (
    <>
      <div
        className="hidden w-1 shrink-0 cursor-col-resize bg-border1 hover:bg-accent1 lg:block"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize workspace panel"
        onPointerDown={startRightPanelResize}
      />
      <div className="hidden h-full min-w-0 shrink-0 overflow-visible lg:block" style={{ width: rightPanelWidth }}>
        {children}
      </div>
    </>
  );
}

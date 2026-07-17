import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

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
  /** Mobile-only: whether the sidebar overlay is open (controls the backdrop). */
  sidebarOpen?: boolean;
  onSidebarClose?: () => void;
};

const COMPACT_RIGHT_PANEL_WIDTH = 320;
const EXPANDED_RIGHT_PANEL_WIDTH = 720;
const MIN_RIGHT_PANEL_WIDTH = 260;
const MIN_CHAT_WIDTH = 420;

/**
 * Pure slot-based layout primitive for the chat page. Owns the responsive
 * frame: sidebar column, mobile backdrop, header bar, scrollable content
 * region, and pinned footer. No domain hooks — callers fill the slots.
 */
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
  sidebarOpen = false,
  onSidebarClose,
}: ChatLayoutProps) {
  const [rightPanelWidth, setRightPanelWidth] = useState(COMPACT_RIGHT_PANEL_WIDTH);
  const frameRef = useRef<HTMLDivElement>(null);
  const resizeCleanupRef = useRef<(() => void) | undefined>(undefined);
  const backdropVisibilityClass = sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0';

  useEffect(() => {
    setRightPanelWidth(rightPanelExpanded ? EXPANDED_RIGHT_PANEL_WIDTH : COMPACT_RIGHT_PANEL_WIDTH);
  }, [rightPanelExpanded]);

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
      setRightPanelWidth(clampRightPanelWidth(startWidth - (moveEvent.clientX - startX)));
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
    <div className="relative z-1 flex h-screen gap-3 overflow-y-scroll bg-surface1 pb-3 pl-3 pt-3 md:gap-4 md:pb-4 md:pl-4 md:pt-4">
      <aside className="overflow-y-scroll md:relative md:z-40 md:block md:h-full md:w-64 md:shrink-0 md:rounded-lg md:border md:border-border1 md:bg-surface2 md:shadow-sm">
        {sidebar}
      </aside>

      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 md:hidden ${backdropVisibilityClass}`}
        onClick={onSidebarClose}
        aria-hidden="true"
      />

      <div ref={frameRef} className="relative z-1 flex h-full min-w-0 flex-1 overflow-visible">
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-scroll">
          {header}
          {main ?? (
            <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
              {content}
              {footer}
            </div>
          )}
        </div>
        {rightPanel ? (
          <>
            <div
              className="hidden w-1 shrink-0 cursor-col-resize bg-border1 hover:bg-accent1 lg:block"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize workspace panel"
              onPointerDown={startRightPanelResize}
            />
            <div className="hidden h-full min-w-0 shrink-0 overflow-visible lg:block" style={{ width: rightPanelWidth }}>
              {rightPanel}
            </div>
          </>
        ) : null}
        {!rightPanel && rightPanelAvailable ? (
          <button
            type="button"
            className="absolute right-2 top-2 hidden items-center gap-1.5 text-icon6 lg:inline-flex"
            onClick={onRightPanelOpen}
            aria-label="Open workspace files"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border2 bg-surface1 shadow-sm hover:bg-surface2">
              <FilledArrowLeft />
            </span>
            <span className="text-ui-xs font-medium">Files</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

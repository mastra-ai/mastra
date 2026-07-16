import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

const COMPACT_RIGHT_PANEL_WIDTH = 320;
const EXPANDED_RIGHT_PANEL_WIDTH = 760;

type ChatLayoutProps = {
  sidebar: ReactNode;
  /** Optional bar above the chat content (e.g. mobile sidebar toggle). */
  header?: ReactNode;
  content: ReactNode;
  /** Optional pinned region below the chat content (e.g. composer). */
  footer?: ReactNode;
  /** Optional desktop-only panel rendered to the right of chat. */
  rightPanel?: ReactNode;
  rightPanelExpanded?: boolean;
  /** Mobile-only: whether the sidebar overlay is open (controls the backdrop). */
  sidebarOpen?: boolean;
  onSidebarClose?: () => void;
};

/**
 * Pure slot-based layout primitive for the chat page. Owns the responsive
 * frame: sidebar column, mobile backdrop, header bar, scrollable content
 * region, and pinned footer. No domain hooks — callers fill the slots.
 */
export function ChatLayout({
  sidebar,
  header,
  content,
  footer,
  rightPanel,
  rightPanelExpanded = false,
  sidebarOpen = false,
  onSidebarClose,
}: ChatLayoutProps) {
  const backdropVisibilityClass = sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0';
  const [rightPanelWidth, setRightPanelWidth] = useState(COMPACT_RIGHT_PANEL_WIDTH);
  const resizeCleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    setRightPanelWidth(rightPanelExpanded ? EXPANDED_RIGHT_PANEL_WIDTH : COMPACT_RIGHT_PANEL_WIDTH);
  }, [rightPanelExpanded]);

  useEffect(() => () => resizeCleanupRef.current?.(), []);

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startWidth = rightPanelWidth;
    const containerWidth = event.currentTarget.parentElement?.clientWidth ?? window.innerWidth;
    const maxWidth = Math.max(COMPACT_RIGHT_PANEL_WIDTH, containerWidth - COMPACT_RIGHT_PANEL_WIDTH);
    const onPointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth - (moveEvent.clientX - startX);
      setRightPanelWidth(Math.min(maxWidth, Math.max(COMPACT_RIGHT_PANEL_WIDTH, nextWidth)));
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
    <div className="relative z-1 flex h-screen gap-3 overflow-hidden bg-surface1 pb-3 pl-3 pt-3 md:gap-4 md:pb-4 md:pl-4 md:pt-4">
      <aside className="overflow-y-scroll md:relative md:z-40 md:block md:h-full md:w-64 md:shrink-0 md:rounded-lg md:border md:border-border1 md:bg-surface2 md:shadow-sm">
        {sidebar}
      </aside>

      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 md:hidden ${backdropVisibilityClass}`}
        onClick={onSidebarClose}
        aria-hidden="true"
      />

      <div className="relative z-1 flex h-full min-w-0 flex-1 overflow-hidden">
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-scroll">
          {header}
          <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
            {content}
            {footer}
          </div>
        </div>

        {rightPanel ? (
          <>
            <div
              className="hidden w-1 shrink-0 cursor-col-resize rounded-full bg-border1 hover:bg-accent1 lg:block"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize workspace panel"
              onPointerDown={startResize}
            />
            <div className="hidden h-full min-w-0 shrink-0 overflow-hidden lg:block" style={{ width: rightPanelWidth }}>
              {rightPanel}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

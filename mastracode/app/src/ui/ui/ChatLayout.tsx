import type { ReactNode } from 'react';

import { useMastraCodeHost } from '../../host-context';

type ChatLayoutProps = {
  sidebar: ReactNode;
  /** Optional bar above the chat content (e.g. mobile sidebar toggle). */
  header?: ReactNode;
  content: ReactNode;
  /** Optional pinned region below the chat content (e.g. composer). */
  footer?: ReactNode;
  /** Mobile-only: whether the sidebar overlay is open (controls the backdrop). */
  sidebarOpen?: boolean;
  onSidebarClose?: () => void;
};

/**
 * Pure slot-based layout primitive for the chat page. Owns the responsive
 * frame: sidebar column, mobile backdrop, header bar, scrollable content
 * region, and pinned footer. No domain hooks — callers fill the slots.
 */
export function ChatLayout({ sidebar, header, content, footer, sidebarOpen = false, onSidebarClose }: ChatLayoutProps) {
  const host = useMastraCodeHost();
  const backdropVisibilityClass = sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0';
  const desktopHosted = host.kind === 'desktop';
  const topPaddingClass = desktopHosted ? 'pt-10 md:pt-10' : 'pt-3 md:pt-4';

  return (
    <div
      className={`relative z-1 flex h-screen gap-3 overflow-y-scroll bg-surface1 pb-3 pl-3 md:gap-4 md:pb-4 md:pl-4 ${topPaddingClass}`}
    >
      {desktopHosted && <div className="mastracode-desktop-drag-region" aria-hidden="true" />}
      <aside className="overflow-y-scroll md:relative md:z-40 md:block md:h-full md:w-64 md:shrink-0 md:rounded-lg md:border md:border-border1 md:bg-surface2 md:shadow-sm">
        {sidebar}
      </aside>

      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity duration-200 md:hidden ${backdropVisibilityClass}`}
        onClick={onSidebarClose}
        aria-hidden="true"
      />

      <div className="relative z-1 flex h-full min-w-0 flex-1 flex-col overflow-y-scroll">
        {header}
        <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
          {content}
          {footer}
        </div>
      </div>
    </div>
  );
}

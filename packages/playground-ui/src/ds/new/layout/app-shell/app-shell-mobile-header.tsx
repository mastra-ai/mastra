import { useContext, useState } from 'react';
import type { ReactNode } from 'react';

import { MobileHeaderSlotContext } from './mobile-header-slot';
import { cn } from '@/lib/utils';

export function MobileHeaderSlotProvider({ children }: { children: ReactNode }) {
  // The state setter is the header's ref callback: stable, and React hands it `null` on unmount.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <MobileHeaderSlotContext.Provider value={{ slot: slot ?? undefined, setSlot }}>
      {children}
    </MobileHeaderSlotContext.Provider>
  );
}

export interface AppShellMobileHeaderProps {
  /** Leading control, usually `Sidebar.MobileTrigger`. */
  start?: ReactNode;
  /** Shown when the current page has no breadcrumbs, e.g. the logo and app name. */
  fallback?: ReactNode;
  /** Trailing app-level controls (search, account, plan badge). */
  end?: ReactNode;
  className?: string;
}

/**
 * The app's top bar below `lg`, for the `AppShell` `mobileHeader` slot. A `PageLayout` in the shell
 * renders its breadcrumbs and header actions here instead of in its own header row, so phones get
 * one header instead of two. Pages without breadcrumbs show `fallback`.
 */
export function AppShellMobileHeader({ start, fallback, end, className }: AppShellMobileHeaderProps) {
  const setSlot = useContext(MobileHeaderSlotContext)?.setSlot;

  return (
    <header
      data-slot="app-shell-mobile-header"
      className={cn(
        'group/mobile-header sticky top-0 z-20 flex h-12 shrink-0 items-center gap-1 border-b border-border bg-sidebar px-1.5 lg:hidden',
        className,
      )}
    >
      {start}
      {fallback && (
        <div
          data-slot="app-shell-mobile-header-fallback"
          className="flex min-w-0 items-center gap-2 pl-1 group-has-[[data-slot=page-layout-mobile-crumbs]]/mobile-header:hidden"
        >
          {fallback}
        </div>
      )}
      <div
        ref={setSlot}
        data-slot="app-shell-mobile-header-page"
        className="flex min-w-0 flex-1 items-center gap-1 empty:hidden"
      />
      {end && <div className="ml-auto flex shrink-0 items-center gap-1">{end}</div>}
    </header>
  );
}

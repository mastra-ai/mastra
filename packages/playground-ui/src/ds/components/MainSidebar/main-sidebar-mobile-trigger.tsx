import { MenuIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useMainSidebar } from './main-sidebar-context';
import { cn } from '@/lib/utils';

export type MainSidebarMobileTriggerProps = ComponentPropsWithoutRef<'button'> & {
  /** Override the hamburger icon. */
  icon?: React.ReactNode;
};

export function MainSidebarMobileTrigger({
  className,
  icon,
  'aria-label': ariaLabel = 'Open navigation menu',
  onClick,
  ...props
}: MainSidebarMobileTriggerProps) {
  // Always render; visibility toggled via scope's `data-sidebar-mobile` attribute.
  // SSR-stable and respects the configured `mobileBreakpoint`.
  const { isMobile, setOpenMobile } = useMainSidebar();
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-hidden={!isMobile}
      tabIndex={isMobile ? 0 : -1}
      data-mobile-only
      {...props}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpenMobile(true);
      }}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-md',
        'in-data-[sidebar-mobile=false]:hidden',
        'text-neutral4 hover:text-neutral6 hover:bg-surface3',
        'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1',
        className,
      )}
    >
      {icon ?? <MenuIcon className="size-5" />}
    </button>
  );
}

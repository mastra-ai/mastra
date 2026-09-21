import { MenuIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useMainSidebar } from './main-sidebar-context';
import { quietTextHover } from '@/ds/primitives/typography';
import { cn } from '@/lib/utils';

export type MainSidebarMobileTriggerProps = ComponentPropsWithoutRef<'button'> & {
  icon?: React.ReactNode;
};

export function MainSidebarMobileTrigger({
  className,
  icon,
  'aria-label': ariaLabel = 'Open navigation menu',
  onClick,
  ...props
}: MainSidebarMobileTriggerProps) {
  const { isMobile, mobileTriggerRef, setOpenMobile } = useMainSidebar();
  return (
    <button
      ref={mobileTriggerRef}
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
        // compound selector, not `in-*` — its `:where()` ties with a consumer's later `.inline-flex`
        "[[data-sidebar-mobile='false']_&]:hidden",
        "[[data-sidebar-mobile-present='true']_&]:invisible",
        quietTextHover,
        'hover:bg-fill-subtle',
        'focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:outline-hidden',
        className,
      )}
    >
      {icon ?? <MenuIcon className="size-5" />}
    </button>
  );
}

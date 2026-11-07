import { MenuIcon } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import { useSidebar } from './sidebar-context';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export type SidebarMobileTriggerProps = Omit<ComponentPropsWithoutRef<'button'>, 'children'> & {
  icon?: React.ReactNode;
};

export function SidebarMobileTrigger({
  className,
  icon,
  'aria-label': ariaLabel = 'Open navigation menu',
  onClick,
  ...props
}: SidebarMobileTriggerProps) {
  const { isMobile, mobileTriggerRef, setOpenMobile } = useSidebar();
  return (
    <Button
      ref={mobileTriggerRef}
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={ariaLabel}
      aria-hidden={!isMobile}
      tabIndex={isMobile ? 0 : -1}
      data-mobile-only
      {...props}
      onClick={event => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        mobileTriggerRef.current = event.currentTarget;
        setOpenMobile(true);
      }}
      className={cn(
        'relative before:absolute before:-inset-2',
        // compound selector, not `in-*` — its `:where()` ties with a consumer's later `.inline-flex`
        "[[data-sidebar-mobile='false']_&]:hidden",
        "[[data-sidebar-mobile-present='true']_&]:invisible",
        className,
      )}
    >
      {icon ?? <MenuIcon />}
    </Button>
  );
}

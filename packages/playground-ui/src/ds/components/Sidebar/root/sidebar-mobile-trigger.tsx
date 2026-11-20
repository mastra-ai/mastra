import { useSidebar } from './sidebar-context';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { IconBarsThree } from '@/ds/icons/central/IconBarsThree';
import { cn } from '@/lib/utils';

export type SidebarMobileTriggerProps = Omit<ButtonProps, 'variant' | 'size' | 'tooltip' | 'children'> & {
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
        if (!event.defaultPrevented) setOpenMobile(true);
      }}
      className={cn(
        'shrink-0',
        // compound selector, not `in-*` — its `:where()` ties with a consumer's later `.inline-flex`
        "[[data-sidebar-mobile='false']_&]:hidden",
        className,
      )}
    >
      {icon ?? <IconBarsThree />}
    </Button>
  );
}

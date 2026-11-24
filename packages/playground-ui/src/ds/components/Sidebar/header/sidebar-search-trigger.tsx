import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';
import { ShortcutHint } from '@/ds/components/Kbd/shortcut-hint';
import { IconMagnifyingGlass } from '@/ds/icons/central/IconMagnifyingGlass';

export type SidebarSearchTriggerProps = Omit<ButtonProps, 'variant' | 'size' | 'tooltip' | 'children'> & {
  label?: string;
  shortcut?: ReactNode;
  children?: ReactNode;
};

export const SidebarSearchTrigger = forwardRef<HTMLButtonElement, SidebarSearchTriggerProps>(
  function SidebarSearchTrigger(
    { label = 'Search', shortcut, children, 'aria-label': ariaLabel, type = 'button', ...props },
    ref,
  ) {
    return (
      <Button
        ref={ref}
        data-slot="sidebar-search-trigger"
        type={type}
        variant="ghost"
        size="icon-sm"
        aria-label={ariaLabel ?? label}
        tooltip={<ShortcutHint label={label} shortcut={shortcut} />}
        tooltipPosition="bottom"
        {...props}
      >
        {children ?? <IconMagnifyingGlass />}
      </Button>
    );
  },
);

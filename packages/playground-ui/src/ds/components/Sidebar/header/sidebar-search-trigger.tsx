import { SearchIcon } from 'lucide-react';
import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../Button';
import type { ButtonProps } from '../../Button';
import { SidebarButtonHint } from './sidebar-button-hint';

export type SidebarSearchTriggerProps = Omit<ButtonProps, 'variant' | 'size' | 'tooltip' | 'children'> & {
  /** Tooltip label, and the accessible name unless `aria-label` is set. Defaults to `Search`. */
  label?: string;
  /** Shortcut shown in the tooltip next to the label, e.g. `⌘ K`. */
  shortcut?: ReactNode;
  /** The icon. Defaults to a search glyph. */
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
        tooltip={<SidebarButtonHint label={label} shortcut={shortcut} />}
        tooltipPosition="bottom"
        {...props}
      >
        {children ?? <SearchIcon />}
      </Button>
    );
  },
);

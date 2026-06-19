import { cn } from '@/lib/utils';

type ItemStyleOptions = {
  isActive?: boolean;
  isCollapsed?: boolean;
  isFeatured?: boolean;
};

/**
 * Shared classes for any sidebar nav row element (anchor, button, custom).
 * Apply directly to the interactive element so `asChild` and custom slotted
 * elements all receive the same styling.
 */
export const navItemClasses = ({ isActive, isCollapsed, isFeatured }: ItemStyleOptions = {}) =>
  cn(
    'flex cursor-pointer items-center text-ui-md text-neutral3 rounded-lg h-9 min-w-0 whitespace-nowrap',
    'transition-all duration-normal ease-out-custom motion-reduce:transition-none',
    '[&_svg]:w-4 [&_svg]:h-4 [&_svg]:shrink-0 [&_svg]:text-neutral3/70 [&_svg]:transition-colors [&_svg]:duration-normal motion-reduce:[&_svg]:transition-none',
    'hover:bg-sidebar-nav-hover hover:text-neutral6 [&:hover_svg]:text-neutral5',
    'focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:shadow-focus-ring',
    !isCollapsed && 'w-full gap-2 py-1 px-3 justify-start',
    isCollapsed && 'w-full p-0 justify-center',
    isActive &&
      'text-neutral6 bg-sidebar-nav-active hover:bg-sidebar-nav-active hover:text-neutral6 [&_svg]:text-neutral6 [&:hover_svg]:text-neutral6',
    isCollapsed && !isActive && '[&_svg]:text-neutral3',
    isFeatured && 'my-2 bg-accent1Dark hover:bg-accent1Darker text-accent1 hover:text-accent1 border border-accent1/30',
    isFeatured &&
      'dark:bg-accent1 dark:hover:bg-accent1/90 dark:text-black dark:hover:text-black dark:border-transparent',
    isFeatured &&
      '[&_svg]:text-accent1 [&:hover_svg]:text-accent1 dark:[&_svg]:text-black/75 dark:[&:hover_svg]:text-black',
  );

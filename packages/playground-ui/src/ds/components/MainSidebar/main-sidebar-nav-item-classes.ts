import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const navItemVariants = cva('flex min-w-0 cursor-pointer items-center rounded-lg whitespace-nowrap text-neutral3', {
  variants: {
    size: {
      default: 'h-9 text-ui-md',
      sm: 'h-8 text-ui-sm',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

type NavItemVariantProps = VariantProps<typeof navItemVariants>;

export type MainSidebarNavItemSize = NonNullable<NavItemVariantProps['size']>;

type ItemStyleOptions = {
  isActive?: boolean;
  isCollapsed?: boolean;
  isFeatured?: boolean;
  level?: number;
  size?: MainSidebarNavItemSize;
};

const nestedExpandedItemClasses = (level: number) => {
  if (level <= 0) return 'w-full gap-2 py-1 px-3 justify-start';
  if (level === 1) return 'w-full gap-2 py-1 pr-3 pl-8 justify-start text-ui-sm h-8';
  if (level === 2) return 'w-full gap-2 py-1 pr-3 pl-10 justify-start text-ui-sm h-8';
  return 'w-full gap-2 py-1 pr-3 pl-12 justify-start text-ui-sm h-8';
};

/**
 * Shared classes for any sidebar nav row element (anchor, button, custom).
 * Apply directly to the interactive element so `asChild` and custom slotted
 * elements all receive the same styling.
 */
export const navItemClasses = ({ isActive, isCollapsed, isFeatured, level = 0, size }: ItemStyleOptions = {}) =>
  cn(
    navItemVariants({ size }),
    'duration-normal transition-all ease-out-custom motion-reduce:transition-none',
    '[&_svg]:duration-normal [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-neutral3/70 [&_svg]:transition-colors motion-reduce:[&_svg]:transition-none',
    'hover:bg-sidebar-nav-hover hover:text-neutral6 [&:hover_svg]:text-neutral5',
    'focus-visible:shadow-focus-ring focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:outline-hidden',
    !isCollapsed && nestedExpandedItemClasses(level),
    isCollapsed && 'w-full justify-center p-0',
    isActive &&
      'bg-sidebar-nav-active text-neutral6 hover:bg-sidebar-nav-active hover:text-neutral6 [&_svg]:text-neutral6 [&:hover_svg]:text-neutral6',
    isCollapsed && !isActive && '[&_svg]:text-neutral3',
    isFeatured && 'my-2 border border-accent1/30 bg-accent1Dark text-accent1 hover:bg-accent1Darker hover:text-accent1',
    isFeatured &&
      'dark:border-transparent dark:bg-accent1 dark:text-black dark:hover:bg-accent1/90 dark:hover:text-black',
    isFeatured &&
      '[&_svg]:text-accent1 dark:[&_svg]:text-black/75 [&:hover_svg]:text-accent1 dark:[&:hover_svg]:text-black',
  );

import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const navItemVariants = cva('flex min-w-0 cursor-pointer items-center rounded-lg whitespace-nowrap', {
  variants: {
    size: {
      default: 'h-8 text-ui-md',
      sm: 'h-7 text-ui-sm',
      lg: 'h-9 text-ui-md',
    },
  },
  defaultVariants: {
    size: 'sm',
  },
});

type NavItemVariantProps = VariantProps<typeof navItemVariants>;

export type MainSidebarNavItemSize = NonNullable<NavItemVariantProps['size']>;

type NavRowSurfaceOptions = {
  isActive?: boolean;
  isFeatured?: boolean;
};

type NavItemLayoutOptions = {
  isCollapsed?: boolean;
  level?: number;
  size?: MainSidebarNavItemSize;
};

type ItemStyleOptions = NavRowSurfaceOptions & NavItemLayoutOptions;

const nestedExpandedItemClasses = (level: number) => {
  if (level <= 0) return 'w-full gap-2 py-1 px-3 justify-start';
  if (level === 1) return 'w-full gap-2 py-1 pr-3 pl-8 justify-start text-ui-sm h-8';
  if (level === 2) return 'w-full gap-2 py-1 pr-3 pl-10 justify-start text-ui-sm h-8';
  return 'w-full gap-2 py-1 pr-3 pl-12 justify-start text-ui-sm h-8';
};

const idleSurface = cn(
  'rounded-lg text-(--text-secondary) [&_svg]:text-(--text-secondary)/70',
  'hover:bg-sidebar-nav-hover hover:text-(--text-primary) [&:hover_svg]:text-(--text-primary)',
);

const activeSurface =
  'bg-sidebar-nav-active text-(--text-primary) hover:bg-sidebar-nav-active hover:text-(--text-primary) [&_svg]:text-(--text-primary) [&:hover_svg]:text-(--text-primary)';

const featuredSurface = cn(
  'my-2 border border-green-7/30 bg-green-3 text-success hover:bg-green-2 hover:text-success',
  'dark:border-transparent dark:bg-green-7 dark:text-(--text-on-accent) dark:hover:bg-green-7/90 dark:hover:text-(--text-on-accent)',
  '[&_svg]:text-success dark:[&_svg]:text-(--text-on-accent)/75 [&:hover_svg]:text-success dark:[&:hover_svg]:text-(--text-on-accent)',
);

/**
 * Color chrome of a nav row: background, text, and icon states. Belongs on
 * whatever element spans the whole row box — the interactive element itself, or
 * the flex wrapper holding it next to a trailing action.
 */
export const navRowSurfaceClasses = ({ isActive, isFeatured }: NavRowSurfaceOptions) =>
  cn(idleSurface, isActive && activeSurface, isFeatured && featuredSurface);

/** Box and typography of a nav row, without the colour chrome. */
export const navItemLayoutClasses = ({ isCollapsed, level = 0, size }: NavItemLayoutOptions) =>
  cn(
    navItemVariants({ size }),
    'transition-all duration-normal ease-out-custom motion-reduce:transition-none',
    '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-colors [&_svg]:duration-normal motion-reduce:[&_svg]:transition-none',
    'focus-visible:shadow-focus-ring focus-visible:ring-1 focus-visible:ring-focus focus-visible:outline-hidden',
    !isCollapsed && nestedExpandedItemClasses(level),
    isCollapsed && 'w-full justify-center p-0',
  );

/**
 * Shared classes for any sidebar nav row element (anchor, button, custom).
 * Apply directly to the interactive element so `asChild` and custom slotted
 * elements all receive the same styling.
 */
export const navItemClasses = ({ isActive, isCollapsed, isFeatured, level, size }: ItemStyleOptions = {}) =>
  cn(
    navItemLayoutClasses({ isCollapsed, level, size }),
    navRowSurfaceClasses({ isActive, isFeatured }),
    isCollapsed && !isActive && '[&_svg]:text-(--text-secondary)',
  );

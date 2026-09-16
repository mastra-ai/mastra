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
  'rounded-lg text-muted-foreground [&_svg]:text-muted-foreground/70',
  'hover:bg-sidebar-accent hover:text-foreground [&:hover_svg]:text-foreground',
);

const activeSurface =
  'bg-selected text-foreground hover:bg-selected hover:text-foreground [&_svg]:text-foreground [&:hover_svg]:text-foreground';

const featuredSurface = cn(
  'my-2 border border-accent1/30 bg-accent1Dark text-accent1 hover:bg-accent1Darker hover:text-accent1',
  'dark:border-transparent dark:bg-accent1 dark:text-black dark:hover:bg-accent1/90 dark:hover:text-black',
  '[&_svg]:text-accent1 dark:[&_svg]:text-black/75 [&:hover_svg]:text-accent1 dark:[&:hover_svg]:text-black',
);

export const navRowSurfaceClasses = ({ isActive, isFeatured }: NavRowSurfaceOptions) =>
  cn(idleSurface, isActive && activeSurface, isFeatured && featuredSurface);

export const navItemLayoutClasses = ({ isCollapsed, level = 0, size }: NavItemLayoutOptions) =>
  cn(
    navItemVariants({ size }),
    'transition-all duration-normal ease-out-custom motion-reduce:transition-none',
    '[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-colors [&_svg]:duration-normal motion-reduce:[&_svg]:transition-none',
    'focus-visible:shadow-focus-ring focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:outline-hidden',
    !isCollapsed && nestedExpandedItemClasses(level),
    isCollapsed && 'w-full justify-center p-0',
  );

export const navItemClasses = ({ isActive, isCollapsed, isFeatured, level, size }: ItemStyleOptions = {}) =>
  cn(
    navItemLayoutClasses({ isCollapsed, level, size }),
    navRowSurfaceClasses({ isActive, isFeatured }),
    isCollapsed && !isActive && '[&_svg]:text-muted-foreground',
  );

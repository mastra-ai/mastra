import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import { controlHeight } from '@/ds/primitives/control-size';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

// A nav row is a control: same rhythm as a button or a field, from the same rungs, so a
// sidebar row and a toolbar button in the same app are never 2px apart. A nav label is a
// label at every row height, so only the box grows — 12px reads too small for a primary
// navigation target, and 400 weight makes the label recede below its icon.
const navItemVariants = cva('flex min-w-0 cursor-pointer items-center rounded-lg text-label whitespace-nowrap', {
  variants: {
    size: {
      sm: controlHeight.sm,
      md: controlHeight.md,
      lg: controlHeight.lg,
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

type NavItemVariantProps = VariantProps<typeof navItemVariants>;

export type SidebarNavItemSize = NonNullable<NavItemVariantProps['size']>;

type NavRowSurfaceOptions = {
  isActive?: boolean;
  isFeatured?: boolean;
};

type NavItemLayoutOptions = {
  isCollapsed?: boolean;
  level?: number;
  size?: SidebarNavItemSize;
};

type ItemStyleOptions = NavRowSurfaceOptions & NavItemLayoutOptions;

const nestedExpandedItemClasses = (level: number) => {
  if (level <= 0) return 'gap-2 py-1 px-3';
  if (level === 1) return `gap-2 py-1 pr-3 pl-8 ${controlHeight.md}`;
  if (level === 2) return `gap-2 py-1 pr-3 pl-10 ${controlHeight.md}`;
  return `gap-2 py-1 pr-3 pl-12 ${controlHeight.md}`;
};

// A row whose label carries a `description` grows to hold the second line at every depth,
// and its direct icons take the first line's height (`1lh`) so their glyphs centre on the
// label, not the middle of the box. Keyed off the description itself, so a collapsed
// sidebar, which renders none, keeps the single-line row with no size prop to pair.
const withDescriptionClasses =
  'has-[[data-slot=sidebar-nav-description]]:h-auto has-[[data-slot=sidebar-nav-description]]:min-h-control-lg has-[[data-slot=sidebar-nav-description]]:items-start has-[[data-slot=sidebar-nav-description]]:py-1.5 has-[[data-slot=sidebar-nav-description]]:[&>svg]:h-lh';

// Two neutral tones, never more: a row is either quiet (`muted-foreground`) or
// current (`foreground`). Icons inherit that colour — lucide strokes with
// `currentColor` — so there is nothing to restate per state.
// One fill per row, painted on the row's own box: hover and current never stack or differ
// in size, and there is no pressed state to flash before the row becomes current. This sits
// on the surface: the outer wrapper on rows with a trailing action, the link itself otherwise.
const idleSurface = 'rounded-lg text-muted-foreground hover:bg-fill-subtle hover:text-foreground';

const activeSurface = 'rounded-lg bg-fill text-foreground';

const featuredSurface = 'my-2 rounded-lg border border-transparent bg-brand-green text-black hover:brightness-95';

export const navRowSurfaceClasses = ({ isActive, isFeatured }: NavRowSurfaceOptions) => {
  if (isFeatured) return featuredSurface;
  if (isActive) return activeSurface;
  return idleSurface;
};

export const navItemLayoutClasses = ({ isCollapsed, level = 0, size }: NavItemLayoutOptions) =>
  cn(
    navItemVariants({ size }),
    'w-full justify-start',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    focusRing,
    !isCollapsed && nestedExpandedItemClasses(level),
    !isCollapsed && withDescriptionClasses,
    isCollapsed && 'gap-0 px-[13.5px] py-0',
  );

export const navItemClasses = ({ isActive, isCollapsed, isFeatured, level, size }: ItemStyleOptions = {}) =>
  cn(navItemLayoutClasses({ isCollapsed, level, size }), navRowSurfaceClasses({ isActive, isFeatured }));

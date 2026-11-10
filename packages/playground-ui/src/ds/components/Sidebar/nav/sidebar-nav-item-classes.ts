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

// Two neutral tones, never more: a row is either quiet (`muted-foreground`) or
// current (`foreground`). Icons inherit that colour — lucide strokes with
// `currentColor` — so there is nothing to restate per state.
// The row has no fill of its own, so hover and current paint the row's own background:
// one box for both, edge to edge, and nothing in between. No pressed rung: a click
// makes the row current, so a darker press would only flash before it. Rows in a list
// switch instantly, like menu rows: neither the fill nor the label fades. This sits on
// the surface: the outer wrapper on rows with a trailing action, the link itself otherwise.
const idleSurface = cn(
  'rounded-lg text-muted-foreground transition-none hover:text-foreground',
  'hover:not-disabled:not-aria-disabled:bg-fill-subtle focus-visible:bg-fill-subtle',
);

const activeSurface = 'bg-fill text-foreground hover:not-disabled:not-aria-disabled:bg-fill focus-visible:bg-fill';

const featuredSurface = cn(
  'my-2 border border-transparent bg-brand-green text-black hover:text-black hover:brightness-95',
  'hover:not-disabled:not-aria-disabled:bg-brand-green focus-visible:bg-brand-green',
);

export const navRowSurfaceClasses = ({ isActive, isFeatured }: NavRowSurfaceOptions) =>
  cn(idleSurface, isActive && activeSurface, isFeatured && featuredSurface);

export const navItemLayoutClasses = ({ isCollapsed, level = 0, size }: NavItemLayoutOptions) =>
  cn(
    navItemVariants({ size }),
    'w-full justify-start',
    '[&_svg]:size-4 [&_svg]:shrink-0',
    focusRing,
    !isCollapsed && nestedExpandedItemClasses(level),
    isCollapsed && 'gap-0 px-[13.5px] py-0',
  );

export const navItemClasses = ({ isActive, isCollapsed, isFeatured, level, size }: ItemStyleOptions = {}) =>
  cn(navItemLayoutClasses({ isCollapsed, level, size }), navRowSurfaceClasses({ isActive, isFeatured }));

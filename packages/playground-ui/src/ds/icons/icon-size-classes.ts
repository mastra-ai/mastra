export type IconSize = 'xs' | 'sm' | 'md' | 'lg';

// One rung per icon size. Line weight comes from `--icon-stroke-width` (see
// `components.css`), so nothing here sets a stroke. The selector is `[&>svg]`, so a
// control that renders a bare `<svg>` child rather than an `<Icon>` wrapper reads the
// same rung from this one map.
export const iconSizeClasses: Record<IconSize, string> = {
  xs: '[&>svg]:size-icon-xs',
  sm: '[&>svg]:size-icon-sm',
  md: '[&>svg]:size-icon-md',
  lg: '[&>svg]:size-icon-lg',
};

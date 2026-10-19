export type IconSize = 'xs' | 'sm' | 'md' | 'lg';

// One rung per icon size. The line weight follows the size: the base rule in
// `components.css` reads the `[&>svg]:size-icon-*` class and draws the glyph at the
// matching `--icon-stroke-*` token, so nothing here sets a stroke. The selector is
// `[&>svg]`, so a control that renders a bare `<svg>` child rather than an `<Icon>`
// wrapper reads the same rung from this one map.
export const iconSizeClasses: Record<IconSize, string> = {
  xs: '[&>svg]:size-icon-xs',
  sm: '[&>svg]:size-icon-sm',
  md: '[&>svg]:size-icon-md',
  lg: '[&>svg]:size-icon-lg',
};

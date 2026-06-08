// Shared size rhythm for interactive controls (Button, Input, Select trigger,
// InputGroup, and other form-shaped triggers). These height + text-size classes
// are the single source of truth so controls line up pixel-for-pixel when placed
// in the same row or composed inside a ButtonsGroup / InputGroup. Horizontal
// padding stays per-component (a button hugs its label tighter than an input
// hugs its text), so it deliberately lives in each component, not here.

export type ControlSize = 'xs' | 'sm' | 'md' | 'default' | 'lg';

// Height only — for square/icon controls and wrappers that own height on the
// border-box while their inner control inherits it.
export const controlHeight: Record<ControlSize, string> = {
  xs: 'h-form-xs',
  sm: 'h-form-sm',
  md: 'h-form-md',
  default: 'h-form-default',
  lg: 'h-form-lg',
};

// Height + matching text size — the common pairing for text-bearing controls.
export const controlSizeClasses: Record<ControlSize, string> = {
  xs: 'h-form-xs text-ui-xs',
  sm: 'h-form-sm text-ui-sm',
  md: 'h-form-md text-ui-md',
  default: 'h-form-default text-ui-md',
  lg: 'h-form-lg text-ui-lg',
};

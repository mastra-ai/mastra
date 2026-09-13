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
// Heights: xs 20px / sm 24px / md,default 28px / lg 32px; text 10/12/13/13/14px.
export const controlSizeClasses: Record<ControlSize, string> = {
  xs: 'h-form-xs text-ui-xs',
  sm: 'h-form-sm text-ui-sm',
  md: 'h-form-md text-ui-smd',
  default: 'h-form-default text-ui-smd',
  lg: 'h-form-lg text-ui-md',
};

export type ControlTriggerVisualVariant = 'default' | 'outline' | 'ghost';

export const controlTriggerOpenState: Record<ControlTriggerVisualVariant, string> = {
  default: 'data-[popup-open]:bg-surface5 data-[popup-open]:text-neutral6',
  outline: 'data-[popup-open]:bg-surface3 data-[popup-open]:text-neutral6 data-[popup-open]:border-border2',
  ghost: 'data-[popup-open]:bg-neutral6/5 data-[popup-open]:text-neutral6',
};

// Open-state classes for a trigger rendered with any Button variant; only the
// form-style variants have one (a `primary`/`destructive` trigger keeps its look).
export function controlTriggerOpenStateFor(variant: string | null | undefined): string | undefined {
  return variant === 'default' || variant === 'outline' || variant === 'ghost'
    ? controlTriggerOpenState[variant]
    : undefined;
}

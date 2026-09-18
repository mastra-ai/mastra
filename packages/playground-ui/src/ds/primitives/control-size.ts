// Shared size rhythm for interactive controls (Button, Input, Select trigger,
// InputGroup, and other form-shaped triggers). These height + text-size classes
// are the single source of truth so controls line up pixel-for-pixel when placed
// in the same row or composed inside a ButtonsGroup / InputGroup. Horizontal
// padding stays per-component (a button hugs its label tighter than an input
// hugs its text), so it deliberately lives in each component, not here.

export type ControlSize = 'xs' | 'sm' | 'md' | 'lg';

// Height only — for square/icon controls and wrappers that own height on the
// border-box while their inner control inherits it.
export const controlHeight: Record<ControlSize, string> = {
  xs: 'h-form-xs',
  sm: 'h-form-sm',
  md: 'h-form-md',
  lg: 'h-form-lg',
};

// Height + matching text size — the common pairing for text-bearing controls.
// Heights: xs 20px / sm 24px / md 28px / lg 28px; text 10/12/13/14px.
// `md` and `lg` share a height on purpose: `lg` only bumps the text size and
// per-component padding, so a large button and a large input still align.
export const controlSizeClasses: Record<ControlSize, string> = {
  xs: 'h-form-xs text-ui-xs',
  sm: 'h-form-sm text-ui-sm',
  md: 'h-form-md text-ui-smd',
  lg: 'h-form-lg text-ui-md',
};

export type ControlTriggerVisualVariant = 'default' | 'outline' | 'ghost';

// Open ("popup-open") state per variant. `default` is the Button's own hover
// (for Button-shaped triggers: DropdownMenu, Popover, DateTimePicker); `field`
// is the Input-family overlay used by the filled Select/Combobox triggers.
export const controlTriggerOpenState: Record<ControlTriggerVisualVariant | 'field', string> = {
  default: 'data-[popup-open]:bg-foreground/14 data-[popup-open]:text-foreground',
  field: 'data-[popup-open]:bg-foreground/14 data-[popup-open]:text-foreground',
  outline: 'data-[popup-open]:bg-foreground/4 data-[popup-open]:text-foreground data-[popup-open]:border-foreground/45',
  ghost: 'data-[popup-open]:bg-foreground/4 data-[popup-open]:text-foreground',
};

// Open-state classes for a trigger rendered with any Button variant; only the
// form-style variants have one (a `primary`/`destructive` trigger keeps its look).
export function controlTriggerOpenStateFor(variant: string | null | undefined): string | undefined {
  return variant === 'default' || variant === 'outline' || variant === 'ghost'
    ? controlTriggerOpenState[variant]
    : undefined;
}

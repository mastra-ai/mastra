import * as React from 'react';

// Shared size rhythm for interactive controls (Button, Input, Select trigger,
// InputGroup, and other form-shaped triggers). These height + text-size classes
// are the single source of truth so controls line up pixel-for-pixel when placed
// in the same row or composed inside a ButtonsGroup / InputGroup. Horizontal
// padding stays per-component (a button hugs its label tighter than an input
// hugs its text), so it deliberately lives in each component, not here.

export type ControlSize = 'sm' | 'md' | 'lg';

// The rung a wrapper imposes on the controls inside it (ButtonsGroup). A control's box is
// forced by the wrapper's stylesheet, which reaches segments a provider cannot name — Base
// UI renders a trigger as its own child. This carries what a stylesheet cannot reach
// instead: the type role and adornment scale a field keys off its own `data-size`.
export const ControlSizeContext = React.createContext<ControlSize | undefined>(undefined);

// Height only — for square/icon controls and wrappers that own height on the
// border-box while their inner control inherits it.
export const controlHeight: Record<ControlSize, string> = {
  sm: 'h-control-sm',
  md: 'h-control-md',
  lg: 'h-control-lg',
};

// Controls centre their label with flex, not with the line box, so `text-box-trim`
// is inert here: it trims line boxes in a block container, and a control's label is
// an anonymous flex item. Measured centring error is at most 0.6px, so the em box
// and its paired leading token carry this. Revisit only if a label moves to a
// block-level wrapper.

// Height + text role. Heights: sm 28px / md 30px / lg 32px. `md` is the default
// everywhere, and a control's label is a label at every height — the box grows, the
// type does not, which is why all three share `text-label` (13px/500, measured from
// Linear, whose buttons are 13px regardless of height). The 20px rung is gone: a
// control that small cannot hold a 13px label, and the pages here carry few enough
// items that they never needed it.
// The role carries the weight, so no control adds `font-medium` on top.
export const controlSizeClasses: Record<ControlSize, string> = {
  sm: 'h-control-sm text-label',
  md: 'h-control-md text-label',
  lg: 'h-control-lg text-label',
};

export type ControlTriggerVisualVariant = 'default' | 'ghost';

// Open ("popup-open") state per variant. `default` washes through `--surface-tint`, the
// layer its raised material expresses every other state in: its fill is a pinned card
// colour, and swapping that would drop the control out of the material it shares with a
// field. `ghost` has no material to wash, so it takes a fill rung.
export const controlTriggerOpenState: Record<ControlTriggerVisualVariant, string> = {
  default: 'data-[popup-open]:[--surface-tint:var(--fill)] data-[popup-open]:text-foreground',
  ghost: 'data-[popup-open]:bg-fill-subtle data-[popup-open]:text-foreground',
};

// Open-state classes for a trigger rendered with any Button variant; only the
// form-style variants have one (a `primary`/`destructive` trigger keeps its look).
export function controlTriggerOpenStateFor(variant: string | null | undefined): string | undefined {
  return variant === 'default' || variant === 'ghost' ? controlTriggerOpenState[variant] : undefined;
}

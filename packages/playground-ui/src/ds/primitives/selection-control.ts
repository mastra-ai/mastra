import { transitions } from './transitions';

// Surface language shared by Checkbox and Radio. The two differ only in radius
// and indicator glyph, so the surface lives here rather than in both files.
//
// Selection controls sit one rung brighter than field-sized surfaces: 16px of
// fill needs more weight than a full-width input to read. Checked flips to the
// solid `--foreground` chip; disabled resolves to muted roles (never opacity)
// so an off and an on control stay distinguishable while both read inert.
//
// Base UI renders both roots as `<span>`, so `:disabled` never matches and the
// disabled states hang off `data-disabled`.
export const selectionControlStyle = [
  'flex size-4 shrink-0 cursor-pointer items-center justify-center',
  'border border-border bg-fill-hover text-background outline-hidden',
  transitions.all,
  'hover:border-border-strong hover:bg-fill-active',
  'active:scale-95 active:border-border-hover active:bg-fill-strong',
  'focus-visible:border-border-focus focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-border-focus focus-visible:outline-solid',
  'data-[checked]:border-foreground data-[checked]:bg-foreground data-[checked]:text-background',
  'data-[checked]:hover:border-foreground/90 data-[checked]:hover:bg-foreground/90',
  'data-[checked]:active:border-foreground/75 data-[checked]:active:bg-foreground/75',
  'data-[disabled]:cursor-not-allowed data-[disabled]:border-border data-[disabled]:bg-fill-subtle data-[disabled]:active:scale-100',
  'data-[disabled]:data-[checked]:border-muted-foreground data-[disabled]:data-[checked]:bg-muted-foreground data-[disabled]:data-[checked]:text-background',
].join(' ');

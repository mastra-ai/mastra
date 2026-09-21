// Disabled controls resolve to dedicated muted roles rather than a blanket opacity:
// an opacity wash inherits whatever sits behind the control, so the same disabled
// field clears contrast on one surface and fails on another. The `not-disabled:`
// guards on each variant keep hover and active fills from painting over these.
export const sharedFormElementDisabledStyle = 'disabled:cursor-not-allowed disabled:text-muted-foreground';

// Surface half of the disabled language, for neutral controls that carry a fill.
// It recesses to the lowest rung of the fill ladder, one step below the resting
// `--fill`, so a disabled field reads quieter than an enabled one on every
// surface. Variants with their own hue (primary, destructive) keep that hue at
// reduced emphasis instead, so a disabled destructive action still reads as
// destructive. Transparent variants (ghost) opt out entirely: a disabled icon
// button in a toolbar should stay invisible rather than resolve into a pill.
export const disabledFilledSurfaceStyle = 'disabled:border-border disabled:bg-fill-subtle';
export const disabledOutlineSurfaceStyle = 'disabled:border-border disabled:bg-transparent';

// Focus indicator for the (green-less) input family. Instead of a heavy ring we
// reinforce the existing 1px border: on focus it brightens to a translucent
// `foreground` (theme-aware — light on dark surfaces, dark on light) that clears
// WCAG 1.4.11 non-text contrast (3:1) on any surface, where the resting `border`
// token alone does not. `focus-visible` for the bare control, `focus-within` for
// wrapper variants (InputGroup) whose focus lives on a nested input.
export const inputFocusBorderVisible = 'focus-visible:border-border-focus';
export const inputFocusBorderWithin = 'focus-within:border-border-focus';

// Canonical focus indicator for a bare interactive control (Button, etc.) in the
// non-accent input/border language: suppress the browser outline and let the 1px
// border brighten to the same translucent neutral the input family uses. This is
// what unifies button focus with input focus (no green accent ring). Wrappers
// whose focus lives on a nested control use `inputFocusBorderWithin` instead.
export const controlFocusBorderVisible = `outline-hidden focus-visible:outline-hidden ${inputFocusBorderVisible}`;

// Hover borders are guarded so they can never clobber the focus border. Tailwind
// can emit focus variants before hover variants, so an unguarded `hover:border-*`
// of equal specificity may win on a field that is focused AND hovered.
export const inputHoverBorderVisible = '[&:hover:not(:focus-visible):not(:disabled)]:border-border-hover';
// The wrapper itself is never `:disabled` — the control it wraps is — so the guard
// has to ask about descendants. Without it, hovering a group that contains a
// disabled input repaints the enabled border over the muted disabled one.
export const inputHoverBorderWithin = '[&:hover:not(:focus-within):not(:has(:disabled))]:border-border-hover';

// A field is the same material as a card: `bg-card` plus `shadow-raised`, which
// carries the 1px rim, so a field draws no border of its own. That is what makes a
// filter input and the panel beside it read as one system — in light the field is
// white on the off-white canvas, in dark it is the same step above it.
//
// Hover washes the fill, focus repaints the rim. Both go through `shadow-raised`:
// an `<input>` cannot carry a pseudo-element, so `--surface-tint` reaches into an
// inset layer of that utility and gives a field the same state layer a `Card` gets
// from `state-layer` — the rung a filter chip's segments already wear, which is the
// weight a resting field should move by. Brightening the rim on hover instead made
// every field in a form announce the pointer: the boundary is the loudest part of a
// surface that has no border of its own, so it is reserved for focus, where being
// unmissable is the point. Disabled is the exception that drops the card fill for
// the lowest translucent rung, which is how a disabled field reads as recessed.
//
// Focus sits at `--surface-rim-focus` rather than the `--border-focus` weight a bare
// outline needs, because the edge here bounds a surface that already reads as raised.
// Wrappers whose focus lives on a nested control (InputGroup, a chip) take the
// `within` flavour.
//
// Caller appends a radius (`rounded-full` for single-line inputs, `rounded-xl` for
// textareas).
// `:not([data-popup-open])` because a trigger's open rung is a plain attribute
// selector and would otherwise lose to this compound one while the pointer is
// still on the trigger that opened the popup.
const surfaceTintHover =
  '[&:hover:not(:focus-visible):not(:disabled):not([data-popup-open])]:[--surface-tint:var(--fill-subtle)]';
const surfaceRimFocus = 'focus-visible:[--surface-rim:var(--surface-rim-focus)]';

// The wrapper itself is never `:disabled` — the control it wraps is — so both
// guards have to ask about descendants.
const surfaceTintHoverWithin = '[&:hover:not(:focus-within):not(:has(:disabled))]:[--surface-tint:var(--fill-subtle)]';
const surfaceRimFocusWithin = 'focus-within:[--surface-rim:var(--surface-rim-focus)]';

export const inputSurfaceAndFocusStyle =
  'bg-card shadow-raised text-foreground disabled:bg-fill-subtle ' +
  surfaceTintHover +
  ' outline-hidden focus-visible:outline-hidden ' +
  surfaceRimFocus;

export const inputSurfaceAndFocusWithinStyle =
  'bg-card shadow-raised text-foreground has-[:disabled]:bg-fill-subtle ' +
  surfaceTintHoverWithin +
  ' outline-hidden focus-within:outline-hidden ' +
  surfaceRimFocusWithin;

// Outline fields share Button's outline ladder exactly: a visible resting border
// (`foreground/30`), brightening on hover, then the shared focus border.
export const inputOutlineAndFocusStyle =
  'bg-transparent border border-border-strong text-foreground ' +
  inputHoverBorderVisible +
  ' ' +
  'outline-hidden focus-visible:outline-hidden ' +
  inputFocusBorderVisible;

// Filled field trigger (Select/Combobox `default`): the same surface as Input.
// Applied *after* `buttonVariants` so tailwind-merge replaces the Button's fill
// and border with the field material — a field is not a button. The pins have to
// repeat the Button's own `not-disabled:` prefix: tailwind-merge keys a class by
// its variants, so a bare `hover:bg-card` sits in a different group from
// `not-disabled:hover:bg-fill-hover`, both survive, and the Button's two-variant
// selector then wins on specificity — which is how a field trigger ended up
// swapping its whole fill on hover while every other field only washed.
export const fieldTriggerSurfaceStyle =
  'bg-card not-disabled:hover:bg-card not-disabled:active:bg-card border-0 shadow-raised text-foreground ' +
  surfaceTintHover +
  ' ' +
  surfaceRimFocus;

// `filled` was an alias for `default` (both render the filled surface) and has been
// removed from the variant set. An unknown value makes cva emit nothing for the
// variant group, so a field would lose its surface entirely rather than fall back;
// resolve it here instead. Drop this once no published consumer passes `filled`.
export type DeprecatedFilledVariant = 'filled';

export function resolveFieldVariant<TVariant extends string>(
  variant: TVariant | DeprecatedFilledVariant | null | undefined,
): TVariant | 'default' | null | undefined {
  return variant === 'filled' ? 'default' : (variant as TVariant | null | undefined);
}

// Unstyled variant baseline — strips all chrome but still suppresses the
// browser default focus ring so the field sits cleanly inside a styled parent.
export const unstyledFormElementStyle = 'border-0 bg-transparent outline-hidden focus-visible:outline-hidden';

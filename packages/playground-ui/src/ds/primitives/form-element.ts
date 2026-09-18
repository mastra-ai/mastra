// Disabled controls resolve to dedicated muted roles rather than a blanket opacity:
// an opacity wash inherits whatever sits behind the control, so the same disabled
// field clears contrast on one surface and fails on another. The `not-disabled:`
// guards on each variant keep hover and active fills from painting over these.
export const sharedFormElementDisabledStyle = 'disabled:cursor-not-allowed disabled:text-muted-foreground';

// Surface half of the disabled language, for neutral controls that carry a fill.
// Variants with their own hue (primary, destructive) keep that hue at reduced
// emphasis instead, so a disabled destructive action still reads as destructive.
// Transparent variants (ghost) opt out entirely: a disabled icon button in a
// toolbar should stay invisible rather than resolve into a muted pill.
export const disabledFilledSurfaceStyle = 'disabled:border-border disabled:bg-muted';
export const disabledOutlineSurfaceStyle = 'disabled:border-border disabled:bg-transparent';

// Focus indicator for the (green-less) input family. Instead of a heavy ring we
// reinforce the existing 1px border: on focus it brightens to a translucent
// `foreground` (theme-aware — light on dark surfaces, dark on light) that clears
// WCAG 1.4.11 non-text contrast (3:1) on any surface, where the resting `border`
// token alone does not. `focus-visible` for the bare control, `focus-within` for
// wrapper variants (InputGroup) whose focus lives on a nested input.
export const inputFocusBorderVisible = 'focus-visible:border-foreground/60';
export const inputFocusBorderWithin = 'focus-within:border-foreground/60';

// Canonical focus indicator for a bare interactive control (Button, etc.) in the
// non-accent input/border language: suppress the browser outline and let the 1px
// border brighten to the same translucent neutral the input family uses. This is
// what unifies button focus with input focus (no green accent ring). Wrappers
// whose focus lives on a nested control use `inputFocusBorderWithin` instead.
export const controlFocusBorderVisible = `outline-hidden focus-visible:outline-hidden ${inputFocusBorderVisible}`;

// Hover borders are guarded so they can never clobber the focus border. Tailwind
// can emit focus variants before hover variants, so an unguarded `hover:border-*`
// of equal specificity may win on a field that is focused AND hovered.
export const inputHoverBorderVisible = '[&:hover:not(:focus-visible):not(:disabled)]:border-foreground/45';
// The wrapper itself is never `:disabled` — the control it wraps is — so the guard
// has to ask about descendants. Without it, hovering a group that contains a
// disabled input repaints the enabled border over the muted disabled one.
export const inputHoverBorderWithin = '[&:hover:not(:focus-within):not(:has(:disabled))]:border-foreground/45';

// Background-agnostic surface + focus recipe shared by Input, Textarea and the
// filled field triggers (Select/Combobox `default`). Reads on any underlying
// surface, with no accent on focus — caller appends a radius (`rounded-full` for
// single-line inputs, `rounded-xl` for textareas).
// Filled fields carry their affordance in the fill, exactly like a default Button:
// the resting `border` stays put on hover and only the surface steps up.
export const inputSurfaceAndFocusStyle =
  'bg-foreground/10 border border-border text-foreground ' +
  'not-disabled:hover:bg-foreground/14 ' +
  'outline-hidden focus-visible:outline-hidden focus-visible:bg-foreground/14 ' +
  inputFocusBorderVisible;

// Outline fields share Button's outline ladder exactly: a visible resting border
// (`foreground/30`), brightening on hover, then the shared focus border.
export const inputOutlineAndFocusStyle =
  'bg-transparent border border-foreground/30 text-foreground ' +
  inputHoverBorderVisible +
  ' ' +
  'outline-hidden focus-visible:outline-hidden ' +
  inputFocusBorderVisible;

// Filled field trigger (Select/Combobox `default`): the same surface as Input.
// Applied *after* `buttonVariants` so tailwind-merge replaces the Button's fill
// and border with the field overlay — a field is not a button. Like every filled
// control it carries hover in the fill and leaves the resting border alone.
export const fieldTriggerSurfaceStyle =
  'bg-foreground/10 border-border text-foreground ' +
  'not-disabled:hover:bg-foreground/14 not-disabled:active:bg-foreground/14 ' +
  'focus-visible:bg-foreground/14 ' +
  inputFocusBorderVisible;

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

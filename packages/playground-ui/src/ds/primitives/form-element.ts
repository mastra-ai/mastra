export const sharedFormElementDisabledStyle =
  'disabled:opacity-50 disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:cursor-not-allowed';

// Focus indicator for the (green-less) input family. Instead of a heavy ring we
// reinforce the existing 1px border: on focus it brightens to a translucent neutral
// (theme-aware neutral5 — light on dark surfaces, dark on light) that clears WCAG
// 1.4.11 non-text contrast (3:1) on any surface, where the border1→border2 shift
// alone (white/7%→11%) does not. `focus-visible` for the bare control,
// `focus-within` for wrapper variants (InputGroup) whose focus lives on
// a nested input.
export const inputFocusBorderVisible = 'focus-visible:border-neutral5/50';
export const inputFocusBorderWithin = 'focus-within:border-neutral5/50';

// Canonical focus indicator for a bare interactive control (Button, etc.) in the
// non-accent input/border language: suppress the browser outline and let the 1px
// border brighten to the same translucent neutral the input family uses. This is
// what unifies button focus with input focus (no green accent ring). Wrappers
// whose focus lives on a nested control use `inputFocusBorderWithin` instead.
export const controlFocusBorderVisible = `outline-hidden focus-visible:outline-hidden ${inputFocusBorderVisible}`;

// Hover borders are guarded so they can never clobber the focus border. Tailwind
// can emit focus variants before hover variants, so an unguarded `hover:border-*`
// of equal specificity may win on a field that is focused AND hovered.
export const inputHoverBorderVisible = '[&:hover:not(:focus-visible)]:border-border2';
export const inputHoverBorderWithin = '[&:hover:not(:focus-within)]:border-border2';

// Background-agnostic surface + focus recipe shared by Input and Textarea.
// Uses theme-aware opacity overlays so it reads on any underlying surface, with
// no accent (green) on focus — caller appends a radius (`rounded-full` for
// single-line inputs, `rounded-xl` for textareas).
export const inputSurfaceAndFocusStyle =
  'bg-surface-overlay-soft border border-border1 text-neutral5 ' +
  'hover:text-neutral6 hover:bg-surface-overlay-strong ' +
  inputHoverBorderVisible +
  ' ' +
  'outline-hidden focus-visible:outline-hidden focus-visible:bg-surface-overlay-strong ' +
  inputFocusBorderVisible;

export const inputOutlineAndFocusStyle =
  'bg-transparent border border-border1 text-neutral5 ' +
  'hover:text-neutral6 ' +
  inputHoverBorderVisible +
  ' ' +
  'outline-hidden focus-visible:outline-hidden ' +
  inputFocusBorderVisible;

// Unstyled variant baseline — strips all chrome but still suppresses the
// browser default focus ring so the field sits cleanly inside a styled parent.
export const unstyledFormElementStyle = 'border-0 bg-transparent outline-hidden focus-visible:outline-hidden';

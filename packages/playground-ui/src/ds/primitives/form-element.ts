export const formElementSizes = {
  sm: 'h-form-sm',
  md: 'h-form-md',
  default: 'h-form-default',
  lg: 'h-form-lg',
} as const;

// Enhanced focus states with glow effect and smooth transition
export const formElementFocus =
  'focus:outline-hidden focus:ring-1 focus:ring-accent1 focus:shadow-focus-ring transition-shadow duration-normal';
export const formElementFocusWithin =
  'focus-within:outline-hidden focus-within:ring-1 focus-within:ring-accent1 focus-within:shadow-focus-ring transition-shadow duration-normal';
export const formElementRadius = 'rounded-md';

export const sharedFormElementStyle =
  'bg-surface2 border border-border1 text-neutral5 hover:text-neutral6 hover:border-border2 rounded-lg';
export const sharedFormElementFocusStyle =
  'outline-hidden focus-visible:outline-hidden focus-visible:border-accent1 focus-visible:ring-1 focus-visible:ring-accent1/40';
export const sharedFormElementDisabledStyle = 'disabled:opacity-50 disabled:cursor-not-allowed';

// Background-agnostic surface + focus recipe shared by Input and Textarea.
// Uses theme-aware opacity overlays so it reads on any underlying surface, with
// no accent (green) on focus — caller appends a radius (`rounded-full` for
// single-line inputs, `rounded-xl` for textareas).
export const inputSurfaceAndFocusStyle =
  'bg-surface-overlay-soft border border-border1 text-neutral5 ' +
  'hover:text-neutral6 hover:bg-surface-overlay-strong hover:border-border2 ' +
  'outline-hidden focus-visible:outline-hidden focus-visible:bg-surface-overlay-strong focus-visible:border-border2';

// Unstyled variant baseline — strips all chrome but still suppresses the
// browser default focus ring so the field sits cleanly inside a styled parent.
export const unstyledFormElementStyle = 'border-0 bg-transparent outline-hidden focus-visible:outline-hidden';

// Common transition utilities for form elements
export const formElementTransition = 'transition-all duration-normal ease-out-custom';

export type FormElementSize = keyof typeof formElementSizes;

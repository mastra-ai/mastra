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
  'bg-surface2 border-2 border-border1 text-neutral5 hover:text-neutral6 hover:border-border2 rounded-lg';
export const sharedFormElementFocusStyle =
  'outline-hidden focus-visible:outline-hidden focus-visible:border-accent1 focus-visible:ring-1 focus-visible:ring-accent1/40';
export const sharedFormElementDisabledStyle = 'disabled:opacity-50 disabled:cursor-not-allowed';

// Common transition utilities for form elements
export const formElementTransition = 'transition-all duration-normal ease-out-custom';

export type FormElementSize = keyof typeof formElementSizes;

export const formElementSizes = {
  sm: 'h-form-sm',
  md: 'h-form-md',
  lg: 'h-form-lg',
} as const;

// Enhanced focus states with glow effect and smooth transition
export const formElementFocus =
  'focus:outline-none focus:ring-1 focus:ring-accent1 focus:shadow-focus-ring transition-shadow duration-normal';
export const formElementFocusWithin =
  'focus-within:outline-none focus-within:ring-1 focus-within:ring-accent1 focus-within:shadow-focus-ring transition-shadow duration-normal';
export const formElementRadius = 'rounded-md';

// Common transition utilities for form elements
export const formElementTransition = 'transition-all duration-normal ease-out-custom';

export type FormElementSize = keyof typeof formElementSizes;

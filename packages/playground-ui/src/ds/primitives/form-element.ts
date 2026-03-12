import { cn } from '@/lib/utils';

export const formElementSizes = {
  sm: 'h-form-sm',
  md: 'h-form-md',
  default: 'h-form-default',
  lg: 'h-form-lg',
} as const;

// Enhanced focus states with glow effect and smooth transition
export const formElementFocus =
  'focus:outline-none focus:ring-1 focus:ring-accent1 focus:shadow-focus-ring transition-shadow duration-normal';
export const formElementFocusWithin =
  'focus-within:outline-none focus-within:ring-1 focus-within:ring-accent1 focus-within:shadow-focus-ring transition-shadow duration-normal';
export const formElementRadius = 'rounded-md';

export const sharedFormElementStyle =
  'bg-white/5 border-2 border-white/10 text-neutral4 hover:text-neutral5 hover:border-white/20 rounded-lg';
export const sharedFormElementFocusStyle = 'outline-none focus-visible:outline-none focus-visible:border-accent1';
export const sharedFormElementDisabledStyle = 'disabled:opacity-50 disabled:cursor-not-allowed';

// Common transition utilities for form elements
export const formElementTransition = 'transition-all duration-normal ease-out-custom';

export type FormElementSize = keyof typeof formElementSizes;

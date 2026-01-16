export const formElementSizes = {
  sm: 'h-form-sm',
  md: 'h-form-md',
  lg: 'h-form-lg',
} as const;

export const formElementFocus = 'focus:outline focus:outline-1 focus:outline-accent1';
export const formElementFocusWithin =
  'focus-within:outline focus-within:outline-1 focus-within:outline-accent1 focus-within:-outline-offset-2';
export const formElementRadius = 'rounded-md';

export type FormElementSize = keyof typeof formElementSizes;

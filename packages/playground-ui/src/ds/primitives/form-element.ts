export const formElementSizes = {
  sm: 'h-form-sm',
  md: 'h-form-md',
  lg: 'h-form-lg',
} as const;

export const formElementFocus = 'focus:outline focus:outline-1 focus:outline-accent1';
export const formElementFocusWithin =
  'focus-within:outline focus-within:outline-1 focus-within:outline-accent1 focus-within:-outline-offset-2';
export const formElementRadius = 'rounded-md';

// Shared border style
export const formElementBorder = 'border border-border1';

// Disabled state
export const formElementDisabled = 'disabled:cursor-not-allowed disabled:opacity-50';

// Placeholder text color
export const formElementPlaceholder = 'placeholder:text-neutral3';

// Shadow for form inputs
export const formElementShadow = 'shadow-sm';

// Transparent background
export const formElementBgTransparent = 'bg-transparent';

export type FormElementSize = keyof typeof formElementSizes;

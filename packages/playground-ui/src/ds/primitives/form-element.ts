import { cn } from '@/lib/utils';
import './focus.css';

export const sharedFormElementDisabledStyle = 'disabled:opacity-50 disabled:cursor-not-allowed';

export const inputFocusBorderVisible = 'focus-visible:border-neutral5/50';
export const inputFocusBorderWithin = 'has-[:focus-visible]:not-has-[[aria-invalid=true]]:border-neutral5/50';

export const controlFocusStyle = 'ds-focus ds-focus-line';
export { controlFocusStyle as controlFocusBorderVisible };

// Hover must preserve focused and invalid borders when those states overlap.
export const inputHoverBorderVisible = 'hover:not-focus-visible:not-aria-invalid:border-border2';
export const inputHoverBorderWithin = 'hover:not-has-[:focus-visible]:not-has-[[aria-invalid=true]]:border-border2';

export const inputSurfaceAndFocusStyle = cn(
  'ds-focus border border-border1 bg-surface-overlay-soft text-neutral5',
  'hover:bg-surface-overlay-strong hover:text-neutral6 focus-visible:bg-surface-overlay-strong',
  inputHoverBorderVisible,
  inputFocusBorderVisible,
);

export const inputOutlineAndFocusStyle = cn(
  'ds-focus border border-border1 bg-transparent text-neutral5 hover:text-neutral6',
  inputHoverBorderVisible,
  inputFocusBorderVisible,
);

export const unstyledFormElementStyle = 'ds-focus border-0 bg-transparent';

import './focus.css';

export const sharedFormElementDisabledStyle = 'disabled:opacity-50 disabled:cursor-not-allowed';

export const inputFocusBorderVisible = 'focus-visible:border-neutral5/50';
export const inputFocusBorderWithin = 'focus-within:border-neutral5/50';

export const controlFocusStyle = 'ds-focus ds-focus-line';
export { controlFocusStyle as controlFocusBorderVisible };

export const inputHoverBorderVisible = 'hover:border-border2';
export const inputHoverBorderWithin = inputHoverBorderVisible;

export const inputSurfaceAndFocusStyle =
  'bg-surface-overlay-soft border border-border1 text-neutral5 ' +
  'hover:text-neutral6 hover:bg-surface-overlay-strong ' +
  inputHoverBorderVisible +
  ' ' +
  controlFocusStyle;

export const inputOutlineAndFocusStyle =
  'bg-transparent border border-border1 text-neutral5 ' +
  'hover:text-neutral6 ' +
  inputHoverBorderVisible +
  ' ' +
  controlFocusStyle;

export const unstyledFormElementStyle = 'ds-focus ds-focus-line border-0 bg-transparent';

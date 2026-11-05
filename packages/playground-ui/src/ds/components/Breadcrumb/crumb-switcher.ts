import type { ComboboxProps } from '../Combobox';

export const crumbSwitcherTriggerProps = {
  variant: 'ghost',
  size: 'icon-sm',
  // The trigger is just a chevron, so give the popup room for entity names.
  popupWidth: 'md',
} as const satisfies Pick<ComboboxProps, 'variant' | 'size' | 'popupWidth'>;

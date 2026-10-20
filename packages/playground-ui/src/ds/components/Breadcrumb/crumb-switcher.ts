import type { ComboboxProps } from '../Combobox';

export const crumbSwitcherTriggerProps = {
  variant: 'ghost',
  size: 'icon-sm',
} as const satisfies Pick<ComboboxProps, 'variant' | 'size'>;

import type { ComboboxProps } from '../Combobox';

export const crumbSwitcherTriggerProps = {
  variant: 'ghost',
  size: 'icon-sm',
  align: 'end',
} as const satisfies Pick<ComboboxProps, 'variant' | 'size' | 'align'>;

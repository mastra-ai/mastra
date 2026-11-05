import type { ComboboxProps } from '../Combobox';

export const crumbSwitcherTriggerProps = {
  variant: 'ghost',
  size: 'icon-sm',
  chevron: 'up-down',
} as const satisfies Pick<ComboboxProps, 'variant' | 'size' | 'chevron'>;

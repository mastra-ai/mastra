import { Combobox } from './combobox';
import type { ComboboxMultipleProps, ComboboxOption } from './combobox';

export type { ComboboxOption };

export type MultiComboboxProps = Omit<ComboboxMultipleProps, 'multiple'>;

export function MultiCombobox(props: MultiComboboxProps) {
  return <Combobox {...props} multiple />;
}

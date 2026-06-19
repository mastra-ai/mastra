import { Combobox } from './combobox';
import type { ComboboxMultipleProps, ComboboxOption } from './combobox';

export type { ComboboxOption };

export type MultiComboboxProps = Omit<ComboboxMultipleProps, 'multiple'>;

/** @deprecated Use `Combobox` with `multiple` instead. */
export function MultiCombobox(props: MultiComboboxProps) {
  return <Combobox {...props} multiple />;
}

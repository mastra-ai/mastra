import { fireEvent, screen } from '@testing-library/react';

/** Returns the mocked multi-select rendered for the given placeholder. */
export const getMultiSelect = (placeholder: string) =>
  screen.getByRole('listbox', { name: placeholder }) as HTMLSelectElement;

/** Currently selected values of a mocked multi-select. */
export const getMultiSelectValues = (placeholder: string) =>
  Array.from(getMultiSelect(placeholder).selectedOptions, option => option.value);

/** Replaces the selection of a mocked multi-select and fires `change`. */
export const setMultiSelectValues = (placeholder: string, values: string[]) => {
  const select = getMultiSelect(placeholder);
  for (const option of Array.from(select.options)) {
    option.selected = values.includes(option.value);
  }
  fireEvent.change(select);
};

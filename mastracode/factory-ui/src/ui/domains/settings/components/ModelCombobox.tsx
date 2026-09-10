import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { useMemo } from 'react';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';

/** Sentinel combobox value for "follow the Factory default". Never persisted. */
export const FACTORY_DEFAULT_MODEL_VALUE = '__factory_default__';

/**
 * Searchable model picker shared by the settings model surfaces (Factory
 * default model, pack editors). The catalog is large (every provider's
 * models), so a filterable combobox replaces the native `<select>`.
 *
 * A persisted value that is no longer in the catalog (key removed, model
 * retired) is kept selectable so the control always displays the stored state.
 */
export function ModelCombobox({
  models,
  value,
  onValueChange,
  placeholder,
  disabled,
  className,
  clearOptionLabel,
}: {
  models: AvailableModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** When set, prepend an option that yields `FACTORY_DEFAULT_MODEL_VALUE`. */
  clearOptionLabel?: string;
}) {
  const options = useMemo(() => {
    const catalog: ComboboxOption[] = models.map(m => ({ label: m.id, value: m.id, description: m.provider }));
    const known = new Set(catalog.map(o => o.value));
    const orphan: ComboboxOption[] =
      value && value !== FACTORY_DEFAULT_MODEL_VALUE && !known.has(value) ? [{ label: value, value }] : [];
    const clear: ComboboxOption[] = clearOptionLabel
      ? [{ label: clearOptionLabel, value: FACTORY_DEFAULT_MODEL_VALUE }]
      : [];
    return [...clear, ...orphan, ...catalog];
  }, [models, value, clearOptionLabel]);

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder ?? 'Select model…'}
      searchPlaceholder="Search models…"
      emptyText="No matching model."
      allowCustomValue
      disabled={disabled}
      className={className}
    />
  );
}

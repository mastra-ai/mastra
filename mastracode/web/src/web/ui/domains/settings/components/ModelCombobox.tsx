import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { useMemo } from 'react';

import type { AvailableModelOption } from '../../../../../shared/hooks/useAvailableModels';

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
}: {
  models: AvailableModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const options = useMemo(() => {
    const catalog: ComboboxOption[] = models.map(m => ({ label: m.id, value: m.id, description: m.provider }));
    const known = new Set(catalog.map(o => o.value));
    const orphan: ComboboxOption[] = value && !known.has(value) ? [{ label: value, value }] : [];
    return [...orphan, ...catalog];
  }, [models, value]);

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder ?? 'Select model…'}
      searchPlaceholder="Search models…"
      emptyText="No matching model."
      disabled={disabled}
      className={className}
    />
  );
}

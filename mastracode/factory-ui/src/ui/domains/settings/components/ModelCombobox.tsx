import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption, ComboboxSingleProps } from '@mastra/playground-ui/components/Combobox';
import { compareModelReleaseDates, formatModelName } from '@mastra/playground-ui/utils/model';
import { Box, Sparkles } from 'lucide-react';
import { useMemo } from 'react';

import type { AvailableModelOption } from '../../../../hooks/useAvailableModels';
import { DEFAULT_SOURCE_LABELS } from '../../chat/services/thinkingLevels';
import { ProviderBrandIcon } from '../../workspaces/components/ProviderBrandIcon';
import { providerDisplayName } from '@mastra/factory/provider-display-name';

/** Value the picker reports when the caller's `auto` choice is picked. */
const AUTO_VALUE = 'auto';

function modelProvider(id: string): string {
  const slash = id.indexOf('/');
  return slash > 0 ? id.slice(0, slash) : '';
}

function modelOption(id: string, provider: string): ComboboxOption {
  const name = formatModelName(id);
  return {
    value: id,
    label: name,
    // The full id tells apart models that share a name across providers (e.g. OpenAI and OpenAI Codex).
    description: id,
    start: <ProviderBrandIcon provider={provider} fallback={<Box className="text-muted-foreground size-4" />} />,
    keywords: provider ? [id, providerDisplayName(provider)] : [id],
  };
}

function autoOption(effectiveModelId: string | null | undefined): ComboboxOption {
  const effectiveName = effectiveModelId ? formatModelName(effectiveModelId) : undefined;
  return {
    value: AUTO_VALUE,
    label: 'Auto',
    description: effectiveName ? `Currently ${effectiveName}` : 'Picked for you',
    displayLabel: effectiveName ? `Auto · ${effectiveName}` : 'Auto',
    start: (
      <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
        <Sparkles className="text-muted-foreground size-4" />
      </span>
    ),
    keywords: ['automatic', 'default', ...(effectiveModelId ? [effectiveModelId] : [])],
  };
}

/**
 * Searchable model picker shared by the settings model surfaces. The catalog
 * is large (every provider's models), so a filterable combobox replaces the
 * native `<select>`. Options read as model names with their provider's logo;
 * search also matches the raw `provider/model` id and the provider name.
 *
 * A persisted value that is no longer in the catalog (key removed, model
 * retired) is kept selectable so the control always displays the stored state.
 *
 * Pass `auto` to offer an "Auto" choice first: picking it reports `'auto'`,
 * and the trigger shows the model Auto currently resolves to.
 */
export function ModelCombobox({
  models,
  value,
  onValueChange,
  auto,
  fallbackModelId,
  placeholder,
  disabled,
  className,
  variant,
  size,
  'aria-label': ariaLabel,
}: {
  models: AvailableModelOption[];
  value: string;
  onValueChange: (value: string) => void;
  auto?: { effectiveModelId?: string | null };
  fallbackModelId?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  variant?: ComboboxSingleProps['variant'];
  size?: ComboboxSingleProps['size'];
  'aria-label'?: string;
}) {
  const autoEffectiveModelId = auto ? (auto.effectiveModelId ?? null) : undefined;
  const options = useMemo(() => {
    const catalog = models
      .toSorted(
        (a, b) =>
          a.provider.localeCompare(b.provider) ||
          compareModelReleaseDates(a.releaseDate, b.releaseDate) ||
          a.id.localeCompare(b.id),
      )
      .map(m => modelOption(m.id, m.provider));
    const known = new Set(catalog.map(o => o.value));
    const autoChoice = autoEffectiveModelId === undefined ? [] : [autoOption(autoEffectiveModelId)];
    const isAutoValue = autoChoice.length > 0 && value === AUTO_VALUE;
    const orphan = value && !isAutoValue && !known.has(value) ? [modelOption(value, modelProvider(value))] : [];
    return [...autoChoice, ...orphan, ...catalog];
  }, [models, value, autoEffectiveModelId]);

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onValueChange}
      placeholder={
        fallbackModelId
          ? `${formatModelName(fallbackModelId)} · ${DEFAULT_SOURCE_LABELS['built-in']}`
          : (placeholder ?? 'Select model…')
      }
      searchPlaceholder="Search models…"
      emptyText="No matching model."
      allowCustomValue
      disabled={disabled}
      className={className}
      variant={variant}
      size={size}
      aria-label={ariaLabel}
    />
  );
}

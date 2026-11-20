import { ModelPicker } from '@mastra/playground-ui/domains/llm';
import { IconBox } from '@mastra/playground-ui/icons/central/IconBox';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import { useMemo } from 'react';

import type { AvailableModelOption } from '../../../../../../hooks/useAvailableModels';
import { fromPickerValue, toPickerProviders, toPickerValue } from '../../../../chat/services/modelPickerCatalog';
import { DEFAULT_SOURCE_LABELS } from '../../../../chat/services/thinkingLevels';
import { ProviderBrandIcon } from '../../../../workspaces/components/ProviderBrandIcon';

const renderProviderIcon = (provider: string) => (
  <ProviderBrandIcon provider={provider} fallback={<IconBox className="text-muted-foreground size-icon-sm" />} />
);

export type DefaultModelPickerProps = {
  models: AvailableModelOption[] | undefined;
  /** The saved model id. Kept selectable even when the catalog no longer offers it. */
  value: string | null | undefined;
  onValueChange: (modelId: string) => void;
  /** The built-in model used while nothing is saved. */
  fallbackModelId?: string | null;
  disabled?: boolean;
  'aria-label': string;
};

/** The chat model picker, wired to a settings default: catalog ids in, catalog ids out. */
export function DefaultModelPicker({
  models,
  value,
  onValueChange,
  fallbackModelId,
  disabled,
  'aria-label': ariaLabel,
}: DefaultModelPickerProps) {
  const catalog = models ?? [];
  const providers = useMemo(() => toPickerProviders(models ?? [], value ?? undefined), [models, value]);
  const selected = toPickerValue(catalog, value);
  const fallback = toPickerValue(catalog, fallbackModelId);

  return (
    <ModelPicker
      providers={providers}
      value={selected}
      defaultModel={fallback}
      onValueChange={next => onValueChange(fromPickerValue(catalog, next))}
      renderProviderIcon={renderProviderIcon}
      busy={disabled}
      side="bottom"
      align="start"
      triggerClassName="flex-1 justify-start [&>svg:last-child]:ml-auto"
      aria-label={ariaLabel}
    >
      {selected ? undefined : (
        <>
          {fallback ? <span className="flex shrink-0">{renderProviderIcon(fallback.provider)}</span> : null}
          <span className="text-muted-foreground truncate">
            {fallbackModelId
              ? `${formatModelName(fallbackModelId)} (${DEFAULT_SOURCE_LABELS['built-in']})`
              : 'Select a model'}
          </span>
        </>
      )}
    </ModelPicker>
  );
}

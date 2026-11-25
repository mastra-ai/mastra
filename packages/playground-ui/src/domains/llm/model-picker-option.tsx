import type { ReactNode } from 'react';
import type { ModelPickerModel, ModelPickerProvider } from './model-picker-types';
import { Badge } from '@/ds/components/Badge';
import { CommandItem } from '@/ds/components/Command';
import { Txt } from '@/ds/components/Txt';
import { IconCheckmark2Medium } from '@/ds/icons/central/IconCheckmark2Medium';

interface ModelPickerOptionProps {
  provider: ModelPickerProvider;
  model: ModelPickerModel;
  name: string;
  showModelId: boolean;
  selected: boolean;
  isDefault: boolean;
  onSelect: () => void;
  renderProviderIcon: (providerId: string) => ReactNode;
}

export function ModelPickerOption({
  provider,
  model,
  name,
  showModelId,
  selected,
  isDefault,
  onSelect,
  renderProviderIcon,
}: ModelPickerOptionProps) {
  const id = `${provider.id}/${model.id}`;
  return (
    <CommandItem value={id} keywords={[provider.name, name]} title={id} onSelect={onSelect}>
      <span aria-hidden className="flex shrink-0">
        {renderProviderIcon(provider.id)}
      </span>
      <span className="grid min-w-0">
        <span className="truncate">{name}</span>
        {showModelId ? (
          <Txt as="span" variant="caption" tone="muted" className="truncate">
            {id}
          </Txt>
        ) : null}
      </span>
      {isDefault ? (
        <Badge variant="blue" size="xs">
          Default
        </Badge>
      ) : null}
      {selected ? <IconCheckmark2Medium aria-hidden className="ml-auto shrink-0" /> : null}
    </CommandItem>
  );
}

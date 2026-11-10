import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { modelDisplayName } from './model-display-name';
import type { ModelPickerModel, ModelPickerProvider } from './model-picker-types';
import { Badge } from '@/ds/components/Badge';
import { CommandItem } from '@/ds/components/Command';

interface ModelPickerOptionProps {
  provider: ModelPickerProvider;
  model: ModelPickerModel;
  selected: boolean;
  isDefault: boolean;
  onSelect: () => void;
  renderProviderIcon: (providerId: string) => ReactNode;
}

export function ModelPickerOption({
  provider,
  model,
  selected,
  isDefault,
  onSelect,
  renderProviderIcon,
}: ModelPickerOptionProps) {
  const name = modelDisplayName(model);
  return (
    <CommandItem
      value={`${provider.id}/${model.id}`}
      keywords={[provider.name, name, ...(model.keywords ?? [])]}
      title={model.id}
      onSelect={onSelect}
    >
      <span aria-hidden className="flex shrink-0">
        {renderProviderIcon(provider.id)}
      </span>
      <span className="truncate">{name}</span>
      {isDefault ? (
        <Badge variant="blue" size="xs">
          Default
        </Badge>
      ) : null}
      {selected ? <Check aria-hidden className="ml-auto shrink-0" /> : null}
    </CommandItem>
  );
}

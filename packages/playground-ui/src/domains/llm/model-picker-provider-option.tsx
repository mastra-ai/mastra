import type { ReactNode } from 'react';
import type { ModelPickerProvider } from './model-picker-types';
import { CommandItem } from '@/ds/components/Command';
import { Txt } from '@/ds/components/Txt';

interface ModelPickerProviderOptionProps {
  provider: ModelPickerProvider;
  onSelect: () => void;
  renderProviderIcon: (providerId: string) => ReactNode;
}

/** A provider that isn't connected; picking it lists its models. */
export function ModelPickerProviderOption({ provider, onSelect, renderProviderIcon }: ModelPickerProviderOptionProps) {
  const count = provider.models.length;
  return (
    <CommandItem value={`provider:${provider.id}`} onSelect={onSelect}>
      <span aria-hidden className="flex shrink-0">
        {renderProviderIcon(provider.id)}
      </span>
      <span className="truncate">{provider.name}</span>
      <Txt as="span" variant="caption" tone="muted" className="ml-auto shrink-0">
        {count} {count === 1 ? 'model' : 'models'}
      </Txt>
    </CommandItem>
  );
}

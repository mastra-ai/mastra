import { Check } from 'lucide-react';
import { ModelPickerItem } from './model-picker';
import { CommandGroup } from '@/ds/components/Command';

export interface ModelPickerOption {
  id: string;
  provider: string;
  modelName: string;
  keywords?: string[];
}

export function ModelPickerModels({
  options,
  value,
  onValueChange,
}: {
  options: ModelPickerOption[];
  value?: string;
  onValueChange: (id: string) => void;
}) {
  const providerGroups = new Map<string, ModelPickerOption[]>();
  for (const model of options) {
    const group = providerGroups.get(model.provider);
    if (group) group.push(model);
    else providerGroups.set(model.provider, [model]);
  }
  return [...providerGroups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([provider, models]) => (
      <CommandGroup
        key={provider}
        heading={provider}
        className="**:[[cmdk-group-heading]]:text-neutral2 **:[[cmdk-group-heading]]:font-normal **:[[cmdk-group-heading]]:tracking-normal **:[[cmdk-group-heading]]:normal-case"
      >
        {models.map(model => (
          <ModelPickerItem
            key={model.id}
            value={model.id}
            keywords={model.keywords ?? [model.provider, model.modelName]}
            title={model.id}
            onSelect={() => onValueChange(model.id)}
          >
            <span className="truncate">{model.modelName}</span>
            {model.id === value && <Check aria-hidden className="ml-auto shrink-0" />}
          </ModelPickerItem>
        ))}
      </CommandGroup>
    ));
}

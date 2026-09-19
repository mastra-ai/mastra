import { Check } from 'lucide-react';
import { ModelPickerItem } from './model-picker';
import { Badge } from '@/ds/components/Badge';
import { CommandGroup } from '@/ds/components/Command';

export interface ModelPickerPack {
  id: string;
  name: string;
  summary: string;
  detail: string;
  keywords: string[];
}

export function ModelPickerPacks({
  options,
  value,
  defaultId,
  onValueChange,
}: {
  options: ModelPickerPack[];
  value?: string;
  defaultId?: string;
  onValueChange: (id: string) => void;
}) {
  return (
    <CommandGroup heading="Model packs">
      {options.map(pack => (
        <ModelPickerItem
          key={pack.id}
          value={`pack:${pack.id}`}
          keywords={pack.keywords}
          aria-label={`Model pack ${pack.name}`}
          title={pack.detail}
          onSelect={() => onValueChange(pack.id)}
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="truncate">{pack.name}</span>
              {pack.id === defaultId && (
                <Badge variant="blue" size="xs">
                  Default
                </Badge>
              )}
            </span>
            <span className="text-ui-xs text-neutral3 truncate">{pack.summary}</span>
          </div>
          {pack.id === value && <Check aria-hidden className="ml-auto shrink-0" />}
        </ModelPickerItem>
      ))}
    </CommandGroup>
  );
}

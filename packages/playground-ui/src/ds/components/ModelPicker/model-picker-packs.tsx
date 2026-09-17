import { Check, RotateCcw, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { ModelPickerItem } from './model-picker';
import { Badge } from '@/ds/components/Badge';
import { CommandGroup, CommandSeparator } from '@/ds/components/Command';

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

export function ModelPickerPackActions({ children }: { children: ReactNode }) {
  return (
    <>
      <CommandSeparator />
      <CommandGroup>{children}</CommandGroup>
    </>
  );
}

export function ModelPickerResetPack({ onSelect }: { onSelect: () => void }) {
  return (
    <ModelPickerItem value="action:reset" keywords={['reset', 'default', 'pack']} onSelect={onSelect}>
      <RotateCcw aria-hidden />
      <span>Reset to default pack</span>
    </ModelPickerItem>
  );
}

export function ModelPickerManagePacks({ onSelect }: { onSelect: () => void }) {
  return (
    <ModelPickerItem value="action:manage" keywords={['manage', 'model', 'packs', 'settings']} onSelect={onSelect}>
      <Settings2 aria-hidden />
      <span>Manage model packs</span>
    </ModelPickerItem>
  );
}

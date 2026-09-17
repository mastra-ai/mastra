import { RotateCcw, Settings2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { CommandGroup, CommandSeparator } from '@mastra/playground-ui/components/Command';
import { ModelPickerItem } from '@mastra/playground-ui/components/ModelPicker';

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

import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { CommandPaletteItem } from '@mastra/playground-ui/components/CommandPalette';
import { Kbd } from '@mastra/playground-ui/components/Kbd';
import { Factory } from 'lucide-react';

export interface CreateFactoryNameRowsProps {
  name: string;
  onSubmit: (name: string) => void;
}

/** The palette field doubles as the Factory name field, so its row commits what was typed. */
export function CreateFactoryNameRows({ name, onSubmit }: CreateFactoryNameRowsProps) {
  const trimmedName = name.trim();

  return (
    <CommandGroup heading="Create">
      <CommandPaletteItem
        icon={<Factory />}
        title={trimmedName ? `Create “${trimmedName}”` : 'Type a name to create your Factory'}
        shortcut={<Kbd size="sm">↵</Kbd>}
        value="create-factory"
        disabled={!trimmedName}
        onSelect={() => onSubmit(trimmedName)}
      />
    </CommandGroup>
  );
}

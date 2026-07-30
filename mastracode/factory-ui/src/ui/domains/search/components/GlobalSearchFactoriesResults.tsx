import { CommandGroup } from '@mastra/playground-ui/components/Command';
import { Factory } from 'lucide-react';

import { factoryHomePath } from '../../workspaces/services/factoryPaths';
import type { FactoryProject } from '../../workspaces/services/github';
import { GlobalSearchCommandItem } from './GlobalSearchCommandItem';
import type { GlobalSearchSelectHandler } from './GlobalSearchCommandItem';

function factoryContext(repositorySlugs: string[]): string {
  if (repositorySlugs.length === 0) return 'No repositories linked';
  return repositorySlugs.join(', ');
}

function currentFactoryShortcut(factoryId: string, activeFactoryId: string | undefined): string | undefined {
  if (factoryId === activeFactoryId) return 'Current';
  return undefined;
}

export function GlobalSearchFactoriesResults({
  factories,
  activeFactoryId,
  onSelect,
}: {
  factories: FactoryProject[];
  activeFactoryId: string | undefined;
  onSelect: GlobalSearchSelectHandler;
}) {
  if (factories.length === 0) return null;

  return (
    <CommandGroup heading="Factories">
      {factories.map(factory => {
        const repositorySlugs = factory.repositories.map(repository => repository.slug);
        return (
          <GlobalSearchCommandItem
            key={factory.id}
            icon={<Factory />}
            title={factory.name}
            context={factoryContext(repositorySlugs)}
            value={`${factory.name} ${factory.id} ${repositorySlugs.join(' ')} Factory`}
            shortcut={currentFactoryShortcut(factory.id, activeFactoryId)}
            onSelect={() => onSelect(factoryHomePath(factory), false)}
          />
        );
      })}
    </CommandGroup>
  );
}

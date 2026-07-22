import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, ChevronsUpDown, Factory as FactoryIcon, Folder, Plus } from 'lucide-react';
import { deriveProjectPath } from '../../../../../shared/hooks/useWorkspaces';
import { useOverlays } from '../../../lib/overlays';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { isServerFactory } from '../services/factories';

/** Inline factory selection with a single Create Factory action. */
export function FactorySwitcher() {
  const { factories, activeFactory, selectFactory } = useActiveFactoryContext();
  const overlays = useOverlays();
  const { setOpenMobile } = useMainSidebar();

  const openFactories = () => {
    overlays.open('factories');
    setOpenMobile(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        id="factory-switcher-trigger"
        aria-label="Select factory"
        className="flex w-full items-center gap-2 rounded-md border border-border1 px-2.5 py-2 text-left hover:bg-surface3"
      >
        <Folder size={16} className="shrink-0 text-icon3" />
        <span className="flex min-w-0 flex-1 flex-col">
          <Txt as="span" variant="ui-sm" className="truncate text-icon6">
            {activeFactory?.name ?? 'Select a factory…'}
          </Txt>
          {activeFactory && (
            <Txt as="span" variant="ui-xs" className="truncate text-icon3">
              {deriveProjectPath(activeFactory)}
            </Txt>
          )}
        </span>
        <ChevronsUpDown size={13} className="shrink-0 text-icon3" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-64">
        {factories.map(factory => (
          <DropdownMenu.Item key={factory.id} onSelect={() => selectFactory(factory)}>
            {isServerFactory(factory) ? <FactoryIcon /> : <Folder />}
            <span className="min-w-0 flex-1 truncate">{factory.name}</span>
            {factory.id === activeFactory?.id && <Check aria-label="Active factory" />}
          </DropdownMenu.Item>
        ))}

        {factories.length > 0 && <DropdownMenu.Separator />}
        <DropdownMenu.Item onSelect={openFactories}>
          <Plus />
          <span>Create Factory</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

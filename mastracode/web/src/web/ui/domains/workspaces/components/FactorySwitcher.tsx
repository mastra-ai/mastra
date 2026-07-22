import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, ChevronsUpDown, Factory as FactoryIcon, Plus } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useFactoriesQuery, useFactoryQuery } from '../../../../../shared/hooks/useFactories';
import { factoryHomePath } from '../services/factoryPaths';

/** Inline factory selection with a single Create Factory action. */
export function FactorySwitcher() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoriesQuery = useFactoriesQuery();
  const activeFactoryQuery = useFactoryQuery(factoryId);
  const factories = factoriesQuery.data ?? [];
  const activeFactory = activeFactoryQuery.data;
  const navigate = useNavigate();
  const { setOpenMobile } = useMainSidebar();

  const openFactories = () => {
    void navigate('/factories/create');
    setOpenMobile(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        id="factory-switcher-trigger"
        type="button"
        aria-label="Select factory"
        className={cn(buttonVariants({ variant: 'ghost' }), 'w-full justify-start gap-2 px-2.5 text-left [&>svg]:mx-0')}
      >
        <FactoryIcon size={16} className="shrink-0 text-icon3" />
        <Txt as="span" variant="ui-sm" className="min-w-0 flex-1 truncate text-icon6">
          {activeFactory?.name ?? 'Select a factory…'}
        </Txt>
        <ChevronsUpDown size={13} className="shrink-0 text-icon3" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-64">
        {factories.map(factory => (
          <DropdownMenu.Item
            key={factory.id}
            onSelect={() => {
              void navigate(factoryHomePath(factory));
            }}
          >
            <FactoryIcon />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{factory.name}</span>
            </span>
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

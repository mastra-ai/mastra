import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';
import { Factory as FactoryIcon } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useFactoriesQuery, useFactoryQuery } from '../../../../hooks/useFactories';
import { createFactoryPath, factorySwitchPath } from '../services/factoryPaths';
import { IconCheckmark2Medium } from '@mastra/playground-ui/icons/central/IconCheckmark2Medium';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { IconChevronDownMedium } from '@mastra/playground-ui/icons/central/IconChevronDownMedium';

export const FACTORY_SWITCHER_TRIGGER = '-ml-[calc(var(--control-px)-2px)] min-w-0 gap-1';

export function FactorySwitcherTriggerContent({ children }: { children: ReactNode }) {
  return (
    <>
      <FactoryIcon className="shrink-0" />
      {children}
      <IconChevronDownMedium className="text-muted-foreground size-icon-sm shrink-0" />
    </>
  );
}

export function FactorySwitcher() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const location = useLocation();
  const factoriesQuery = useFactoriesQuery();
  const activeFactoryQuery = useFactoryQuery(factoryId);
  const factories = factoriesQuery.data ?? [];
  const activeFactory = activeFactoryQuery.data;
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();

  const createFactoryFrom = factoryId ?? factories[0]?.id;
  const openCreateFactory = () => {
    if (!createFactoryFrom) return;
    void navigate(createFactoryPath(createFactoryFrom));
    setOpenMobile(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        id="factory-switcher-trigger"
        type="button"
        aria-label="Select factory"
        variant="ghost"
        size="sm"
        className={FACTORY_SWITCHER_TRIGGER}
      >
        <FactorySwitcherTriggerContent>
          <Txt tone="ink" as="span" variant="caption" className="min-w-0 truncate">
            {activeFactory?.name ?? 'Select a factory…'}
          </Txt>
        </FactorySwitcherTriggerContent>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-64">
        {factories.map(factory => (
          <DropdownMenu.Item key={factory.id} render={<Link to={factorySwitchPath(factory, location)} />}>
            <FactoryIcon />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{factory.name}</span>
            </span>
            {factory.id === activeFactory?.id && <IconCheckmark2Medium aria-label="Active factory" />}
          </DropdownMenu.Item>
        ))}

        {factories.length > 0 && <DropdownMenu.Separator />}
        <DropdownMenu.Item disabled={!createFactoryFrom} onSelect={openCreateFactory}>
          <IconPlusMedium />
          <span>Create factory</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

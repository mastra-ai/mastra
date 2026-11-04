import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Check, ChevronDown, Factory as FactoryIcon, Plus } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useFactoriesQuery, useFactoryQuery } from '../../../../hooks/useFactories';
import { createFactoryPath, factorySwitchPath } from '../services/factoryPaths';

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
        className="-ml-[calc(var(--button-px)-2px)] min-w-0 gap-1"
      >
        <FactoryIcon />
        {factoryId && activeFactoryQuery.isPending ? (
          <Skeleton
            role="status"
            aria-label="Loading factory"
            className="h-3.5 w-24 motion-reduce:before:animate-none"
          />
        ) : (
          <Txt tone="ink" as="span" variant="caption" className="min-w-0 truncate">
            {activeFactory?.name ?? 'Select a factory…'}
          </Txt>
        )}
        <ChevronDown size={14} className="text-muted-foreground shrink-0" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-64">
        {factories.map(factory => (
          <DropdownMenu.Item key={factory.id} render={<Link to={factorySwitchPath(factory, location)} />}>
            <FactoryIcon />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{factory.name}</span>
            </span>
            {factory.id === activeFactory?.id && <Check aria-label="Active factory" />}
          </DropdownMenu.Item>
        ))}

        {factories.length > 0 && <DropdownMenu.Separator />}
        <DropdownMenu.Item disabled={!createFactoryFrom} onSelect={openCreateFactory}>
          <Plus />
          <span>Create factory</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

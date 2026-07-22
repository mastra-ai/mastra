import { useMainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { buttonVariants } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Check, ChevronsUpDown, Factory as FactoryIcon, Folder, Plus } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { deriveProjectPath } from '../../../../../shared/hooks/useWorkspaces';
import { useActiveFactoryContext } from '../context/ActiveFactoryProvider';
import { isServerFactory } from '../services/factories';
import { factoryHomePath, sourceFactoryPath } from '../services/factoryPaths';

/** Inline factory selection with a single Create Factory action. */
export function FactorySwitcher() {
  const { factories, activeFactory } = useActiveFactoryContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { setOpenMobile } = useMainSidebar();

  const openFactories = () => {
    const from = location.pathname === '/factories/create' ? sourceFactoryPath(location.state) : location.pathname;
    void navigate('/factories/create', { state: { from: from ?? '/' } });
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
        <Folder size={16} className="shrink-0 text-icon3" />
        <Txt as="span" variant="ui-sm" className="min-w-0 flex-1 truncate text-icon6">
          {activeFactory?.name ?? 'Select a factory…'}
        </Txt>
        <ChevronsUpDown size={13} className="shrink-0 text-icon3" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-64">
        {factories.map(factory => {
          const projectPath = deriveProjectPath(factory);

          return (
            <DropdownMenu.Item
              key={factory.id}
              onSelect={() => {
                void navigate(factoryHomePath(factory));
              }}
            >
              {isServerFactory(factory) ? <FactoryIcon /> : <Folder />}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate">{factory.name}</span>
                {projectPath && (
                  <Txt
                    as="span"
                    variant="ui-xs"
                    className="truncate text-left text-icon3"
                    dir="rtl"
                    title={projectPath}
                  >
                    <span dir="ltr">{projectPath}</span>
                  </Txt>
                )}
              </span>
              {factory.id === activeFactory?.id && <Check aria-label="Active factory" />}
            </DropdownMenu.Item>
          );
        })}

        {factories.length > 0 && <DropdownMenu.Separator />}
        <DropdownMenu.Item onSelect={openFactories}>
          <Plus />
          <span>Create Factory</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

import { Check } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';
import { Button } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Spinner } from '@/ds/components/Spinner';
import { Icon } from '@/ds/icons';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { Txt } from '@/ds/components/Txt';

interface AgentCmsSidebarProps {
  basePath: string;
  currentPath: string;
}

function isActive(basePath: string, currentPath: string, pathSuffix: string): boolean {
  const fullPath = basePath + pathSuffix;

  if (pathSuffix === '') {
    return currentPath === basePath || currentPath === basePath + '/';
  }

  return currentPath.startsWith(fullPath);
}

export function AgentCmsSidebar({ basePath, currentPath }: AgentCmsSidebarProps) {
  const { handlePublish, isSubmitting, mode, readOnly } = useAgentEditFormContext();

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <nav className="py-4">
          <ul className="flex flex-col gap-0">
            <SidebarLink
              index={0}
              name="Identity"
              pathSuffix=""
              isLast={false}
              basePath={basePath}
              active={isActive(basePath, currentPath, '')}
              description="hello"
            />
            <SidebarLink
              index={1}
              name="Instructions"
              pathSuffix="/instruction-blocks"
              isLast={false}
              basePath={basePath}
              active={isActive(basePath, currentPath, '/instruction-blocks')}
              description="hello"
            />
            <SidebarLink
              index={2}
              name="Tools"
              pathSuffix="/tools"
              isLast={false}
              basePath={basePath}
              active={isActive(basePath, currentPath, '/tools')}
              description="hello"
            />
            <SidebarLink
              index={3}
              name="Agents"
              pathSuffix="/agents"
              isLast={false}
              basePath={basePath}
              active={isActive(basePath, currentPath, '/agents')}
              description="hello"
            />
            <SidebarLink
              index={4}
              name="Scorers"
              pathSuffix="/scorers"
              isLast={false}
              basePath={basePath}
              active={isActive(basePath, currentPath, '/scorers')}
              description="hello"
            />
            <SidebarLink
              index={5}
              name="Workflows"
              pathSuffix="/workflows"
              isLast={false}
              basePath={basePath}
              active={isActive(basePath, currentPath, '/workflows')}
              description="hello"
            />
            <SidebarLink
              index={6}
              name="Memory"
              pathSuffix="/memory"
              isLast={false}
              basePath={basePath}
              active={isActive(basePath, currentPath, '/memory')}
              description="hello"
            />
            <SidebarLink
              index={7}
              name="Variables"
              pathSuffix="/variables"
              isLast={true}
              basePath={basePath}
              active={isActive(basePath, currentPath, '/variables')}
              description="hello"
            />
          </ul>
        </nav>
      </ScrollArea>

      {!readOnly && (
        <div className="flex-shrink-0 p-4">
          <Button variant="primary" onClick={handlePublish} disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4" />
                {mode === 'edit' ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              <>
                <Icon>
                  <Check />
                </Icon>
                {mode === 'edit' ? 'Update agent' : 'Create agent'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

interface SidebarLinkProps {
  index: number;
  name: string;
  pathSuffix: string;
  isLast: boolean;
  basePath: string;
  active: boolean;
  description: string;
}

const SidebarLink = ({ index, name, pathSuffix, isLast, basePath, active, description }: SidebarLinkProps) => {
  const { Link } = useLinkComponent();

  return (
    <li className="flex flex-col gap-0">
      <Link
        href={basePath + pathSuffix}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 text-sm transition-colors',
          active ? 'bg-surface2 text-neutral5' : 'text-neutral3 hover:bg-surface3 hover:text-neutral5',
        )}
      >
        <Txt
          className="size-6 rounded-full border border-neutral2 flex items-center justify-center text-neutral2 font-mono"
          variant="ui-sm"
        >
          {index + 1}
        </Txt>

        <div>
          <Txt variant="ui-sm" className="text-neutral5">
            {name}
          </Txt>

          <Txt variant="ui-sm" className="text-neutral3">
            {description}
          </Txt>
        </div>
      </Link>

      {!isLast && <div className="bg-surface3 w-0.5 h-2 inline-block ml-6" />}
    </li>
  );
};

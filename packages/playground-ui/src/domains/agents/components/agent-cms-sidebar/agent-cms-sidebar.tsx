import { Check, Blocks } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';
import { Button } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Spinner } from '@/ds/components/Spinner';
import { Icon, AgentIcon, ToolsIcon, JudgeIcon, WorkflowIcon, MemoryIcon, VariablesIcon } from '@/ds/icons';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { Txt } from '@/ds/components/Txt';

interface NavItem {
  name: string;
  pathSuffix: string;
}

const navItems: NavItem[] = [
  { name: 'Identity', pathSuffix: '' },
  { name: 'Instructions', pathSuffix: '/instruction-blocks' },
  { name: 'Tools', pathSuffix: '/tools' },
  { name: 'Agents', pathSuffix: '/agents' },
  { name: 'Scorers', pathSuffix: '/scorers' },
  { name: 'Workflows', pathSuffix: '/workflows' },
  { name: 'Memory', pathSuffix: '/memory' },
  { name: 'Variables', pathSuffix: '/variables' },
];

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
  const { Link } = useLinkComponent();
  const { handlePublish, isSubmitting, mode, readOnly } = useAgentEditFormContext();

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <nav className="py-4">
          <ul className="flex flex-col gap-0">
            {navItems.map((item, index) => {
              const active = isActive(basePath, currentPath, item.pathSuffix);
              const isLast = index === navItems.length - 1;
              return (
                <li key={item.name} className="flex flex-col gap-0">
                  <Link
                    href={basePath + item.pathSuffix}
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

                    {item.name}
                  </Link>

                  {!isLast && <div className="bg-surface3 w-0.5 h-2 inline-block ml-6" />}
                </li>
              );
            })}
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

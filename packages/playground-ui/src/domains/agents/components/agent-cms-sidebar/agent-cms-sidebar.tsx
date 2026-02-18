import { Check, Blocks } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';
import { Button } from '@/ds/components/Button';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Spinner } from '@/ds/components/Spinner';
import { Icon, AgentIcon, ToolsIcon, JudgeIcon, WorkflowIcon, MemoryIcon, VariablesIcon } from '@/ds/icons';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

interface NavItem {
  name: string;
  icon: React.ReactNode;
  pathSuffix: string;
}

const navItems: NavItem[] = [
  { name: 'Identity', icon: <AgentIcon />, pathSuffix: '' },
  { name: 'Instructions', icon: <Blocks />, pathSuffix: '/instruction-blocks' },
  { name: 'Tools', icon: <ToolsIcon className="text-accent6" />, pathSuffix: '/tools' },
  { name: 'Agents', icon: <AgentIcon className="text-accent1" />, pathSuffix: '/agents' },
  { name: 'Scorers', icon: <JudgeIcon className="text-neutral3" />, pathSuffix: '/scorers' },
  { name: 'Workflows', icon: <WorkflowIcon className="text-accent3" />, pathSuffix: '/workflows' },
  { name: 'Memory', icon: <MemoryIcon className="text-neutral3" />, pathSuffix: '/memory' },
  { name: 'Variables', icon: <VariablesIcon />, pathSuffix: '/variables' },
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
        <nav className="p-2">
          <ul className="flex flex-col gap-0.5">
            {navItems.map(item => {
              const active = isActive(basePath, currentPath, item.pathSuffix);
              return (
                <li key={item.name}>
                  <Link
                    href={basePath + item.pathSuffix}
                    className={cn(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                      active ? 'bg-surface3 text-neutral5' : 'text-neutral3 hover:bg-surface4 hover:text-neutral5',
                    )}
                  >
                    <Icon size="sm">{item.icon}</Icon>
                    {item.name}
                  </Link>
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

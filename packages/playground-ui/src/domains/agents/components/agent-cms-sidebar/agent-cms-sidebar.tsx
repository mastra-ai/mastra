import { Check } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';

import { ScrollArea } from '@/ds/components/ScrollArea';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { Txt } from '@/ds/components/Txt';
import { useSidebarDescriptions } from './use-sidebar-descriptions';
import { AGENT_CMS_SECTIONS } from './agent-cms-sections';
import { isActive } from './agent-cms-is-active';

interface AgentCmsSidebarProps {
  basePath: string;
  currentPath: string;
  versionId?: string;
}

export function AgentCmsSidebar({ basePath, currentPath, versionId }: AgentCmsSidebarProps) {
  const { form } = useAgentEditFormContext();
  const descriptions = useSidebarDescriptions(form.control);

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <nav className="py-4">
          <ul className="flex flex-col gap-0">
            {AGENT_CMS_SECTIONS.map((section, index) => (
              <SidebarLink
                key={section.descriptionKey}
                index={index}
                name={section.name}
                pathSuffix={section.pathSuffix}
                isLast={index === AGENT_CMS_SECTIONS.length - 1}
                basePath={basePath}
                active={isActive(basePath, currentPath, section.pathSuffix)}
                description={descriptions[section.descriptionKey].description}
                done={descriptions[section.descriptionKey].done}
                versionId={versionId}
              />
            ))}
          </ul>
        </nav>
      </ScrollArea>
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
  done: boolean;
  versionId?: string;
}

const SidebarLink = ({ index, name, pathSuffix, isLast, basePath, active, description, done, versionId }: SidebarLinkProps) => {
  const { Link } = useLinkComponent();
  const href = basePath + pathSuffix + (versionId ? `?versionId=${versionId}` : '');

  return (
    <li className="flex flex-col gap-0">
      <Link
        href={href}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 text-sm transition-colors border-r-2 border-transparent',
          active ? 'bg-surface2 text-neutral5 border-accent1' : 'text-neutral3 hover:bg-surface3 hover:text-neutral5',
        )}
      >
        {done ? (
          <div className="size-6 rounded-full bg-accent1 flex items-center justify-center flex-shrink-0">
            <Check className="size-3.5 text-white" />
          </div>
        ) : (
          <Txt
            className="size-6 rounded-full border border-neutral2 flex items-center justify-center text-neutral2 font-mono flex-shrink-0"
            variant="ui-sm"
          >
            {index + 1}
          </Txt>
        )}

        <div>
          <Txt variant="ui-sm" className="text-neutral5">
            {name}
          </Txt>

          <Txt variant="ui-xs" className="text-neutral2">
            {description}
          </Txt>
        </div>
      </Link>

      {!isLast && <div className="bg-surface3 w-0.5 h-2 inline-block ml-6" />}
    </li>
  );
};

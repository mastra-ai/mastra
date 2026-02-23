import { ArrowLeft, ArrowRight } from 'lucide-react';

import { useLinkComponent } from '@/lib/framework';
import { Button } from '@/ds/components/Button';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useAgentCmsNavigation } from '../agent-cms-sidebar/use-agent-cms-navigation';

interface AgentCmsBottomBarProps {
  basePath: string;
  currentPath: string;
}

export function AgentCmsBottomBar({ basePath, currentPath }: AgentCmsBottomBarProps) {
  const { form } = useAgentEditFormContext();
  const { navigate } = useLinkComponent();
  const { previous, next, isNextDisabled } = useAgentCmsNavigation(basePath, currentPath, form.control);

  if (!previous && !next) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t border-border1 px-8 py-4">
      <div>
        {previous && (
          <Button type="button" variant="outline" onClick={() => navigate(previous.href)}>
            <ArrowLeft />
            {previous.name}
          </Button>
        )}
      </div>
      <div>
        {next && (
          <Button type="button" variant="light" disabled={isNextDisabled} onClick={() => navigate(next.href)}>
            {next.name}
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

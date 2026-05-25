import { Button } from '@mastra/playground-ui';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { useAgentCmsNavigation } from '../agent-cms-sidebar/use-agent-cms-navigation';
import { useLinkComponent } from '@/lib/framework';

interface AgentCmsBottomBarProps {
  basePath: string;
  currentPath: string;
}

export function AgentCmsBottomBar({ basePath, currentPath }: AgentCmsBottomBarProps) {
  const { form, isCodeAgentOverride } = useAgentEditFormContext();
  const { navigate } = useLinkComponent();
  const { previous, next, isNextDisabled } = useAgentCmsNavigation(
    basePath,
    currentPath,
    form.control,
    isCodeAgentOverride,
  );

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
          <Button type="button" variant="default" disabled={isNextDisabled} onClick={() => navigate(next.href)}>
            {next.name}
            <ArrowRight />
          </Button>
        )}
      </div>
    </div>
  );
}

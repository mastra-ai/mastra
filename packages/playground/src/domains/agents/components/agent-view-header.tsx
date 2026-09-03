import { Button } from '@mastra/playground-ui/components/Button';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { useCopyToClipboard } from '@mastra/playground-ui/hooks/use-copy-to-clipboard';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Check, Link as LinkIcon, MessageSquarePlus, Pencil } from 'lucide-react';

import { useAgent } from '../hooks/use-agent';
import { AgentEntityHeader } from './agent-entity-header';
import { useCanCreateAgent } from '@/domains/agent-builder/hooks/use-can-create-agent';
import { useLinkComponent } from '@/lib/framework';
import { withStudioBasePath } from '@/lib/studio-base-path';

export interface AgentViewHeaderProps {
  agentId: string;
}

export function AgentViewHeader({ agentId }: AgentViewHeaderProps) {
  const { data: agent } = useAgent(agentId);
  const { canCreateAgent } = useCanCreateAgent();
  const { Link: FrameworkLink, paths } = useLinkComponent();

  const sessionUrl = `${window.location.origin}${withStudioBasePath(`/agents/${encodeURIComponent(agentId)}/session`)}`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });

  const isStoredAgent = agent?.source === 'stored';
  const editPath = paths.cmsAgentEditLink(agentId);
  const showEditButton = canCreateAgent && isStoredAgent && Boolean(editPath);

  return (
    <TooltipProvider>
      <div className="flex items-start justify-between gap-2 pr-3 max-lg:py-2">
        <div className="flex min-w-0 flex-1 flex-col max-lg:hidden">
          <AgentEntityHeader agentId={agentId} />
          {agent?.description && (
            <p className="text-neutral4 -mt-2 max-w-prose pr-3 pb-1 pl-12 text-sm">{agent.description}</p>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 py-2">
          {showEditButton && (
            <Button variant="outline" size="sm" as={FrameworkLink} to={editPath}>
              <Icon size="sm">
                <Pencil />
              </Icon>
              Edit
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleShareLink}
            tooltip="Copy session URL to share with your team"
            data-testid="agent-entity-header-share"
          >
            <Icon size="sm">{isShareCopied ? <Check /> : <LinkIcon />}</Icon>
            Share
          </Button>
          <Button
            variant="primary"
            size="sm"
            as={FrameworkLink}
            to={paths.agentNewThreadLink(agentId)}
            data-testid="agent-view-header-new-chat"
          >
            <Icon size="sm">
              <MessageSquarePlus />
            </Icon>
            Open chat
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

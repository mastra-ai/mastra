import { EntityHeader } from '@/ds/components/EntityHeader';
import { Badge } from '@/ds/components/Badge';
import { CopyIcon, Pencil, CopyPlus, Link2, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useAgent } from '../hooks/use-agent';
import { useLinkComponent } from '@/lib/framework';
import { Truncate } from '@/ds/components/Truncate';
import { AgentSourceIcon } from './agent-source-icon';
import { useIsCmsAvailable } from '@/domains/cms';
import { useCloneAgent } from '../hooks/use-clone-agent';
import { usePermissions } from '@/domains/auth';

export interface AgentEntityHeaderProps {
  agentId: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });
  const sessionUrl = `${window.location.origin}/agents/${agentId}/session`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });
  const { isCmsAvailable } = useIsCmsAvailable();
  const { navigate } = useLinkComponent();
  const { cloneAgent, isCloning } = useCloneAgent();
  const { canEdit } = usePermissions();
  const agentName = agent?.name || '';
  const isStoredAgent = agent?.source === 'stored';

  const showStoredAgentBadge = isCmsAvailable && isStoredAgent;
  const canWriteAgents = isCmsAvailable && canEdit('stored-agents');

  const handleClone = async () => {
    const clonedAgent = await cloneAgent(agentId);
    if (clonedAgent?.id) {
      navigate(`/agents/${clonedAgent.id}/chat`);
    }
  };

  return (
    <TooltipProvider>
      <EntityHeader
        icon={isCmsAvailable ? <AgentSourceIcon source={agent?.source} /> : <AgentIcon />}
        title={agentName}
        isLoading={isLoading}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleCopy} className="h-badge-default shrink-0">
                <Badge icon={<CopyIcon />} variant="default">
                  {showStoredAgentBadge ? (
                    <Truncate untilChar="-" withTooltip={false}>
                      {agentId}
                    </Truncate>
                  ) : (
                    agentId
                  )}
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy Agent ID for use in code</TooltipContent>
          </Tooltip>
          {canWriteAgents && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => navigate(`/cms/agents/${agentId}/edit`)} className="h-badge-default shrink-0">
                  <Badge icon={<Pencil />} variant="default">
                    Edit
                  </Badge>
                </button>
              </TooltipTrigger>
              <TooltipContent>{isStoredAgent ? 'Edit agent configuration' : 'Edit agent overrides'}</TooltipContent>
            </Tooltip>
          )}
          {canWriteAgents && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleClone} disabled={isCloning} className="h-badge-default shrink-0">
                  <Badge icon={<CopyPlus />} variant="default">
                    {isCloning ? 'Cloning...' : 'Clone'}
                  </Badge>
                </button>
              </TooltipTrigger>
              <TooltipContent>Clone agent to a new stored agent</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleShareLink} className="h-badge-default shrink-0">
                <Badge icon={isShareCopied ? <Check /> : <Link2 />} variant="default">
                  Share
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy session URL to share with your team</TooltipContent>
          </Tooltip>
        </div>
      </EntityHeader>
    </TooltipProvider>
  );
};

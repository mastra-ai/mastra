import {
  Badge,
  Button,
  EntityHeader,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  AgentIcon,
  Icon,
  useCopyToClipboard,
} from '@mastra/playground-ui';
import { CopyIcon, Link2, Check, Pencil } from 'lucide-react';
import { useAgent } from '../hooks/use-agent';
import { useCanCreateAgent } from '../hooks/use-can-create-agent';
import { useLinkComponent } from '@/lib/framework';

export interface AgentEntityHeaderProps {
  agentId: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const { data: agent, isLoading } = useAgent(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });
  const { canCreateAgent } = useCanCreateAgent();
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const sessionUrl = `${window.location.origin}/agents/${agentId}/session`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });
  const agentName = agent?.name || '';
  const isStoredAgent = agent?.source === 'stored';
  const editPath = paths.cmsAgentEditLink(agentId);
  const showEditButton = canCreateAgent && isStoredAgent && Boolean(editPath);

  return (
    <TooltipProvider>
      <EntityHeader icon={<AgentIcon />} title={agentName} isLoading={isLoading}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {showEditButton && (
            <Button variant="outline" size="sm" as={FrameworkLink} to={editPath}>
              <Icon size="sm">
                <Pencil />
              </Icon>
              Edit
            </Button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={handleCopy} className="h-badge-default shrink-0">
                <Badge icon={<CopyIcon />} variant="default">
                  {agentId}
                </Badge>
              </button>
            </TooltipTrigger>
            <TooltipContent>Copy Agent ID for use in code</TooltipContent>
          </Tooltip>
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

import { useState } from 'react';
import { EntityHeader } from '@/components/ui/entity-header';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { CopyIcon, Pencil, GitBranch } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { useAgent } from '../hooks/use-agent';
import { useAgentVersion } from '../hooks/use-agent-versions';
import { EditAgentDialog } from './create-agent';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/lib/toast';

export interface AgentEntityHeaderProps {
  agentId: string;
}

export const AgentEntityHeader = ({ agentId }: AgentEntityHeaderProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { data: agent, isLoading } = useAgent(agentId);
  const { handleCopy } = useCopyToClipboard({ text: agentId });
  const { navigate, paths } = useLinkComponent();

  const agentName = agent?.name || '';
  const isStoredAgent = agent?.source === 'stored';
  const activeVersionId = agent?.activeVersionId;

  // Fetch active version details for stored agents
  const { data: activeVersion } = useAgentVersion({
    agentId,
    versionId: activeVersionId || '',
  });

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    toast.success('Agent updated successfully');
  };

  const handleDelete = () => {
    setIsEditDialogOpen(false);
    toast.success('Agent deleted');
    navigate(paths.agentsLink());
  };

  return (
    <TooltipProvider>
      <EntityHeader icon={<AgentIcon />} title={agentName} isLoading={isLoading}>
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

        {isStoredAgent && activeVersion && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-badge-default shrink-0">
                <Badge icon={<GitBranch />} variant="default">
                  v{activeVersion.versionNumber}
                  {activeVersion.name && ` - ${activeVersion.name}`}
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent>Active version</TooltipContent>
          </Tooltip>
        )}

        {isStoredAgent && (
          <Button variant="outline" size="md" onClick={() => setIsEditDialogOpen(true)}>
            <Pencil className="w-4 h-4 mr-1" />
            Edit
          </Button>
        )}
      </EntityHeader>

      {isStoredAgent && (
        <EditAgentDialog
          agentId={agentId}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSuccess={handleEditSuccess}
          onDelete={handleDelete}
        />
      )}
    </TooltipProvider>
  );
};

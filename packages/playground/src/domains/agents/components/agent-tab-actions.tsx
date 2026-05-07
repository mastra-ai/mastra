import { IconButton, useCopyToClipboard } from '@mastra/playground-ui';
import { Check, CopyIcon, CopyPlus, Link2, Pencil } from 'lucide-react';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { useAgent } from '../hooks/use-agent';
import { useCloneAgent } from '../hooks/use-clone-agent';
import { useLinkComponent } from '@/lib/framework';

interface AgentTabActionsProps {
  agentId: string;
}

export const AgentTabActions = ({ agentId }: AgentTabActionsProps) => {
  const { data: agent } = useAgent(agentId);
  const { isCmsAvailable } = useIsCmsAvailable();
  const { canEdit } = usePermissions();
  const { navigate } = useLinkComponent();
  const { cloneAgent, isCloning } = useCloneAgent();

  const { handleCopy } = useCopyToClipboard({ text: agentId, copyMessage: 'Agent ID copied to clipboard!' });
  const sessionUrl = `${window.location.origin}/agents/${agentId}/session`;
  const { handleCopy: handleShareLink, isCopied: isShareCopied } = useCopyToClipboard({
    text: sessionUrl,
    copyMessage: 'Session URL copied to clipboard!',
  });

  const isStoredAgent = agent?.source === 'stored';
  const canWriteAgents = isCmsAvailable && canEdit('stored-agents');

  const handleClone = async () => {
    const clonedAgent = await cloneAgent(agentId);
    if (clonedAgent?.id) {
      navigate(`/agents/${clonedAgent.id}/chat`);
    }
  };

  return (
    <>
      <IconButton tooltip="Copy Agent ID" size="sm" variant="ghost" onClick={handleCopy}>
        <CopyIcon />
      </IconButton>

      {canWriteAgents && (
        <IconButton
          tooltip={isStoredAgent ? 'Edit agent configuration' : 'Edit agent overrides'}
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/cms/agents/${agentId}/edit`)}
        >
          <Pencil />
        </IconButton>
      )}

      {canWriteAgents && (
        <IconButton tooltip="Clone agent" size="sm" variant="ghost" onClick={handleClone} disabled={isCloning}>
          <CopyPlus />
        </IconButton>
      )}

      <IconButton tooltip="Copy session URL" size="sm" variant="ghost" onClick={handleShareLink}>
        {isShareCopied ? <Check /> : <Link2 />}
      </IconButton>
    </>
  );
};

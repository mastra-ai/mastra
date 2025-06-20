import { useAgent } from '@/hooks/use-agents';
import { VersionHistory } from './components/version-history';
import { usePromptEnhancer } from './hooks/use-prompt-enhancer';
import { usePromptVersions } from './hooks/use-prompt-versions';

export interface AgentVersionsProps {
  agentId: string;
}

export const AgentVersions = ({ agentId }: AgentVersionsProps) => {
  const { agent } = useAgent(agentId);

  const {
    versions,
    isUpdating,
    versionToDelete,
    setVersions,
    setVersionToDelete,
    deleteVersion,
    updateVersion,
    setVersionActive,
  } = usePromptVersions(agentId, agent?.instructions);

  const { enhancedPrompt, isEnhancing, userComment, enhancePrompt, setUserComment, clearEnhancement, applyChanges } =
    usePromptEnhancer({
      agentId,
      instructions: agent?.instructions,
      versions,
      onVersionCreate: newVersion => {
        setVersions(prev => [...prev, newVersion]);
      },
      onVersionUpdate: updateVersion,
    });

  return (
    <VersionHistory
      versions={versions}
      isUpdating={isUpdating}
      copiedVersions={{}}
      onSetActive={setVersionActive}
      onDelete={deleteVersion}
    />
  );

  return <div>adfads</div>;
};

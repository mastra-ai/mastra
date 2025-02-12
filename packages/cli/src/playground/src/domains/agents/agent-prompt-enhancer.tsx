import { AlertDialog } from '@/components/ui/alert-dialog';

import { useAgent } from '@/hooks/use-agents';

import { CurrentInstructions } from './components/current-instructions';
import { VersionHistory } from './components/version-history';
import { usePromptEnhancer } from './hooks/use-prompt-enhancer';
import { usePromptVersions } from './hooks/use-prompt-versions';

interface AgentPromptEnhancerProps {
  agentId: string;
}

export function AgentPromptEnhancer({ agentId }: AgentPromptEnhancerProps) {
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

  const {
    enhancedPrompt,
    isEnhancing,
    userComment,
    showCommentInput,
    enhancePrompt,
    setUserComment,
    setShowCommentInput,
    clearEnhancement,
    applyChanges,
  } = usePromptEnhancer({
    agentId,
    instructions: agent?.instructions,
    versions,
    onVersionCreate: newVersion => {
      setVersions(prev => [...prev, newVersion]);
    },
    onVersionUpdate: updateVersion,
  });

  return (
    <div className="grid p-4 h-full">
      <div className="space-y-2">
        <CurrentInstructions
          instructions={agent?.instructions}
          enhancedPrompt={enhancedPrompt}
          isEnhancing={isEnhancing}
          showCommentInput={showCommentInput}
          userComment={userComment}
          onEnhance={enhancePrompt}
          onCancel={clearEnhancement}
          onSave={applyChanges}
          onCommentToggle={() => setShowCommentInput(!showCommentInput)}
          onCommentChange={setUserComment}
        />

        <VersionHistory
          versions={versions}
          isUpdating={isUpdating}
          copiedVersions={{}}
          onCopy={async () => {}}
          onSetActive={setVersionActive}
          onDelete={setVersionToDelete}
        />
      </div>

      <AlertDialog open={versionToDelete !== null} onOpenChange={() => setVersionToDelete(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Version {versionToDelete !== null ? versionToDelete + 1 : ''}</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete this version? This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (versionToDelete !== null) {
                  deleteVersion(versionToDelete);
                }
              }}
            >
              Delete
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}

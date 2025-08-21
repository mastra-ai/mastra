import { AlertDialog } from '@mastra/playground-ui';

import { useAgent } from '@/hooks/use-agents';

import { CurrentInstructions } from './components/current-instructions';

import { usePromptEnhancer } from './hooks/use-prompt-enhancer';
import { usePromptVersions } from './hooks/use-prompt-versions';
import { VersionHistoryDialog } from './version-history-dialog';
import { useState } from 'react';

interface AgentPromptEnhancerProps {
  agentId: string;
}

export function AgentPromptEnhancer({ agentId }: AgentPromptEnhancerProps) {
  const { data: agent } = useAgent(agentId);
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false);

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

  if (!agent) return null;

  return (
    <>
      <CurrentInstructions
        instructions={agent.instructions}
        enhancedPrompt={enhancedPrompt}
        isEnhancing={isEnhancing}
        userComment={userComment}
        onEnhance={enhancePrompt}
        onCancel={clearEnhancement}
        onSave={applyChanges}
        onCommentChange={setUserComment}
        agentId={agentId}
        onShowHistory={() => setShowVersionHistoryDialog(true)}
      />

      <VersionHistoryDialog
        versions={versions}
        isUpdating={isUpdating}
        onSetActive={setVersionActive}
        onDelete={setVersionToDelete}
        open={showVersionHistoryDialog}
        onOpenChange={setShowVersionHistoryDialog}
      />

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
    </>
  );
}

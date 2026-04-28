import { v4 as uuid } from '@lukeed/uuid';
import { Alert, AlertDescription, AlertTitle, Button } from '@mastra/playground-ui';
import { Save } from 'lucide-react';
import { useMemo } from 'react';
import { useFormState } from 'react-hook-form';

import { AgentSettingsProvider } from '../../context/agent-context';
import { useOptionalAgentEditFormContext } from '../../context/agent-edit-form-context';
import { BrowserSessionProvider } from '../../context/browser-session-context';
import { AgentChat } from '../agent-chat';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { DatasetSaveProvider } from '@/lib/ai-ui/context/dataset-save-context';

interface AgentPlaygroundTestChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  agentVersionId?: string;
  hasMemory: boolean;
}

function UnsavedChangesBanner({ ctx }: { ctx: NonNullable<ReturnType<typeof useOptionalAgentEditFormContext>> }) {
  const { isDirty } = useFormState({ control: ctx.form.control });
  const handleSaveDraft = ctx.handleSaveDraft;
  const isSavingDraft = ctx.isSavingDraft ?? false;

  if (!isDirty) return null;

  return (
    <Alert variant="warning" className="mx-4 mt-3 mb-0">
      <AlertTitle>Unsaved changes</AlertTitle>
      <AlertDescription as="p">
        You have unsaved changes to the agent configuration. Save your draft to ensure the chat uses your latest
        changes.
      </AlertDescription>
      {handleSaveDraft && (
        <div className="pt-2">
          <Button type="button" variant="light" size="sm" onClick={() => handleSaveDraft()} disabled={isSavingDraft}>
            <Save className="h-3.5 w-3.5" />
            {isSavingDraft ? 'Saving...' : 'Save draft'}
          </Button>
        </div>
      )}
    </Alert>
  );
}

export function AgentPlaygroundTestChat({
  agentId,
  agentName,
  modelVersion,
  agentVersionId,
  hasMemory,
}: AgentPlaygroundTestChatProps) {
  // Generate a stable ephemeral thread ID for test chat sessions
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: regenerate thread ID when agent changes
  const testThreadId = useMemo(() => uuid(), [agentId]);
  const mergedRequestContext = useMergedRequestContext();
  const hasRequestContext = Object.keys(mergedRequestContext).length > 0;

  const editFormCtx = useOptionalAgentEditFormContext();

  return (
    <AgentSettingsProvider agentId={agentId} defaultSettings={{ modelSettings: {} }}>
      <BrowserSessionProvider agentId={agentId} threadId={testThreadId}>
        <DatasetSaveProvider
          enabled
          threadId={testThreadId}
          agentId={agentId}
          requestContext={hasRequestContext ? mergedRequestContext : undefined}
        >
          <div className="flex flex-col h-full">
            {editFormCtx && <UnsavedChangesBanner ctx={editFormCtx} />}
            <div className="flex-1 min-h-0">
              <AgentChat
                key={testThreadId}
                agentId={agentId}
                agentName={agentName}
                modelVersion={modelVersion}
                agentVersionId={agentVersionId}
                threadId={testThreadId}
                memory={hasMemory}
                refreshThreadList={async () => {}}
                isNewThread
              />
            </div>
          </div>
        </DatasetSaveProvider>
      </BrowserSessionProvider>
    </AgentSettingsProvider>
  );
}

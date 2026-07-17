import { v4 as uuid } from '@lukeed/uuid';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Save } from 'lucide-react';
import { useMemo } from 'react';
import { useFormState } from 'react-hook-form';

import { ActivatedSkillsProvider } from '../../context/activated-skills-context';
import { AgentSettingsProvider } from '../../context/agent-context';
import { useOptionalAgentEditFormContext } from '../../context/agent-edit-form-context';
import { BrowserSessionProvider } from '../../context/browser-session-provider';
import { BrowserToolCallsProvider } from '../../context/browser-tool-calls-context';
import { useAgent } from '../../hooks/use-agent';
import { buildAgentDefaultSettings } from '../../utils/agent-default-settings';
import { AgentChat } from '../agent-chat';
import { BrowserViewPanel } from '../browser-view/browser-view-panel';
import { ComposerRunOptions } from '../composer-run-options';
import { ThreadInputProvider } from '@/domains/conversation';
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
  const isCodeSource = ctx.isCodeSourceAgent ?? false;

  if (!isDirty) return null;

  const saveLabel = isCodeSource ? 'Save to filesystem' : 'Save draft';
  const message = isCodeSource
    ? 'You have unsaved changes to the agent configuration. Save to filesystem to ensure the chat uses your latest changes.'
    : 'You have unsaved changes to the agent configuration. Save your draft to ensure the chat uses your latest changes.';

  return (
    <Notice
      variant="warning"
      title="Unsaved changes"
      className="mx-4 mt-3 mb-0"
      action={
        handleSaveDraft && (
          <Button type="button" variant="default" size="sm" onClick={() => handleSaveDraft()} disabled={isSavingDraft}>
            <Save className="h-3.5 w-3.5" />
            {isSavingDraft ? 'Saving...' : saveLabel}
          </Button>
        )
      }
    >
      <Notice.Message>{message}</Notice.Message>
    </Notice>
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
  const { data: agent } = useAgent(agentId);
  const defaultSettings = useMemo(() => buildAgentDefaultSettings(agent), [agent]);

  return (
    <AgentSettingsProvider agentId={agentId} defaultSettings={defaultSettings}>
      <BrowserToolCallsProvider key={`browser-${agentId}-${testThreadId}`}>
        <BrowserSessionProvider
          key={`session-${agentId}-${testThreadId}`}
          agentId={agentId}
          threadId={testThreadId}
          enabled={Boolean(agent?.browserTools?.length)}
        >
          <ThreadInputProvider>
            <ActivatedSkillsProvider key={testThreadId}>
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
                      supportsMemory={agent?.supportsMemory}
                      threadId={testThreadId}
                      memory={hasMemory}
                      modelList={agent?.modelList}
                      isNewThread
                      runOptionsSlot={<ComposerRunOptions requestContextSchema={agent?.requestContextSchema} />}
                    />
                  </div>
                </div>
              </DatasetSaveProvider>
            </ActivatedSkillsProvider>
          </ThreadInputProvider>
          <BrowserViewPanel />
        </BrowserSessionProvider>
      </BrowserToolCallsProvider>
    </AgentSettingsProvider>
  );
}

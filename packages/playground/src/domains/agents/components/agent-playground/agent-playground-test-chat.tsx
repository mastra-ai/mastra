import { v4 as uuid } from '@lukeed/uuid';
import type { AgentVersionLabel, ListAgentVersionsResponse } from '@mastra/client-js';
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
import { toAgentVersionOverrides } from './agent-execution-target';
import type { AgentExecutionTarget } from './agent-execution-target';
import { AgentRunTargetControls } from './agent-run-target-controls';
import { ThreadInputProvider } from '@/domains/conversation';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { DatasetSaveProvider } from '@/lib/ai-ui/context/dataset-save-context';
import type { AgentRunVersionSelectorErrorCode } from '@/types';

interface AgentPlaygroundTestChatProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  executionTarget?: AgentExecutionTarget;
  executionTargetAvailable: boolean;
  isVersionsError: boolean;
  canExecute: boolean;
  isExecutionAccessLoading: boolean;
  isExecutionAccessError: boolean;
  versionLabels: AgentVersionLabel[];
  versions: ListAgentVersionsResponse['versions'];
  isVersionLabelsLoading: boolean;
  isVersionLabelDataStale?: boolean;
  hasVersionLabelIntegrityError?: boolean;
  isRetryingVersionLabels?: boolean;
  isRetryingVersionIntegrity?: boolean;
  isRetryingVersions?: boolean;
  onExecutionTargetChange: (target: AgentExecutionTarget) => void;
  onRetryVersionLabels?: () => void;
  onRetryVersionIntegrity?: () => Promise<void>;
  onRetryVersions?: () => Promise<void>;
  onRunVersionSelectorError: (code: AgentRunVersionSelectorErrorCode) => void;
  onRunAuthorizationError: () => void;
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
  executionTarget,
  executionTargetAvailable,
  isVersionsError,
  canExecute,
  isExecutionAccessLoading,
  isExecutionAccessError,
  versionLabels,
  versions,
  isVersionLabelsLoading,
  isVersionLabelDataStale,
  hasVersionLabelIntegrityError,
  isRetryingVersionLabels,
  isRetryingVersionIntegrity,
  isRetryingVersions,
  onExecutionTargetChange,
  onRetryVersionLabels,
  onRetryVersionIntegrity,
  onRetryVersions,
  onRunVersionSelectorError,
  onRunAuthorizationError,
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
  const canStartRun = !isVersionsError && executionTargetAvailable && canExecute && !isExecutionAccessLoading;
  const canContinueRun = canExecute && !isExecutionAccessLoading && !isExecutionAccessError;
  const authorizationBlockedReason = isExecutionAccessLoading
    ? 'Checking agent execution access…'
    : isExecutionAccessError
      ? 'Agent execution access could not be verified'
      : canExecute
        ? undefined
        : "You don't have permission to execute this agent";
  const runBlockedReason = isVersionsError
    ? 'Agent versions could not be loaded. Retry before running.'
    : !executionTargetAvailable
      ? 'Choose an available run target before sending a message'
      : authorizationBlockedReason;
  const runOptionsSlot = executionTarget ? (
    <AgentRunTargetControls
      target={executionTarget}
      labels={versionLabels}
      versions={versions}
      isAvailable={executionTargetAvailable}
      isLoading={isVersionLabelsLoading}
      isLabelDataStale={isVersionLabelDataStale}
      hasLabelIntegrityError={hasVersionLabelIntegrityError}
      isRetryingLabels={isRetryingVersionLabels}
      isRetryingIntegrity={isRetryingVersionIntegrity}
      hasVersionHistoryError={isVersionsError}
      isRetryingVersions={isRetryingVersions}
      requestContextSchema={agent?.requestContextSchema}
      onTargetChange={onExecutionTargetChange}
      onRetryLabels={onRetryVersionLabels}
      onRetryIntegrity={onRetryVersionIntegrity}
      onRetryVersions={onRetryVersions}
    />
  ) : (
    <ComposerRunOptions requestContextSchema={agent?.requestContextSchema} />
  );

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
                <div className="flex h-full flex-col">
                  {editFormCtx && <UnsavedChangesBanner ctx={editFormCtx} />}
                  <div className="min-h-0 flex-1">
                    <AgentChat
                      key={testThreadId}
                      agentId={agentId}
                      agentName={agentName}
                      modelVersion={modelVersion}
                      versions={toAgentVersionOverrides(executionTarget)}
                      canStartRun={canStartRun}
                      runBlockedReason={runBlockedReason}
                      canContinueRun={canContinueRun}
                      continuationBlockedReason={authorizationBlockedReason}
                      onRunVersionSelectorError={onRunVersionSelectorError}
                      onRunAuthorizationError={onRunAuthorizationError}
                      supportsMemory={agent?.supportsMemory}
                      threadId={testThreadId}
                      memory={hasMemory}
                      modelList={agent?.modelList}
                      isNewThread
                      runOptionsSlot={runOptionsSlot}
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

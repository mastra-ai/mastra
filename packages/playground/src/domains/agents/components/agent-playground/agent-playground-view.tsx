import type { ListAgentVersionsResponse } from '@mastra/client-js';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { getAgentVersionLabelError } from '../../hooks/agent-version-label-error';
import { agentVersionQueryKeys, invalidateAgentVersionState } from '../../hooks/agent-version-query-keys';
import { useAgentVersionLabels } from '../../hooks/use-agent-version-labels';
import { AgentLayout } from '../agent-layout';
import { SidebarPanel } from '../sidebar-panel';
import {
  getComputedAgentVersionLabels,
  getAgentVersionLabelsFromVersions,
  isAgentExecutionTargetAvailable,
  mergeAgentVersionLabels,
} from './agent-execution-target';
import type { AgentExecutionTarget } from './agent-execution-target';
import { AgentPlaygroundConfig } from './agent-playground-config';
import { AgentPlaygroundTestChat } from './agent-playground-test-chat';
import { AgentPlaygroundVersionBar } from './agent-playground-version-bar';
import type { ProductionActivationInput, ProductionActivationResult } from './agent-playground-version-bar';
import { useAgentVersionAccess } from '@/domains/auth/hooks/use-agent-version-access';
import { useAgentVersionLabelCapabilities } from '@/domains/configuration/hooks/use-agent-version-label-capabilities';
import { useMastraPackages } from '@/domains/configuration/hooks/use-mastra-packages';
import type { AgentRunVersionSelectorErrorCode } from '@/types';

interface AgentPlaygroundViewProps {
  agentId: string;
  agentName?: string;
  modelVersion?: string;
  versions: ListAgentVersionsResponse['versions'];
  isVersionsError?: boolean;
  isVersionsFetching?: boolean;
  hasMemory: boolean;
  activeVersionId?: string;
  selectedVersionId?: string;
  latestVersionId?: string;
  onVersionSelect: (versionId: string) => void;
  isDirty: boolean;
  isSavingDraft: boolean;
  isPublishing: boolean;
  hasDraft: boolean;
  readOnly: boolean;
  isCodeAgentOverride?: boolean;
  isCodeSourceAgent?: boolean;
  showCodeModeActions?: boolean;
  canOpenPr?: boolean;
  openPrTitle?: string;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<boolean>;
  onActivateProduction?: (input: ProductionActivationInput) => Promise<ProductionActivationResult>;
  onRefreshProduction?: () => Promise<string | null>;
  onRetryVersions?: () => Promise<void>;
  onDownloadJson?: () => Promise<void>;
  onOpenPr?: () => Promise<void>;
  isViewingPreviousVersion?: boolean;
}

function LeftPanel({
  agentId,
  activeVersionId,
  selectedVersionId,
  latestVersionId,
  onVersionSelect,
  isDirty,
  isSavingDraft,
  isPublishing,
  hasDraft,
  readOnly,
  canPublish,
  isPublishAccessLoading,
  isVersionHistoryError,
  isCodeSourceAgent,
  showCodeModeActions,
  canOpenPr,
  openPrTitle,
  onSaveDraft,
  onPublish,
  onActivateProduction,
  onRefreshProduction,
  onDownloadJson,
  onOpenPr,
  isViewingPreviousVersion,
}: {
  agentId: string;
  activeVersionId?: string;
  selectedVersionId?: string;
  latestVersionId?: string;
  onVersionSelect: (versionId: string) => void;
  isDirty: boolean;
  isSavingDraft: boolean;
  isPublishing: boolean;
  hasDraft: boolean;
  readOnly: boolean;
  canPublish: boolean;
  isPublishAccessLoading: boolean;
  isVersionHistoryError: boolean;
  isCodeSourceAgent?: boolean;
  showCodeModeActions?: boolean;
  canOpenPr?: boolean;
  openPrTitle?: string;
  onSaveDraft: (changeMessage?: string) => Promise<void>;
  onPublish: () => Promise<boolean>;
  onActivateProduction?: (input: ProductionActivationInput) => Promise<ProductionActivationResult>;
  onRefreshProduction?: () => Promise<string | null>;
  onDownloadJson?: () => Promise<void>;
  onOpenPr?: () => Promise<void>;
  isViewingPreviousVersion?: boolean;
}) {
  const { versionSelector, actionBar } = AgentPlaygroundVersionBar({
    agentId,
    activeVersionId,
    selectedVersionId,
    onVersionSelect,
    isDirty,
    isSavingDraft,
    isPublishing,
    hasDraft,
    readOnly,
    canPublish,
    isPublishAccessLoading,
    isVersionHistoryError,
    isCodeSourceAgent,
    showCodeModeActions,
    canOpenPr,
    openPrTitle,
    onSaveDraft,
    onPublish,
    onActivateProduction,
    onRefreshProduction,
    onDownloadJson,
    onOpenPr,
    isViewingPreviousVersion,
  });

  return (
    <SidebarPanel>
      {versionSelector}

      <div className="px-4 pt-3">
        <Txt variant="ui-sm" className="text-neutral3">
          Edit your agent's system prompt, tools, and variables below.
        </Txt>
      </div>

      <div className="min-h-0 flex-1">
        <AgentPlaygroundConfig
          agentId={agentId}
          selectedVersionId={selectedVersionId}
          latestVersionId={latestVersionId}
        />
      </div>

      {actionBar}
    </SidebarPanel>
  );
}

export function AgentPlaygroundView({
  agentId,
  agentName,
  modelVersion,
  versions,
  isVersionsError = false,
  isVersionsFetching = false,
  hasMemory,
  activeVersionId,
  selectedVersionId,
  latestVersionId,
  onVersionSelect,
  isDirty,
  isSavingDraft,
  isPublishing,
  hasDraft,
  readOnly,
  isCodeAgentOverride = false,
  isCodeSourceAgent,
  showCodeModeActions,
  canOpenPr,
  openPrTitle,
  onSaveDraft,
  onPublish,
  onActivateProduction,
  onRefreshProduction,
  onRetryVersions,
  onDownloadJson,
  onOpenPr,
  isViewingPreviousVersion,
}: AgentPlaygroundViewProps) {
  const [executionTarget, setExecutionTarget] = useState<AgentExecutionTarget | undefined>(() =>
    latestVersionId ? { kind: 'version', versionId: latestVersionId } : undefined,
  );
  const [isExecutionTargetRejected, setIsExecutionTargetRejected] = useState(false);
  const [hasRunVersionLabelIntegrityError, setHasRunVersionLabelIntegrityError] = useState(false);
  const [isRetryingVersionIntegrity, setIsRetryingVersionIntegrity] = useState(false);
  const [isExecutionAccessRejected, setIsExecutionAccessRejected] = useState(false);
  const [isAgentUnavailable, setIsAgentUnavailable] = useState(false);
  const queryClient = useQueryClient();
  const labelCapabilities = useAgentVersionLabelCapabilities();
  const versionAccess = useAgentVersionAccess(agentId);
  const packagesQuery = useMastraPackages();
  const isSourceProviderBacked =
    isCodeAgentOverride && packagesQuery.data?.editorSourceCapabilities?.storage === 'source-provider';
  const canReadCustomLabels =
    !isSourceProviderBacked &&
    !labelCapabilities.isLoading &&
    !labelCapabilities.isError &&
    !versionAccess.isLoading &&
    !versionAccess.isError &&
    labelCapabilities.supportsRead &&
    versionAccess.canRead;
  const labelsQuery = useAgentVersionLabels({
    agentId,
    enabled: versions.length > 0 && canReadCustomLabels,
  });
  const labelError = getAgentVersionLabelError(labelsQuery.error);
  const hasLabelIntegrityError = labelError?.code === 'VERSION_LABEL_INTEGRITY_ERROR';
  const hasVersionLabelIntegrityError = hasLabelIntegrityError || hasRunVersionLabelIntegrityError;
  const hasStaleLabelData = labelsQuery.isError && Boolean(labelsQuery.data) && !hasLabelIntegrityError;
  const isAgentMissingOrInaccessible = isAgentUnavailable || labelError?.code === 'ENTITY_NOT_FOUND';
  const computedLabels = getComputedAgentVersionLabels(versions);
  const versionRowLabels = getAgentVersionLabelsFromVersions(versions);
  const canUseVersionRowCustomLabels =
    !isSourceProviderBacked &&
    !labelCapabilities.isLoading &&
    !labelCapabilities.isError &&
    labelCapabilities.supportsRead &&
    !versionAccess.isLoading &&
    !versionAccess.isError &&
    versionAccess.canRead;
  const versionLabels =
    canUseVersionRowCustomLabels && !hasVersionLabelIntegrityError
      ? mergeAgentVersionLabels(versionRowLabels, labelsQuery.data?.labels)
      : computedLabels;
  const executionTargetAvailable =
    !isVersionsError &&
    !isExecutionTargetRejected &&
    (executionTarget
      ? isAgentExecutionTargetAvailable(executionTarget, versionLabels, versions)
      : versions.length === 0);
  const isVersionLabelsLoading =
    labelCapabilities.isLoading || versionAccess.isLoading || (canReadCustomLabels && labelsQuery.isLoading);
  useEffect(() => {
    if (!latestVersionId) return;
    setExecutionTarget(currentTarget => currentTarget ?? { kind: 'version', versionId: latestVersionId });
  }, [latestVersionId]);
  const handleExecutionTargetChange = useCallback((target: AgentExecutionTarget) => {
    setExecutionTarget(target);
    setIsExecutionTargetRejected(false);
    setHasRunVersionLabelIntegrityError(false);
  }, []);
  const handleRunVersionSelectorError = useCallback(
    (code: AgentRunVersionSelectorErrorCode) => {
      if (code === 'ENTITY_NOT_FOUND') {
        setIsAgentUnavailable(true);
      }
      if (code === 'VERSION_LABEL_INTEGRITY_ERROR') {
        setHasRunVersionLabelIntegrityError(true);
      }
      setIsExecutionTargetRejected(true);
      void invalidateAgentVersionState(queryClient, agentId);
      if (code === 'VERSION_LABELS_UNSUPPORTED') {
        void queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.capability });
      }
    },
    [agentId, queryClient],
  );
  const handleRunAuthorizationError = useCallback(() => {
    setIsExecutionAccessRejected(true);
    void queryClient.invalidateQueries({ queryKey: agentVersionQueryKeys.authorization });
  }, [queryClient]);
  const handleRetryVersionIntegrity = async () => {
    setIsRetryingVersionIntegrity(true);
    try {
      const labelsResult = await labelsQuery.refetch({ throwOnError: true });
      if (labelsResult.error) return;
      await onRetryVersions?.();
      setHasRunVersionLabelIntegrityError(false);
      setIsExecutionTargetRejected(false);
    } catch {
      // The query state keeps the integrity treatment visible with its retry path.
    } finally {
      setIsRetryingVersionIntegrity(false);
    }
  };
  const canExecute = versionAccess.canExecute && !isExecutionAccessRejected;

  return (
    <AgentLayout
      agentId={agentId}
      leftDrawerLabel="Open configuration"
      leftSlot={
        <LeftPanel
          agentId={agentId}
          activeVersionId={activeVersionId}
          selectedVersionId={selectedVersionId}
          latestVersionId={latestVersionId}
          onVersionSelect={onVersionSelect}
          isDirty={isDirty}
          isSavingDraft={isSavingDraft}
          isPublishing={isPublishing}
          hasDraft={hasDraft}
          readOnly={readOnly}
          canPublish={versionAccess.canPublish}
          isPublishAccessLoading={versionAccess.isLoading || versionAccess.isError}
          isVersionHistoryError={isVersionsError}
          isCodeSourceAgent={isCodeSourceAgent}
          showCodeModeActions={showCodeModeActions}
          canOpenPr={canOpenPr}
          openPrTitle={openPrTitle}
          onSaveDraft={onSaveDraft}
          onPublish={onPublish}
          onActivateProduction={onActivateProduction}
          onRefreshProduction={onRefreshProduction}
          onDownloadJson={onDownloadJson}
          onOpenPr={onOpenPr}
          isViewingPreviousVersion={isViewingPreviousVersion}
        />
      }
    >
      {isAgentMissingOrInaccessible ? (
        <div className="flex h-full items-center justify-center p-6">
          <div role="alert" className="border-border1 bg-surface2 max-w-lg rounded-lg border p-4 text-center">
            <Txt variant="ui-md" className="font-medium">
              Agent missing or inaccessible
            </Txt>
            <Txt variant="ui-sm" className="text-neutral3 mt-1">
              This agent no longer exists or you no longer have access. New runs are disabled.
            </Txt>
          </div>
        </div>
      ) : (
        <AgentPlaygroundTestChat
          agentId={agentId}
          agentName={agentName}
          modelVersion={modelVersion}
          executionTarget={executionTarget}
          executionTargetAvailable={executionTargetAvailable}
          isVersionsError={isVersionsError}
          canExecute={canExecute}
          isExecutionAccessLoading={versionAccess.isLoading}
          isExecutionAccessError={versionAccess.isError}
          versionLabels={versionLabels}
          versions={versions}
          isVersionLabelsLoading={isVersionLabelsLoading}
          isVersionLabelDataStale={hasStaleLabelData}
          hasVersionLabelIntegrityError={hasVersionLabelIntegrityError}
          isRetryingVersionLabels={labelsQuery.isFetching}
          isRetryingVersionIntegrity={isRetryingVersionIntegrity}
          isRetryingVersions={isVersionsFetching}
          onExecutionTargetChange={handleExecutionTargetChange}
          onRetryVersionLabels={() => void labelsQuery.refetch()}
          onRetryVersionIntegrity={handleRetryVersionIntegrity}
          onRetryVersions={onRetryVersions}
          onRunVersionSelectorError={handleRunVersionSelectorError}
          onRunAuthorizationError={handleRunAuthorizationError}
          hasMemory={hasMemory}
        />
      )}
    </AgentLayout>
  );
}

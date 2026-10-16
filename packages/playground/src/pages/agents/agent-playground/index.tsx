import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useAgent, useStoredAgent } from '@mastra/react/hooks/agents';
import { useMemory } from '@mastra/react/hooks/memory';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import type {
  ProductionActivationInput,
  ProductionActivationResult,
} from '@/domains/agents/components/agent-playground/agent-playground-version-bar';
import { AgentPlaygroundView } from '@/domains/agents/components/agent-playground/agent-playground-view';
import { AgentEditFormProvider } from '@/domains/agents/context/agent-edit-form-context';
import { getAgentVersionLabelError } from '@/domains/agents/hooks/agent-version-label-error';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import {
  useActivateAgentVersion,
  useAllAgentVersions,
  useAgentVersion,
} from '@/domains/agents/hooks/use-agent-versions';
import { mapAgentResponseToDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import type { AgentDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import { getEditorOwnership } from '@/domains/agents/utils/editor-ownership';
import { useEditorSource } from '@/domains/configuration/hooks/use-editor-source';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';

type AgentPreviewSelection = { versionId: string } | { latestDraft: true };

function AgentPlayground() {
  const { agentId } = useParams();
  const [previewSelection, setPreviewSelection] = useState<AgentPreviewSelection>({ latestDraft: true });
  const selectedVersionId = 'versionId' in previewSelection ? previewSelection.versionId : null;

  const {
    data: codeAgent,
    isLoading: isLoadingCodeAgent,
    error,
  } = useAgent({
    agentId: agentId!,
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const { data: memory } = useMemory({
    agentId: agentId!,
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const editorSource = useEditorSource();
  const { isMastraPlatform, mastraPlatformApiEndpoint, mastraPlatformProjectId } = useMastraPlatform();

  // Fetch versions first — this endpoint returns an empty array for code-only agents
  const {
    data: versionsData,
    isLoading: isLoadingVersions,
    isError: isVersionsError,
    isFetching: isFetchingVersions,
    refetch: refetchVersions,
  } = useAllAgentVersions(
    {
      agentId,
      params: { orderBy: { direction: 'DESC' } },
    },
    useEntityRequestContext('agent', agentId!)[0],
  );

  // Only fetch stored agent details when versions exist (avoids 404 for code-only agents)
  const hasVersions = (versionsData?.versions?.length ?? 0) > 0;
  const {
    data: storedAgent,
    isLoading: isLoadingStoredAgent,
    isError: isStoredAgentError,
    isFetching: isFetchingStoredAgent,
    refetch: refetchStoredAgent,
  } = useStoredAgent({
    agentId,
    status: 'draft',
    requestContext: useEntityRequestContext('agent', agentId!)[0],
    queryOptions: { enabled: Boolean(agentId) && hasVersions },
  });
  const { mutateAsync: activateProductionVersion, isPending: isActivatingProduction } = useActivateAgentVersion(
    {
      agentId: agentId ?? '',
    },
    useEntityRequestContext('agent', agentId!)[0],
  );

  const isCodeAgentOverride = codeAgent?.source === 'code';
  const isCodeSourceAgent = isCodeAgentOverride && editorSource === 'code';
  const isCodeAgentEditable = !getEditorOwnership(isCodeAgentOverride, codeAgent?.editor).isFullyLocked;
  const showCodeModeActions = isCodeSourceAgent && isCodeAgentEditable;
  const canOpenPr = showCodeModeActions && isMastraPlatform && !!mastraPlatformApiEndpoint && !!mastraPlatformProjectId;
  const openPrTitle = canOpenPr ? 'Open a pull request for these JSON changes' : undefined;
  const isLoading = isLoadingCodeAgent || isLoadingVersions || (hasVersions && isLoadingStoredAgent);
  const hasMemory = Boolean(memory?.result);

  // Fetch version data when a specific version is selected
  const { data: versionData } = useAgentVersion(
    {
      agentId: agentId ?? '',
      versionId: selectedVersionId ?? '',
    },
    useEntityRequestContext('agent', agentId!)[0],
  );

  const activeVersionId = storedAgent?.activeVersionId;
  const latestVersion = versionsData?.versions?.[0];
  const hasDraft = !isStoredAgentError && !!(latestVersion && latestVersion.id !== activeVersionId);

  // Determine if viewing a previous (non-latest) version
  const isViewingVersion = !!selectedVersionId && !!versionData;
  const isViewingPreviousVersion = isViewingVersion && selectedVersionId !== latestVersion?.id;

  // Switch data source based on selected version
  const dataSource = useMemo<AgentDataSource>(() => {
    if (isViewingVersion && versionData) return versionData;
    if (storedAgent) return storedAgent;
    if (codeAgent) return mapAgentResponseToDataSource(codeAgent);
    return {} as AgentDataSource;
  }, [isViewingVersion, versionData, storedAgent, codeAgent]);

  const {
    form,
    handlePublish,
    handleSaveDraft,
    handleDownloadJson,
    handleOpenPr,
    isSubmitting,
    isSavingDraft,
    isDirty,
  } = useAgentCmsForm(
    {
      mode: 'edit',
      agentId: agentId ?? '',
      dataSource,
      isCodeAgentOverride,
      hasStoredOverride: isCodeAgentOverride && !!storedAgent,
      editorConfig: codeAgent?.editor,
      saveSuccessMessage: isCodeSourceAgent ? 'Saved to filesystem' : undefined,
      onSuccess: () => {},
    },
    useEntityRequestContext('agent', agentId!)[0],
  );

  const handlePublishVersion = useCallback(async () => {
    if (isViewingPreviousVersion && selectedVersionId) {
      return handlePublish(selectedVersionId);
    }
    return handlePublish();
  }, [handlePublish, isViewingPreviousVersion, selectedVersionId]);

  const handleRefreshProduction = useCallback(async (): Promise<string | null> => {
    const result = await refetchStoredAgent({ throwOnError: true });
    if (result.error) throw result.error;
    return result.data?.activeVersionId ?? null;
  }, [refetchStoredAgent]);

  const handleRetryVersions = useCallback(async (): Promise<void> => {
    const result = await refetchVersions({ throwOnError: true });
    if (result.error) throw result.error;
  }, [refetchVersions]);

  const handleRetryProductionState = async (): Promise<void> => {
    await handleRefreshProduction();
  };

  const handleActivateProduction = useCallback(
    async (input: ProductionActivationInput): Promise<ProductionActivationResult> => {
      try {
        await activateProductionVersion(input);
        toast.success('Production updated');
        return { status: 'success' };
      } catch (error) {
        const labelError = getAgentVersionLabelError(error);
        if (labelError?.code === 'LABEL_MOVE_CONFLICT') {
          try {
            const currentActiveVersionId = await handleRefreshProduction();
            return {
              status: 'conflict',
              currentActiveVersionId,
              message: labelError.message,
            };
          } catch {
            return { status: 'conflict', message: labelError.message };
          }
        }

        const message = labelError?.message ?? (error instanceof Error ? error.message : 'Unknown error');
        toast.error(`Failed to update Production: ${message}`);
        return { status: 'error', code: labelError?.code, message };
      }
    },
    [activateProductionVersion, handleRefreshProduction],
  );

  const handleOpenPrClick = useCallback(async () => {
    if (!mastraPlatformApiEndpoint || !mastraPlatformProjectId) return;
    await handleOpenPr({ platformApiEndpoint: mastraPlatformApiEndpoint, projectId: mastraPlatformProjectId });
  }, [handleOpenPr, mastraPlatformApiEndpoint, mastraPlatformProjectId]);

  const handleVersionSelect = useCallback(
    (versionId: string) => {
      // If selecting the latest version, clear the selection (back to editable draft)
      if (versionId === latestVersion?.id) {
        setPreviewSelection({ latestDraft: true });
      } else {
        setPreviewSelection({ versionId });
      }
    },
    [latestVersion?.id],
  );

  if (error && is401UnauthorizedError(error)) {
    return <SessionExpired variant="fill" />;
  }

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied variant="fill" resource="agents" />;
  }

  if (isVersionsError && !versionsData) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div role="alert" className="max-w-lg rounded-lg border border-border bg-fill-hover p-4 text-center">
          <p className="font-medium">Agent versions could not be loaded. Retry before running.</p>
          <p className="mt-1 text-body text-muted-foreground">
            Running is disabled to avoid using an unintended version.
          </p>
          <Button
            type="button"
            variant="default"
            size="sm"
            className="mt-3"
            onClick={() => void refetchVersions()}
            disabled={isFetchingVersions}
          >
            {isFetchingVersions ? 'Retrying version history…' : 'Retry version history'}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <Spinner fill />;
  }

  // A 404 is authoritative even if a previous fetch left stale data in the cache.
  if (error && is404NotFoundError(error)) {
    return <div className="py-4 text-center">Agent not found</div>;
  }

  if (error) {
    return <EmptyState tone="error" titleSlot="Failed to load agent" descriptionSlot={error.message} />;
  }

  if (!codeAgent) {
    return <div className="py-4 text-center">Agent not found</div>;
  }

  return (
    <AgentEditFormProvider
      form={form}
      mode="edit"
      agentId={agentId}
      isSubmitting={isSubmitting}
      isSavingDraft={isSavingDraft}
      handlePublish={handlePublish}
      handleSaveDraft={handleSaveDraft}
      isCodeAgentOverride={isCodeAgentOverride}
      isCodeSourceAgent={isCodeSourceAgent}
      readOnly={isViewingPreviousVersion || !isCodeAgentEditable}
      editorConfig={codeAgent?.editor}
    >
      <AgentPlaygroundView
        key={agentId}
        agentId={agentId!}
        agentName={codeAgent?.name}
        modelVersion={codeAgent?.modelVersion}
        versions={versionsData?.versions ?? []}
        isVersionsError={isVersionsError}
        isVersionsFetching={isFetchingVersions}
        hasMemory={hasMemory}
        activeVersionId={activeVersionId}
        selectedVersionId={selectedVersionId ?? undefined}
        latestVersionId={latestVersion?.id}
        onVersionSelect={handleVersionSelect}
        isDirty={isDirty}
        isSavingDraft={isSavingDraft}
        isPublishing={isSubmitting || isActivatingProduction}
        hasDraft={hasDraft}
        isProductionStateError={hasVersions && isStoredAgentError}
        isProductionStateFetching={isFetchingStoredAgent}
        readOnly={isViewingPreviousVersion || !isCodeAgentEditable}
        isCodeAgentOverride={isCodeAgentOverride}
        isCodeSourceAgent={isCodeSourceAgent}
        showCodeModeActions={showCodeModeActions}
        canOpenPr={canOpenPr}
        openPrTitle={openPrTitle}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublishVersion}
        onActivateProduction={handleActivateProduction}
        onRefreshProduction={handleRefreshProduction}
        onRetryProductionState={handleRetryProductionState}
        onRetryVersions={handleRetryVersions}
        onDownloadJson={handleDownloadJson}
        onOpenPr={handleOpenPrClick}
        isViewingPreviousVersion={isViewingPreviousVersion}
      />
    </AgentEditFormProvider>
  );
}

export default AgentPlayground;

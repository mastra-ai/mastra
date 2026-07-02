import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useCallback, useMemo, useState } from 'react';
import type { AgentConfigTab } from './agent-playground/agent-playground-config';
import { AgentPlaygroundEditorPanelContent } from './agent-playground/agent-playground-view';
import { AgentSidebarVersionHeader } from './agent-sidebar-version-header';
import { AgentEditFormProvider } from '@/domains/agents/context/agent-edit-form-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import { useAgentVersion, useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { mapAgentResponseToDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import type { AgentDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import { useEditorSource } from '@/domains/configuration/hooks/use-editor-source';
import { useMastraPlatform } from '@/lib/mastra-platform/hooks/use-mastra-platform';

export function AgentVersionSidebarPanel({ agentId, onClose }: { agentId: string; onClose?: () => void }) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [selectedConfigTab, setSelectedConfigTab] = useState<AgentConfigTab>('prompt');

  const { data: codeAgent, isLoading: isLoadingCodeAgent, error } = useAgent(agentId);
  const editorSource = useEditorSource();
  const { isMastraPlatform, mastraPlatformApiEndpoint, mastraPlatformProjectId } = useMastraPlatform();

  const { data: versionsData, isLoading: isLoadingVersions } = useAgentVersions({
    agentId,
    params: { orderBy: { direction: 'DESC' } },
  });

  const hasVersions = (versionsData?.versions?.length ?? 0) > 0;
  const { data: storedAgent, isLoading: isLoadingStoredAgent } = useStoredAgent(agentId, {
    status: 'draft',
    enabled: hasVersions,
  });
  const activeVersionId = storedAgent ? (storedAgent.activeVersionId ?? undefined) : codeAgent?.activeVersionId;
  const versionIdToLoad = selectedVersionId ?? activeVersionId ?? '';

  const { data: versionData, isLoading: isLoadingVersion } = useAgentVersion({
    agentId,
    versionId: versionIdToLoad,
  });

  const isCodeAgentOverride = codeAgent?.source === 'code';
  const isCodeSourceAgent = isCodeAgentOverride && editorSource === 'code';
  const isCodeAgentEditable = !isCodeAgentOverride || codeAgent?.editor !== false;
  const showCodeModeActions = isCodeSourceAgent && isCodeAgentEditable;
  const canOpenPr = showCodeModeActions && isMastraPlatform && !!mastraPlatformApiEndpoint && !!mastraPlatformProjectId;
  const openPrTitle = canOpenPr ? 'Open a pull request for these JSON changes' : undefined;
  const isLoading =
    isLoadingCodeAgent ||
    isLoadingVersions ||
    (hasVersions && isLoadingStoredAgent) ||
    !!(versionIdToLoad && isLoadingVersion);

  const latestVersion = versionsData?.versions?.[0];
  const hasDraft = !!(latestVersion && latestVersion.id !== activeVersionId);
  const hasLoadedVersionData = !!versionIdToLoad && !!versionData;
  const isViewingPreviousVersion =
    !!selectedVersionId && hasLoadedVersionData && selectedVersionId !== latestVersion?.id;

  const dataSource = useMemo<AgentDataSource>(() => {
    if (hasLoadedVersionData && versionData) return versionData;
    if (codeAgent) return mapAgentResponseToDataSource(codeAgent);
    if (storedAgent) return storedAgent;
    return {} as AgentDataSource;
  }, [codeAgent, hasLoadedVersionData, storedAgent, versionData]);

  const {
    form,
    handlePublish,
    handleSaveDraft,
    handleDownloadJson,
    handleOpenPr,
    isSubmitting,
    isSavingDraft,
    isDirty,
  } = useAgentCmsForm({
    mode: 'edit',
    agentId,
    dataSource,
    isCodeAgentOverride,
    hasStoredOverride: isCodeAgentOverride && !!storedAgent,
    editorConfig: codeAgent?.editor,
    saveSuccessMessage: isCodeSourceAgent ? 'Saved to filesystem' : undefined,
    onValidationSectionRequired: setSelectedConfigTab,
    onSuccess: () => {},
  });

  const handlePublishVersion = useCallback(async () => {
    if (isViewingPreviousVersion && selectedVersionId) {
      await handlePublish(selectedVersionId);
    } else {
      await handlePublish();
    }
  }, [handlePublish, isViewingPreviousVersion, selectedVersionId]);

  const handleOpenPrClick = useCallback(async () => {
    if (!mastraPlatformApiEndpoint || !mastraPlatformProjectId) return;
    await handleOpenPr({ platformApiEndpoint: mastraPlatformApiEndpoint, projectId: mastraPlatformProjectId });
  }, [handleOpenPr, mastraPlatformApiEndpoint, mastraPlatformProjectId]);

  const handleVersionSelect = useCallback((versionId: string | null) => {
    setSelectedVersionId(versionId);
  }, []);

  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="agents" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
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
      <div className="flex h-full min-h-0 flex-col">
        <AgentSidebarVersionHeader
          agentId={agentId}
          selectedVersionId={selectedVersionId}
          onVersionSelect={handleVersionSelect}
          onCreateVersion={() => void handleSaveDraft()}
          onBack={onClose}
          showEditorAction={false}
          showCreateVersionAction={false}
        />

        <AgentPlaygroundEditorPanelContent
          agentId={agentId}
          activeVersionId={activeVersionId}
          selectedVersionId={selectedVersionId ?? undefined}
          latestVersionId={latestVersion?.id}
          onVersionSelect={handleVersionSelect}
          isDirty={isDirty}
          isSavingDraft={isSavingDraft}
          isPublishing={isSubmitting}
          hasDraft={hasDraft}
          readOnly={isViewingPreviousVersion || !isCodeAgentEditable}
          isCodeSourceAgent={isCodeSourceAgent}
          showCodeModeActions={showCodeModeActions}
          canOpenPr={canOpenPr}
          openPrTitle={openPrTitle}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublishVersion}
          onDownloadJson={handleDownloadJson}
          onOpenPr={handleOpenPrClick}
          isViewingPreviousVersion={isViewingPreviousVersion}
          selectedConfigTab={selectedConfigTab}
          onConfigTabChange={setSelectedConfigTab}
        />
      </div>
    </AgentEditFormProvider>
  );
}

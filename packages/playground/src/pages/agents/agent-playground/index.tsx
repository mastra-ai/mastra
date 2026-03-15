import {
  AgentPlaygroundView,
  AgentEditFormProvider,
  SchemaRequestContextProvider,
  useAgent,
  useStoredAgent,
  useAgentCmsForm,
  useAgentVersions,
  useAgentVersion,
  useMemory,
  mapAgentResponseToDataSource,
  Spinner,
  PermissionDenied,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import type { AgentDataSource } from '@mastra/playground-ui';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';

function AgentPlayground() {
  const { agentId } = useParams();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const { data: codeAgent, isLoading: isLoadingCodeAgent, error } = useAgent(agentId!);
  const { data: storedAgent, isLoading: isLoadingStoredAgent } = useStoredAgent(agentId!, { status: 'draft' });
  const { data: memory } = useMemory(agentId!);

  const isCodeAgentOverride = codeAgent?.source === 'code';
  const isLoading = isLoadingCodeAgent || isLoadingStoredAgent;
  const hasMemory = Boolean(memory?.result);

  // Fetch version data when a specific version is selected
  const { data: versionData } = useAgentVersion({
    agentId: agentId ?? '',
    versionId: selectedVersionId ?? '',
  });

  const { data: versionsData } = useAgentVersions({
    agentId: agentId ?? '',
    params: { orderBy: { direction: 'DESC' } },
  });

  const activeVersionId = storedAgent?.activeVersionId;
  const latestVersion = versionsData?.versions?.[0];
  const hasDraft = !!(latestVersion && latestVersion.id !== activeVersionId);

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

  const { form, handlePublish, handleSaveDraft, isSubmitting, isSavingDraft, isDirty } = useAgentCmsForm({
    mode: 'edit',
    agentId: agentId ?? '',
    dataSource,
    isCodeAgentOverride,
    hasStoredOverride: isCodeAgentOverride && !!storedAgent,
    onSuccess: () => {},
  });

  const handleVersionSelect = useCallback(
    (versionId: string) => {
      // If selecting the latest version, clear the selection (back to editable draft)
      if (versionId === latestVersion?.id) {
        setSelectedVersionId(null);
      } else {
        setSelectedVersionId(versionId);
      }
    },
    [latestVersion?.id],
  );

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
    return <div className="text-center py-4">Agent not found</div>;
  }

  return (
    <SchemaRequestContextProvider>
      <AgentEditFormProvider
        form={form}
        mode="edit"
        agentId={agentId}
        isSubmitting={isSubmitting}
        isSavingDraft={isSavingDraft}
        handlePublish={handlePublish}
        handleSaveDraft={handleSaveDraft}
        isCodeAgentOverride={isCodeAgentOverride}
        readOnly={isViewingPreviousVersion}
      >
        <AgentPlaygroundView
          agentId={agentId!}
          agentName={codeAgent?.name}
          modelVersion={codeAgent?.modelVersion}
          hasMemory={hasMemory}
          activeVersionId={activeVersionId}
          selectedVersionId={selectedVersionId ?? undefined}
          latestVersionId={latestVersion?.id}
          requestContextSchema={codeAgent?.requestContextSchema}
          onVersionSelect={handleVersionSelect}
          isDirty={isDirty}
          isSavingDraft={isSavingDraft}
          isPublishing={isSubmitting}
          hasDraft={hasDraft}
          readOnly={isViewingPreviousVersion}
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
        />
      </AgentEditFormProvider>
    </SchemaRequestContextProvider>
  );
}

export default AgentPlayground;

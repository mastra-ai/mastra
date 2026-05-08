import {
  PermissionDenied,
  SessionExpired,
  Spinner,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AgentPlaygroundView } from '@/domains/agents/components/agent-playground/agent-playground-view';
import { AgentEditFormProvider } from '@/domains/agents/context/agent-edit-form-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import { useAgentVersions, useAgentVersion } from '@/domains/agents/hooks/use-agent-versions';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { mapAgentResponseToDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import type { AgentDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import { useMemory } from '@/domains/memory/hooks/use-memory';

function AgentPlayground() {
  const { agentId } = useParams();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const { data: codeAgent, isLoading: isLoadingCodeAgent, error } = useAgent(agentId!);
  const { data: memory } = useMemory(agentId!);

  // Fetch versions first — this endpoint returns an empty array for code-only agents
  const { data: versionsData } = useAgentVersions({
    agentId: agentId ?? '',
    params: { sortDirection: 'DESC' },
  });

  // Only fetch stored agent details when versions exist (avoids 404 for code-only agents)
  const hasVersions = (versionsData?.versions?.length ?? 0) > 0;
  const { data: storedAgent, isLoading: isLoadingStoredAgent } = useStoredAgent(agentId!, {
    status: 'draft',
    enabled: hasVersions,
  });

  const isCodeAgentOverride = codeAgent?.source === 'code';
  const isLoading = isLoadingCodeAgent || (hasVersions && isLoadingStoredAgent);
  const hasMemory = Boolean(memory?.result);

  // Fetch version data when a specific version is selected
  const { data: versionData } = useAgentVersion({
    agentId: agentId ?? '',
    versionId: selectedVersionId ?? '',
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

  const handlePublishVersion = useCallback(async () => {
    if (isViewingPreviousVersion && selectedVersionId) {
      await handlePublish(selectedVersionId);
    } else {
      await handlePublish();
    }
  }, [handlePublish, isViewingPreviousVersion, selectedVersionId]);

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
    return <div className="text-center py-4">Agent not found</div>;
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
      readOnly={isViewingPreviousVersion}
    >
      <AgentPlaygroundView
        agentId={agentId!}
        agentName={codeAgent?.name}
        modelVersion={codeAgent?.modelVersion}
        agentVersionId={selectedVersionId ?? latestVersion?.id}
        hasMemory={hasMemory}
        activeVersionId={activeVersionId}
        selectedVersionId={selectedVersionId ?? undefined}
        latestVersionId={latestVersion?.id}
        onVersionSelect={handleVersionSelect}
        isDirty={isDirty}
        isSavingDraft={isSavingDraft}
        isPublishing={isSubmitting}
        hasDraft={hasDraft}
        readOnly={isViewingPreviousVersion}
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublishVersion}
        isViewingPreviousVersion={isViewingPreviousVersion}
      />
    </AgentEditFormProvider>
  );
}

export default AgentPlayground;

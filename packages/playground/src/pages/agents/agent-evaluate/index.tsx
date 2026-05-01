import {
  PermissionDenied,
  SessionExpired,
  Spinner,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { AgentPlaygroundEvaluate } from '@/domains/agents/components/agent-playground/agent-playground-evaluate';
import { AgentEditFormProvider } from '@/domains/agents/context/agent-edit-form-context';
import { useAgent } from '@/domains/agents/hooks/use-agent';
import { useAgentCmsForm } from '@/domains/agents/hooks/use-agent-cms-form';
import { useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { useStoredAgent } from '@/domains/agents/hooks/use-stored-agents';
import { mapAgentResponseToDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import type { AgentDataSource } from '@/domains/agents/utils/compute-agent-initial-values';
import { useLinkComponent } from '@/lib/framework';

function AgentEvaluate() {
  const { agentId } = useParams();
  const { navigate } = useLinkComponent();

  const { data: codeAgent, isLoading: isLoadingCodeAgent, error } = useAgent(agentId!);

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

  const dataSource = useMemo<AgentDataSource>(() => {
    if (storedAgent) return storedAgent;
    if (codeAgent) return mapAgentResponseToDataSource(codeAgent);
    return {} as AgentDataSource;
  }, [storedAgent, codeAgent]);

  const { form, handlePublish, handleSaveDraft, isSubmitting, isSavingDraft } = useAgentCmsForm({
    mode: 'edit',
    agentId: agentId ?? '',
    dataSource,
    isCodeAgentOverride,
    hasStoredOverride: isCodeAgentOverride && !!storedAgent,
    onSuccess: () => {},
  });

  // Check for pending scorer items from Review tab (via sessionStorage)
  const [pendingScorerItems, setPendingScorerItems] = useState<Array<{ input: unknown; output: unknown }> | null>(
    () => {
      const stored = sessionStorage.getItem(`pending-scorer-items-${agentId}`);
      if (stored) {
        sessionStorage.removeItem(`pending-scorer-items-${agentId}`);
        try {
          return JSON.parse(stored);
        } catch {
          return null;
        }
      }
      return null;
    },
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
      readOnly={false}
    >
      <AgentPlaygroundEvaluate
        agentId={agentId!}
        onSwitchToReview={() => navigate(`/agents/${agentId}/review`)}
        pendingScorerItems={pendingScorerItems}
        onPendingScorerItemsConsumed={() => setPendingScorerItems(null)}
      />
    </AgentEditFormProvider>
  );
}

export default AgentEvaluate;

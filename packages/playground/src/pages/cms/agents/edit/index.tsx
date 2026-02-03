import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import type { AgentVersionResponse } from '@mastra/client-js';

import {
  toast,
  useLinkComponent,
  useStoredAgent,
  useStoredAgentMutations,
  AgentEditMain,
  AgentEditSidebar,
  AgentVersionsPanel,
  AgentLayout,
  useAgentEditForm,
  Header,
  HeaderTitle,
  Icon,
  AgentIcon,
  Spinner,
  useAgentVersion,
  VersionPreviewBanner,
} from '@mastra/playground-ui';

// Type for the agent data (inferred from useStoredAgent)
type StoredAgent = NonNullable<ReturnType<typeof useStoredAgent>['data']>;

// Helper function to convert array to record format expected by form sections
const arrayToRecord = (arr: string[]): Record<string, { description?: string }> => {
  const record: Record<string, { description?: string }> = {};
  for (const id of arr) {
    record[id] = { description: undefined };
  }
  return record;
};

interface CmsAgentsEditFormProps {
  agent: StoredAgent;
  agentId: string;
  selectedVersionId: string | null;
  versionData?: AgentVersionResponse;
  onVersionSelect: (versionId: string) => void;
  onClearVersion: () => void;
}

// Form component - only rendered when agent data is available
function CmsAgentsEditForm({
  agent,
  agentId,
  selectedVersionId,
  versionData,
  onVersionSelect,
  onClearVersion,
}: CmsAgentsEditFormProps) {
  const { navigate, paths } = useLinkComponent();
  const { updateStoredAgent } = useStoredAgentMutations(agentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  const isViewingVersion = !!selectedVersionId && !!versionData;

  // Transform agent data to form initial values
  // Use version data when viewing a version, otherwise use current agent data
  const initialValues = useMemo(() => {
    const dataSource = isViewingVersion ? versionData : agent;

    // Merge code-defined tools and integration tools
    const allTools: string[] = [];
    if (dataSource.tools && Array.isArray(dataSource.tools)) {
      allTools.push(...dataSource.tools);
    }
    if (dataSource.integrationTools && Array.isArray(dataSource.integrationTools)) {
      allTools.push(...dataSource.integrationTools);
    }

    return {
      name: dataSource.name || '',
      description: dataSource.description || '',
      instructions: dataSource.instructions || '',
      model: {
        provider: (dataSource.model as { provider?: string; name?: string })?.provider || '',
        name: (dataSource.model as { provider?: string; name?: string })?.name || '',
      },
      tools: arrayToRecord(allTools),
      workflows: arrayToRecord((dataSource.workflows as string[]) || []),
      agents: arrayToRecord((dataSource.agents as string[]) || []),
      scorers: dataSource.scorers || {},
    };
  }, [agent, versionData, isViewingVersion]);

  const { form } = useAgentEditForm({ initialValues });

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();
    setIsSubmitting(true);

    try {
      // Separate code-defined tools from integration tools
      // Integration tools are identified by checking if they exist in the agent's integrationTools array
      const codeDefinedTools: string[] = [];
      const integrationToolIds: string[] = [];

      const existingIntegrationTools = new Set(agent.integrationTools || []);

      if (values.tools) {
        for (const toolId of Object.keys(values.tools)) {
          if (existingIntegrationTools.has(toolId)) {
            integrationToolIds.push(toolId);
          } else {
            codeDefinedTools.push(toolId);
          }
        }
      }

      await updateStoredAgent.mutateAsync({
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        model: values.model as Record<string, unknown>,
        tools: codeDefinedTools,
        integrationTools: integrationToolIds,
        workflows: Object.keys(values.workflows || {}),
        agents: Object.keys(values.agents || {}),
        scorers: values.scorers,
      });

      toast.success('Agent updated successfully');
      navigate(`${paths.agentLink(agentId)}/chat`);
    } catch (error) {
      toast.error(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, agent, updateStoredAgent, navigate, paths, agentId]);

  return (
    <AgentLayout
      agentId={agentId}
      headerSlot={
        <Header>
          <HeaderTitle>
            <Icon>
              <AgentIcon />
            </Icon>
            Edit agent: {agent.name}
          </HeaderTitle>
        </Header>
      }
      leftSlot={
        <AgentEditSidebar
          form={form}
          currentAgentId={agentId}
          onPublish={handlePublish}
          isSubmitting={isSubmitting}
          formRef={formRef}
          mode="edit"
          readOnly={isViewingVersion}
        />
      }
      rightSlot={
        <AgentVersionsPanel
          agentId={agentId}
          selectedVersionId={selectedVersionId ?? undefined}
          onVersionSelect={onVersionSelect}
        />
      }
    >
      {isViewingVersion && versionData && (
        <VersionPreviewBanner versionNumber={versionData.versionNumber} onClose={onClearVersion} />
      )}
      <form ref={formRef} className="h-full">
        <AgentEditMain form={form} readOnly={isViewingVersion} />
      </form>
    </AgentLayout>
  );
}

// Wrapper component - handles data fetching and loading states
function CmsAgentsEditPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedVersionId = searchParams.get('versionId');

  const { data: agent, isLoading: isLoadingAgent } = useStoredAgent(agentId);
  const { data: versionData, isLoading: isLoadingVersion } = useAgentVersion({
    agentId: agentId ?? '',
    versionId: selectedVersionId ?? '',
  });

  const handleVersionSelect = useCallback(
    (versionId: string) => {
      if (versionId) {
        setSearchParams({ versionId });
      } else {
        setSearchParams({});
      }
    },
    [setSearchParams],
  );

  const handleClearVersion = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  // Loading state
  if (isLoadingAgent || (selectedVersionId && isLoadingVersion)) {
    return (
      <AgentLayout
        agentId="agent-edit"
        headerSlot={
          <Header>
            <HeaderTitle>
              <Icon>
                <AgentIcon />
              </Icon>
              Edit agent
            </HeaderTitle>
          </Header>
        }
        leftSlot={
          <div className="flex items-center justify-center h-full">
            <Spinner className="h-8 w-8" />
          </div>
        }
      >
        <div className="flex items-center justify-center h-full">
          <Spinner className="h-8 w-8" />
        </div>
      </AgentLayout>
    );
  }

  // Agent not found state
  if (!agent || !agentId) {
    return (
      <AgentLayout
        agentId="agent-edit"
        headerSlot={
          <Header>
            <HeaderTitle>
              <Icon>
                <AgentIcon />
              </Icon>
              Edit agent
            </HeaderTitle>
          </Header>
        }
        leftSlot={<div className="flex items-center justify-center h-full text-icon3">Agent not found</div>}
      >
        <div className="flex items-center justify-center h-full text-icon3">Agent not found</div>
      </AgentLayout>
    );
  }

  // Render form only when agent data is available
  return (
    <CmsAgentsEditForm
      agent={agent}
      agentId={agentId}
      selectedVersionId={selectedVersionId}
      versionData={versionData}
      onVersionSelect={handleVersionSelect}
      onClearVersion={handleClearVersion}
    />
  );
}

export { CmsAgentsEditPage };

export default CmsAgentsEditPage;

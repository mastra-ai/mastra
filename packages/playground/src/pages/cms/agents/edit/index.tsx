import { useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';

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
} from '@mastra/playground-ui';

// Type for the agent data (inferred from useStoredAgent)
type StoredAgent = NonNullable<ReturnType<typeof useStoredAgent>['data']>;

interface CmsAgentsEditFormProps {
  agent: StoredAgent;
  agentId: string;
}

// Form component - only rendered when agent data is available
function CmsAgentsEditForm({ agent, agentId }: CmsAgentsEditFormProps) {
  const { navigate, paths } = useLinkComponent();
  const { updateStoredAgent } = useStoredAgentMutations(agentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Transform agent data to form initial values
  const initialValues = useMemo(() => {
    // Merge code-defined tools and integration tools
    const allTools: string[] = [];
    if (agent.tools && Array.isArray(agent.tools)) {
      allTools.push(...agent.tools);
    }
    if (agent.integrationTools && Array.isArray(agent.integrationTools)) {
      allTools.push(...agent.integrationTools);
    }

    return {
      name: agent.name || '',
      description: agent.description || '',
      instructions: agent.instructions || '',
      model: {
        provider: (agent.model as { provider?: string; name?: string })?.provider || '',
        name: (agent.model as { provider?: string; name?: string })?.name || '',
      },
      tools: allTools,
      workflows: agent.workflows || [],
      agents: agent.agents || [],
      scorers: agent.scorers || {},
    };
  }, [agent]);

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
        for (const toolId of values.tools) {
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
        workflows: values.workflows,
        agents: values.agents,
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
        />
      }
      rightSlot={<AgentVersionsPanel agentId={agentId} />}
    >
      <form ref={formRef} className="h-full">
        <AgentEditMain form={form} />
      </form>
    </AgentLayout>
  );
}

// Wrapper component - handles data fetching and loading states
function CmsAgentsEditPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { data: agent, isLoading: isLoadingAgent } = useStoredAgent(agentId);

  // Loading state
  if (isLoadingAgent) {
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
  return <CmsAgentsEditForm agent={agent} agentId={agentId} />;
}

export { CmsAgentsEditPage };

export default CmsAgentsEditPage;

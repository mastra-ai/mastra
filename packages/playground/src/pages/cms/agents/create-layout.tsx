import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router';

import {
  toast,
  useLinkComponent,
  useStoredAgentMutations,
  useAgentEditForm,
  AgentsCmsLayout,
  AgentEditFormProvider,
  Header,
  HeaderTitle,
  Icon,
  AgentIcon,
  MainContentLayout,
  mapInstructionBlocksToApi,
  mapScorersToApi,
  buildObservationalMemoryForApi,
  transformIntegrationToolsForApi,
} from '@mastra/playground-ui';
import type { CreateStoredAgentParams } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';

import { collectMCPClientIds } from './utils';

function CreateLayoutWrapper() {
  const { navigate, paths } = useLinkComponent();
  const { createStoredAgent } = useStoredAgentMutations();
  const client = useMastraClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { form } = useAgentEditForm();
  const location = useLocation();

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();
    setIsSubmitting(true);

    try {
      // Create pending MCP clients in parallel
      const mcpClientIds = await collectMCPClientIds(values.mcpClients ?? [], client);
      const mcpClientsParam = Object.fromEntries(mcpClientIds.map(id => [id, {}]));

      const createParams: CreateStoredAgentParams = {
        name: values.name,
        description: values.description || undefined,
        instructions: mapInstructionBlocksToApi(values.instructionBlocks),
        model: values.model,
        tools: values.tools && Object.keys(values.tools).length > 0 ? values.tools : undefined,
        integrationTools: transformIntegrationToolsForApi(values.integrationTools),
        workflows: values.workflows && Object.keys(values.workflows).length > 0 ? values.workflows : undefined,
        agents: values.agents && Object.keys(values.agents).length > 0 ? values.agents : undefined,
        mcpClients: mcpClientsParam,
        scorers: mapScorersToApi(values.scorers),
        memory: values.memory?.enabled
          ? {
              options: {
                lastMessages: values.memory.lastMessages,
                semanticRecall: values.memory.semanticRecall,
                readOnly: values.memory.readOnly,
              },
              observationalMemory: buildObservationalMemoryForApi(values.memory.observationalMemory),
            }
          : undefined,
        requestContextSchema: values.variables
          ? Object.fromEntries(Object.entries(values.variables))
          : undefined,
      };

      const created = await createStoredAgent.mutateAsync(createParams);
      toast.success('Agent created successfully');
      navigate(`${paths.agentLink(created.id)}/chat`);
    } catch (error) {
      toast.error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, createStoredAgent, client, navigate, paths]);

  const basePath = '/cms/agents/create';

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Create an agent
        </HeaderTitle>
      </Header>
      <AgentEditFormProvider form={form} mode="create" isSubmitting={isSubmitting} handlePublish={handlePublish}>
        <AgentsCmsLayout basePath={basePath} currentPath={location.pathname}>
          <Outlet />
        </AgentsCmsLayout>
      </AgentEditFormProvider>
    </MainContentLayout>
  );
}

export { CreateLayoutWrapper };

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useParams, useSearchParams } from 'react-router';
import type { AgentVersionResponse } from '@mastra/client-js';
import type { AgentInstructionBlock } from '@mastra/core/storage';

import {
  toast,
  useLinkComponent,
  useStoredAgent,
  useStoredAgentMutations,
  useAgentEditForm,
  useAgentVersion,
  AgentsCmsLayout,
  AgentEditFormProvider,
  Header,
  HeaderTitle,
  HeaderAction,
  Icon,
  AgentIcon,
  Spinner,
  MainContentLayout,
  Skeleton,
  Alert,
  Button,
  AlertTitle,
  AgentVersionCombobox,
  createInstructionBlock,
  type AgentFormValues,
} from '@mastra/playground-ui';
import { CreateStoredAgentParams } from '@mastra/client-js';

// Helper function to convert array to record format expected by form sections
const arrayToRecord = (arr: string[]): Record<string, { description?: string }> => {
  const record: Record<string, { description?: string }> = {};
  for (const id of arr) {
    record[id] = { description: undefined };
  }
  return record;
};

// Helper to normalize tools from either string[] (legacy) or Record format
const normalizeToolsToRecord = (
  tools: string[] | Record<string, { description?: string }> | undefined,
): Record<string, { description?: string }> => {
  if (!tools) return {};
  if (Array.isArray(tools)) return arrayToRecord(tools);
  return { ...tools };
};

// Type for the agent data (inferred from useStoredAgent)
type StoredAgent = NonNullable<ReturnType<typeof useStoredAgent>['data']>;

function CreateLayoutWrapper() {
  const { navigate, paths } = useLinkComponent();
  const { createStoredAgent } = useStoredAgentMutations();
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
      const formScorers = values.scorers ? Object.entries(values.scorers) : undefined;
      const scorers = formScorers
        ? Object.fromEntries(
            formScorers.map(([key, value]) => [
              key,
              {
                description: value.description,
                sampling: value.sampling
                  ? {
                      type: value.sampling.type,
                      rate: value.sampling.rate || 0,
                    }
                  : undefined,
              },
            ]),
          )
        : undefined;

      const createParams: CreateStoredAgentParams = {
        name: values.name,
        description: values.description || undefined,
        instructions: (values.instructionBlocks ?? []).map(block => ({
          type: block.type,
          content: block.content,
          rules: block.rules,
        })),
        model: values.model,
        tools: values.tools && Object.keys(values.tools).length > 0 ? values.tools : undefined,
        workflows:
          values.workflows && Object.keys(values.workflows).length > 0 ? Object.keys(values.workflows) : undefined,
        agents: values.agents && Object.keys(values.agents).length > 0 ? Object.keys(values.agents) : undefined,
        scorers,
        memory: values.memory?.enabled
          ? {
              options: {
                lastMessages: values.memory.lastMessages,
                semanticRecall: values.memory.semanticRecall,
                readOnly: values.memory.readOnly,
              },
              observationalMemory: values.memory.observationalMemory?.enabled
                ? (() => {
                    const om = values.memory.observationalMemory;
                    const modelId =
                      om.model?.provider && om.model?.name ? `${om.model.provider}/${om.model.name}` : undefined;

                    const obsModelId =
                      om.observation?.model?.provider && om.observation?.model?.name
                        ? `${om.observation.model.provider}/${om.observation.model.name}`
                        : undefined;
                    const observation =
                      obsModelId ||
                      om.observation?.messageTokens ||
                      om.observation?.maxTokensPerBatch ||
                      om.observation?.bufferTokens !== undefined ||
                      om.observation?.bufferActivation !== undefined ||
                      om.observation?.blockAfter !== undefined
                        ? {
                            model: obsModelId,
                            messageTokens: om.observation?.messageTokens,
                            maxTokensPerBatch: om.observation?.maxTokensPerBatch,
                            bufferTokens: om.observation?.bufferTokens,
                            bufferActivation: om.observation?.bufferActivation,
                            blockAfter: om.observation?.blockAfter,
                          }
                        : undefined;

                    const refModelId =
                      om.reflection?.model?.provider && om.reflection?.model?.name
                        ? `${om.reflection.model.provider}/${om.reflection.model.name}`
                        : undefined;
                    const reflection =
                      refModelId ||
                      om.reflection?.observationTokens ||
                      om.reflection?.blockAfter !== undefined ||
                      om.reflection?.bufferActivation !== undefined
                        ? {
                            model: refModelId,
                            observationTokens: om.reflection?.observationTokens,
                            blockAfter: om.reflection?.blockAfter,
                            bufferActivation: om.reflection?.bufferActivation,
                          }
                        : undefined;

                    return modelId || om.scope || om.shareTokenBudget || observation || reflection
                      ? {
                          model: modelId,
                          scope: om.scope,
                          shareTokenBudget: om.shareTokenBudget,
                          observation,
                          reflection,
                        }
                      : true;
                  })()
                : undefined,
            }
          : undefined,
        requestContextSchema: values.variables as Record<string, unknown> | undefined,
      };

      const created = await createStoredAgent.mutateAsync(createParams);
      toast.success('Agent created successfully');
      navigate(`${paths.agentLink(created.id)}/chat`);
    } catch (error) {
      toast.error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, createStoredAgent, navigate, paths]);

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

function EditFormContent({
  agent,
  agentId,
  selectedVersionId,
  versionData,
  readOnly = false,
}: {
  agent: StoredAgent;
  agentId: string;
  selectedVersionId: string | null;
  versionData?: AgentVersionResponse;
  readOnly?: boolean;
}) {
  const { navigate, paths } = useLinkComponent();
  const { updateStoredAgent } = useStoredAgentMutations(agentId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setSearchParams] = useSearchParams();
  const location = useLocation();

  const isViewingVersion = !!selectedVersionId && !!versionData;

  const initialValues: AgentFormValues = useMemo(() => {
    const dataSource = isViewingVersion ? versionData : agent;

    const toolsRecord = normalizeToolsToRecord(dataSource.tools);
    if (dataSource.integrationTools && Array.isArray(dataSource.integrationTools)) {
      for (const id of dataSource.integrationTools) {
        if (!toolsRecord[id]) {
          toolsRecord[id] = { description: undefined };
        }
      }
    }

    const memoryData = dataSource.memory as
      | {
          vector?: string;
          embedder?: string;
          options?: { lastMessages?: number | false; semanticRecall?: boolean; readOnly?: boolean };
          observationalMemory?:
            | boolean
            | {
                model?: string;
                scope?: 'resource' | 'thread';
                shareTokenBudget?: boolean;
                observation?: {
                  model?: string;
                  messageTokens?: number;
                  maxTokensPerBatch?: number;
                  bufferTokens?: number | false;
                  bufferActivation?: number;
                  blockAfter?: number;
                };
                reflection?: {
                  model?: string;
                  observationTokens?: number;
                  blockAfter?: number;
                  bufferActivation?: number;
                };
              };
        }
      | undefined;

    const instructionsRaw = dataSource.instructions;
    const instructionsString = Array.isArray(instructionsRaw)
      ? instructionsRaw
          .map((b: AgentInstructionBlock) => (b.type === 'prompt_block' ? b.content : ''))
          .filter(Boolean)
          .join('\n\n')
      : instructionsRaw || '';

    const instructionBlocks = Array.isArray(instructionsRaw)
      ? instructionsRaw
          .filter(
            (b: AgentInstructionBlock): b is Extract<AgentInstructionBlock, { type: 'prompt_block' }> =>
              b.type === 'prompt_block',
          )
          .map(b => createInstructionBlock(b.content, b.rules))
      : [createInstructionBlock(instructionsRaw || '')];

    return {
      name: dataSource.name || '',
      description: dataSource.description || '',
      instructions: instructionsString,
      model: {
        provider: (dataSource.model as { provider?: string; name?: string })?.provider || '',
        name: (dataSource.model as { provider?: string; name?: string })?.name || '',
      },
      tools: toolsRecord,
      workflows: arrayToRecord((dataSource.workflows as string[]) || []),
      agents: arrayToRecord((dataSource.agents as string[]) || []),
      scorers: dataSource.scorers || {},
      memory: memoryData?.options
        ? {
            enabled: true,
            lastMessages: memoryData.options.lastMessages,
            semanticRecall: memoryData.options.semanticRecall,
            readOnly: memoryData.options.readOnly,
            vector: memoryData.vector,
            embedder: memoryData.embedder,
            observationalMemory: memoryData.observationalMemory
              ? (() => {
                  const om = typeof memoryData.observationalMemory === 'object' ? memoryData.observationalMemory : {};
                  const splitModel = (id?: string) => {
                    if (!id) return undefined;
                    const [p, ...rest] = id.split('/');
                    const n = rest.join('/');
                    return p && n ? { provider: p, name: n } : undefined;
                  };
                  return {
                    enabled: true as const,
                    model: splitModel(om.model),
                    scope: om.scope,
                    shareTokenBudget: om.shareTokenBudget,
                    observation: om.observation
                      ? {
                          model: splitModel(om.observation.model),
                          messageTokens: om.observation.messageTokens,
                          maxTokensPerBatch: om.observation.maxTokensPerBatch,
                          bufferTokens: om.observation.bufferTokens,
                          bufferActivation: om.observation.bufferActivation,
                          blockAfter: om.observation.blockAfter,
                        }
                      : undefined,
                    reflection: om.reflection
                      ? {
                          model: splitModel(om.reflection.model),
                          observationTokens: om.reflection.observationTokens,
                          blockAfter: om.reflection.blockAfter,
                          bufferActivation: om.reflection.bufferActivation,
                        }
                      : undefined,
                  };
                })()
              : undefined,
          }
        : undefined,
      instructionBlocks,
      variables: dataSource.requestContextSchema as AgentFormValues['variables'],
    };
  }, [agent, versionData, isViewingVersion]);

  const { form } = useAgentEditForm({ initialValues });

  useEffect(() => {
    if (initialValues) {
      form.reset(initialValues);
    }
  }, [initialValues, form]);

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();
    setIsSubmitting(true);

    try {
      const codeDefinedTools: Record<string, { description?: string }> = {};
      const integrationToolIds: string[] = [];
      const existingIntegrationTools = new Set(agent.integrationTools || []);

      if (values.tools) {
        for (const toolId of Object.keys(values.tools)) {
          if (existingIntegrationTools.has(toolId)) {
            integrationToolIds.push(toolId);
          } else {
            codeDefinedTools[toolId] = values.tools[toolId]!;
          }
        }
      }

      await updateStoredAgent.mutateAsync({
        name: values.name,
        description: values.description,
        instructions: (values.instructionBlocks ?? []).map(block => ({
          type: block.type,
          content: block.content,
          rules: block.rules,
        })),
        model: values.model,
        tools: Object.keys(codeDefinedTools).length > 0 ? codeDefinedTools : undefined,
        integrationTools: integrationToolIds,
        workflows: Object.keys(values.workflows || {}),
        agents: Object.keys(values.agents || {}),
        scorers: values.scorers,
        memory: values.memory?.enabled
          ? {
              vector: values.memory.vector,
              embedder: values.memory.embedder,
              options: {
                lastMessages: values.memory.lastMessages,
                semanticRecall: values.memory.semanticRecall,
                readOnly: values.memory.readOnly,
              },
              observationalMemory: values.memory.observationalMemory?.enabled
                ? (() => {
                    const om = values.memory.observationalMemory;
                    const joinModel = (m?: { provider?: string; name?: string }) =>
                      m?.provider && m?.name ? `${m.provider}/${m.name}` : undefined;
                    const modelId = joinModel(om.model);

                    const obsModelId = joinModel(om.observation?.model);
                    const observation =
                      obsModelId ||
                      om.observation?.messageTokens ||
                      om.observation?.maxTokensPerBatch ||
                      om.observation?.bufferTokens !== undefined ||
                      om.observation?.bufferActivation !== undefined ||
                      om.observation?.blockAfter !== undefined
                        ? {
                            model: obsModelId,
                            messageTokens: om.observation?.messageTokens,
                            maxTokensPerBatch: om.observation?.maxTokensPerBatch,
                            bufferTokens: om.observation?.bufferTokens,
                            bufferActivation: om.observation?.bufferActivation,
                            blockAfter: om.observation?.blockAfter,
                          }
                        : undefined;

                    const refModelId = joinModel(om.reflection?.model);
                    const reflection =
                      refModelId ||
                      om.reflection?.observationTokens ||
                      om.reflection?.blockAfter !== undefined ||
                      om.reflection?.bufferActivation !== undefined
                        ? {
                            model: refModelId,
                            observationTokens: om.reflection?.observationTokens,
                            blockAfter: om.reflection?.blockAfter,
                            bufferActivation: om.reflection?.bufferActivation,
                          }
                        : undefined;

                    return modelId || om.scope || om.shareTokenBudget || observation || reflection
                      ? {
                          model: modelId,
                          scope: om.scope,
                          shareTokenBudget: om.shareTokenBudget,
                          observation,
                          reflection,
                        }
                      : true;
                  })()
                : undefined,
            }
          : undefined,
        requestContextSchema: values.variables as Record<string, unknown> | undefined,
      });

      toast.success('Agent updated successfully');
      navigate(`${paths.agentLink(agentId)}/chat`);
    } catch (error) {
      toast.error(`Failed to update agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, agent, updateStoredAgent, navigate, paths, agentId]);

  const basePath = `/cms/agents/${agentId}/edit`;

  return (
    <AgentEditFormProvider
      form={form}
      mode="edit"
      agentId={agentId}
      isSubmitting={isSubmitting}
      handlePublish={handlePublish}
      readOnly={readOnly || isViewingVersion}
    >
      <AgentsCmsLayout basePath={basePath} currentPath={location.pathname}>
        {isViewingVersion && (
          <Alert variant="info" className="mb-4 mx-4">
            <AlertTitle>You are seeing a specific version of the agent.</AlertTitle>
            <div className="pt-2">
              <Button type="button" variant="light" onClick={() => setSearchParams({})}>
                View latest version
              </Button>
            </div>
          </Alert>
        )}
        <Outlet />
      </AgentsCmsLayout>
    </AgentEditFormProvider>
  );
}

function EditLayoutWrapper() {
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

  if (isLoadingAgent) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <AgentIcon />
            </Icon>
            <Skeleton className="h-6 w-[200px]" />
          </HeaderTitle>
        </Header>
        <div className="flex items-center justify-center h-full">
          <Spinner className="h-8 w-8" />
        </div>
      </MainContentLayout>
    );
  }

  if (!agent || !agentId) {
    return (
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <AgentIcon />
            </Icon>
            Agent not found
          </HeaderTitle>
        </Header>
        <div className="flex items-center justify-center h-full text-icon3">Agent not found</div>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Edit agent: {agent.name}
        </HeaderTitle>
        <HeaderAction>
          <AgentVersionCombobox
            agentId={agentId}
            value={selectedVersionId ?? ''}
            onValueChange={handleVersionSelect}
            variant="outline"
          />
        </HeaderAction>
      </Header>

      <EditFormContent
        agent={agent}
        agentId={agentId}
        selectedVersionId={selectedVersionId}
        versionData={versionData}
        readOnly={isLoadingVersion}
      />
    </MainContentLayout>
  );
}

export { CreateLayoutWrapper, EditLayoutWrapper };

import { useRef } from 'react';

import type { CreateStoredAgentParams } from '@mastra/client-js';

import { toast } from '@/lib/toast';

import { AgentEditLayout } from './agent-edit-page/agent-edit-layout';
import { AgentEditSidebar } from './agent-edit-page/agent-edit-sidebar';
import { AgentEditMainContentBlocks } from './agent-edit-page/agent-edit-main-blocks';
import { useAgentEditForm } from './agent-edit-page/use-agent-edit-form';
import { useStoredAgentMutations } from '../hooks/use-stored-agents';

interface AgentCreateContentProps {
  onSuccess?: (agent: { id: string; description?: string }) => void;
  hideSubAgentCreate?: boolean;
}

export function AgentCreateContent({ onSuccess, hideSubAgentCreate }: AgentCreateContentProps) {
  const { createStoredAgent } = useStoredAgentMutations();
  const formRef = useRef<HTMLFormElement | null>(null);
  const { form } = useAgentEditForm();

  const handlePublish = async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();

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
                rules: value.rules,
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
        workflows: values.workflows && Object.keys(values.workflows).length > 0 ? values.workflows : undefined,
        agents: values.agents && Object.keys(values.agents).length > 0 ? values.agents : undefined,
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
      onSuccess?.(created);
    } catch (error) {
      toast.error(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <AgentEditLayout
      leftSlot={
        <AgentEditSidebar
          form={form}
          onPublish={handlePublish}
          isSubmitting={createStoredAgent.isPending}
          formRef={formRef}
          hideSubAgentCreate={hideSubAgentCreate}
        />
      }
    >
      <form ref={formRef} className="h-full">
        <AgentEditMainContentBlocks form={form} />
      </form>
    </AgentEditLayout>
  );
}

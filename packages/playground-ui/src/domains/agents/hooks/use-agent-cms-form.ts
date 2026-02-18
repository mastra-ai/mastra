import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useMastraClient } from '@mastra/react';
import type { CreateStoredAgentParams } from '@mastra/client-js';

import { toast } from '@/lib/toast';

import { useAgentEditForm } from '../components/agent-edit-page/use-agent-edit-form';
import { useStoredAgentMutations } from './use-stored-agents';
import { collectMCPClientIds } from '../utils/collect-mcp-client-ids';
import { computeAgentInitialValues, type AgentDataSource } from '../utils/compute-agent-initial-values';
import {
  mapInstructionBlocksToApi,
  mapScorersToApi,
  buildObservationalMemoryForApi,
  transformIntegrationToolsForApi,
} from '../utils/agent-form-mappers';

type CreateOptions = {
  mode: 'create';
  onSuccess: (agentId: string) => void;
};

type EditOptions = {
  mode: 'edit';
  agentId: string;
  dataSource: AgentDataSource;
  onSuccess: (agentId: string) => void;
};

export type UseAgentCmsFormOptions = CreateOptions | EditOptions;

export function useAgentCmsForm(options: UseAgentCmsFormOptions) {
  const client = useMastraClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = options.mode === 'edit';
  const agentId = isEdit ? options.agentId : undefined;

  const { createStoredAgent } = useStoredAgentMutations();
  const { updateStoredAgent } = useStoredAgentMutations(agentId);

  const initialValues = useMemo(
    () => (isEdit ? computeAgentInitialValues(options.dataSource) : undefined),
    [isEdit, isEdit ? options.dataSource : undefined],
  );

  const { form } = useAgentEditForm({ initialValues });

  // Edit mode: reset form + resolve MCP client IDs when data source changes
  // Wrapped in useEffectEvent to avoid form/client/initialValues in the dependency array,
  // which caused infinite re-renders (form.reset -> form ref changes -> effect reruns).
  const resetFormWithData = useEffectEvent(() => {
    if (!initialValues || options.mode !== 'edit') return;

    form.reset(initialValues);

    const mcpClientRecord = options.dataSource.mcpClients as Record<string, unknown> | undefined;
    const ids = Object.keys(mcpClientRecord ?? {});
    if (ids.length === 0) return;

    Promise.all(ids.map(id => client.getStoredMCPClient(id).details()))
      .then(results => {
        form.setValue(
          'mcpClients',
          results.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            servers: r.servers,
          })),
        );
      })
      .catch(() => {
        // Silently ignore — clients may have been deleted
      });
  });

  useEffect(() => {
    if (!isEdit) return;
    resetFormWithData();
  }, [isEdit, isEdit ? options.dataSource : undefined]);

  const handlePublish = useCallback(async () => {
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const values = form.getValues();
    setIsSubmitting(true);

    try {
      // Edit mode: delete MCP clients marked for removal
      if (isEdit) {
        const mcpClientsToDelete = values.mcpClientsToDelete ?? [];
        await Promise.all(mcpClientsToDelete.map(id => client.getStoredMCPClient(id).delete()));
      }

      // Create pending MCP clients in parallel and collect IDs
      const mcpClientIds = await collectMCPClientIds(values.mcpClients ?? [], client);
      const mcpClientsParam = Object.fromEntries(mcpClientIds.map(id => [id, {}]));

      const sharedParams = {
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
        requestContextSchema: values.variables ? Object.fromEntries(Object.entries(values.variables)) : undefined,
      };

      const memoryBase = values.memory?.enabled
        ? {
            options: {
              lastMessages: values.memory.lastMessages,
              semanticRecall: values.memory.semanticRecall,
              readOnly: values.memory.readOnly,
            },
            observationalMemory: buildObservationalMemoryForApi(values.memory.observationalMemory),
          }
        : undefined;

      if (isEdit) {
        const editMemory = memoryBase
          ? {
              ...memoryBase,
              vector: values.memory?.vector,
              embedder: values.memory?.embedder,
            }
          : undefined;

        await updateStoredAgent.mutateAsync({
          ...sharedParams,
          memory: editMemory,
        });
        toast.success('Agent updated successfully');
        options.onSuccess(options.agentId);
      } else {
        const createParams: CreateStoredAgentParams = {
          ...sharedParams,
          memory: memoryBase,
        };

        const created = await createStoredAgent.mutateAsync(createParams);
        toast.success('Agent created successfully');
        options.onSuccess(created.id);
      }
    } catch (error) {
      const action = isEdit ? 'update' : 'create';
      toast.error(`Failed to ${action} agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, isEdit, client, createStoredAgent, updateStoredAgent, options]);

  const watched = useWatch({ control: form.control });

  const canPublish = useMemo(() => {
    const identityDone = !!watched.name && !!watched.model?.provider && !!watched.model?.name;
    const instructionsDone = (watched.instructionBlocks ?? []).some(b => b.content?.trim());
    return identityDone && instructionsDone;
  }, [watched.name, watched.model?.provider, watched.model?.name, watched.instructionBlocks]);

  return { form, handlePublish, isSubmitting, canPublish };
}

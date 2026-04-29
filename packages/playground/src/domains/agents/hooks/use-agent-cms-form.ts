import type { CreateStoredAgentParams } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { useAgentEditForm } from '../components/agent-edit-page/use-agent-edit-form';
import type { AgentFormValues, EntityConfig } from '../components/agent-edit-page/utils/form-validation';
import {
  mapInstructionBlocksToApi,
  mapScorersToApi,
  buildObservationalMemoryForApi,
  transformIntegrationToolsForApi,
} from '../utils/agent-form-mappers';
import { collectMCPClientIds } from '../utils/collect-mcp-client-ids';
import { computeAgentInitialValues } from '../utils/compute-agent-initial-values';
import type { AgentDataSource } from '../utils/compute-agent-initial-values';
import { useStoredAgentMutations } from './use-stored-agents';

type CreateOptions = {
  mode: 'create';
  onSuccess: (agentId: string) => void;
};

type EditOptions = {
  mode: 'edit';
  agentId: string;
  dataSource: AgentDataSource;
  /** True when editing a code-defined agent — only instructions, tools, and variables are editable */
  isCodeAgentOverride?: boolean;
  /** True when a stored override record already exists for this code agent */
  hasStoredOverride?: boolean;
  onSuccess: (agentId: string) => void;
};

export type UseAgentCmsFormOptions = CreateOptions | EditOptions;

export function useAgentCmsForm(options: UseAgentCmsFormOptions) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const isEdit = options.mode === 'edit';
  const agentId = isEdit ? options.agentId : undefined;
  const isCodeAgentOverride = isEdit && !!options.isCodeAgentOverride;
  const hasStoredOverride = isEdit && !!options.hasStoredOverride;

  // Track whether we've already created a stored override for a code agent in this session
  const [overrideCreated, setOverrideCreated] = useState(false);
  const needsCreate = isCodeAgentOverride && !hasStoredOverride && !overrideCreated;

  const { createStoredAgent } = useStoredAgentMutations();
  const { updateStoredAgent } = useStoredAgentMutations(agentId);

  const initialValues = useMemo(
    () => (isEdit ? computeAgentInitialValues(options.dataSource) : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEdit, isEdit ? options.dataSource : undefined],
  );

  const { form } = useAgentEditForm({ initialValues, isCodeAgentOverride });

  // Edit mode: reset form + resolve MCP client IDs when data source changes
  // Wrapped in useEffectEvent to avoid form/client/initialValues in the dependency array,
  // which caused infinite re-renders (form.reset -> form ref changes -> effect reruns).
  const resetFormWithData = useEffectEvent(() => {
    if (!initialValues || options.mode !== 'edit') return;

    form.reset(initialValues);

    const mcpClientRecord = options.dataSource.mcpClients as
      | Record<string, { tools?: Record<string, { description?: string }> }>
      | undefined;
    const ids = Object.keys(mcpClientRecord ?? {});
    if (ids.length === 0) return;

    Promise.all(ids.map(id => client.getStoredMCPClient(id).details()))
      .then(results => {
        const mcpClientValues = results.map(r => ({
          id: r.id,
          name: r.name,
          description: r.description,
          servers: r.servers,
          selectedTools: mcpClientRecord?.[r.id]?.tools ?? {},
        }));
        form.setValue('mcpClients', mcpClientValues, { shouldDirty: true });

        // Sync MCP tools into form.tools
        const currentTools = form.getValues('tools') ?? {};
        const next = { ...currentTools };
        for (const mcpClient of mcpClientValues) {
          for (const [name, config] of Object.entries(mcpClient.selectedTools ?? {})) {
            next[name] = { description: config.description };
          }
        }
        form.setValue('tools', next, { shouldDirty: true });
      })
      .catch(() => {
        // Silently ignore — clients may have been deleted
      });
  });

  useEffect(() => {
    if (!isEdit) return;
    resetFormWithData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, isEdit ? options.dataSource : undefined]);

  const buildSharedParams = useCallback(
    async (values: AgentFormValues) => {
      // Code agent overrides: only send fields that are editable (instructions, tools, variables)
      if (isCodeAgentOverride) {
        // Collect all MCP tool names
        const mcpToolNames = new Set<string>();
        for (const c of values.mcpClients ?? []) {
          for (const name of Object.keys(c.selectedTools ?? {})) {
            mcpToolNames.add(name);
          }
        }

        // Registry tools = form.tools minus MCP tools
        const registryTools: Record<string, EntityConfig> = {};
        for (const [name, config] of Object.entries(values.tools ?? {})) {
          if (!mcpToolNames.has(name)) {
            registryTools[name] = config;
          }
        }

        // Create pending MCP clients in parallel and collect IDs
        const mcpClientIds = await collectMCPClientIds(values.mcpClients ?? [], client);
        const mcpClientsParam = Object.fromEntries(
          mcpClientIds.map((id, index) => {
            const selectedTools = values.mcpClients?.[index]?.selectedTools ?? {};
            return [id, { tools: selectedTools }];
          }),
        );

        return {
          // name and model are required by the create schema — pass the code agent's values through.
          // applyStoredOverrides will NOT apply these fields for code agent overrides.
          name: values.name,
          model: values.model,
          // Only send editable fields: instructions, tools, integrationTools, and variables (requestContextSchema)
          instructions: mapInstructionBlocksToApi(values.instructionBlocks),
          tools: Object.keys(registryTools).length > 0 ? registryTools : {},
          integrationTools: transformIntegrationToolsForApi(values.integrationTools),
          mcpClients: mcpClientsParam,
          requestContextSchema: values.variables ? Object.fromEntries(Object.entries(values.variables)) : undefined,
        };
      }

      // Edit mode: delete MCP clients marked for removal
      if (isEdit) {
        const mcpClientsToDelete = values.mcpClientsToDelete ?? [];
        await Promise.all(mcpClientsToDelete.map(id => client.getStoredMCPClient(id).delete()));
      }

      // Collect all MCP tool names
      const mcpToolNames = new Set<string>();
      for (const c of values.mcpClients ?? []) {
        for (const name of Object.keys(c.selectedTools ?? {})) {
          mcpToolNames.add(name);
        }
      }

      // Registry tools = form.tools minus MCP tools
      const registryTools: Record<string, EntityConfig> = {};
      for (const [name, config] of Object.entries(values.tools ?? {})) {
        if (!mcpToolNames.has(name)) {
          registryTools[name] = config;
        }
      }

      // Create pending MCP clients in parallel and collect IDs
      const mcpClientIds = await collectMCPClientIds(values.mcpClients ?? [], client);
      const mcpClientsParam = Object.fromEntries(
        mcpClientIds.map((id, index) => {
          const selectedTools = values.mcpClients?.[index]?.selectedTools ?? {};
          return [id, { tools: selectedTools }];
        }),
      );

      return {
        name: values.name,
        description: values.description || undefined,
        instructions: mapInstructionBlocksToApi(values.instructionBlocks),
        model: values.model,
        tools: Object.keys(registryTools).length > 0 ? registryTools : {},
        integrationTools: transformIntegrationToolsForApi(values.integrationTools),
        workflows: values.workflows && Object.keys(values.workflows).length > 0 ? values.workflows : undefined,
        agents: values.agents && Object.keys(values.agents).length > 0 ? values.agents : undefined,
        mcpClients: mcpClientsParam,
        scorers: mapScorersToApi(values.scorers),
        skills: values.skills,
        workspace: values.workspace,
        requestContextSchema: values.variables ? Object.fromEntries(Object.entries(values.variables)) : undefined,
      };
    },
    [isEdit, isCodeAgentOverride, client],
  );

  const buildMemoryParams = useCallback((values: AgentFormValues) => {
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

    if (!memoryBase) return undefined;

    return {
      ...memoryBase,
      vector: values.memory?.vector,
      embedder: values.memory?.embedder,
    };
  }, []);

  const handleSaveDraft = useCallback(
    async (changeMessage?: string) => {
      if (!isEdit) return;

      const isValid = await form.trigger();
      if (!isValid) {
        toast.error('Please fill in all required fields');
        return;
      }

      const values = form.getValues();
      setIsSavingDraft(true);

      try {
        const sharedParams = await buildSharedParams(values);
        const editMemory = isCodeAgentOverride ? undefined : buildMemoryParams(values);

        if (needsCreate) {
          // First save for a code agent — create the stored override
          const createParams: CreateStoredAgentParams = {
            id: options.agentId,
            ...sharedParams,
            memory: editMemory,
          };
          await createStoredAgent.mutateAsync(createParams);
          setOverrideCreated(true);
        } else {
          await updateStoredAgent.mutateAsync({
            ...sharedParams,
            memory: editMemory,
            ...(changeMessage ? { changeMessage } : {}),
          });
        }

        // Reset form dirty state so publish can detect unsaved changes
        form.reset(values);
        void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
        void queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
        void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
        toast.success('Draft saved');
      } catch (error) {
        toast.error(`Failed to save draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsSavingDraft(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      form,
      isEdit,
      agentId,
      needsCreate,
      options,
      buildSharedParams,
      buildMemoryParams,
      createStoredAgent,
      updateStoredAgent,
      queryClient,
    ],
  );

  const handlePublish = useCallback(
    async (publishVersionId?: string) => {
      // When publishing a specific older version, skip form validation since the form is read-only
      if (!publishVersionId) {
        const isValid = await form.trigger();
        if (!isValid) {
          toast.error('Please fill in all required fields');
          return;
        }
      }

      const values = form.getValues();
      setIsSubmitting(true);

      try {
        if (isEdit) {
          if (publishVersionId) {
            // Publishing a specific version (e.g. an older read-only version)
            await client.getStoredAgent(options.agentId).activateVersion(publishVersionId);
          } else if (needsCreate) {
            // First publish for a code agent — create and immediately publish
            const sharedParams = await buildSharedParams(values);
            const editMemory = isCodeAgentOverride ? undefined : buildMemoryParams(values);
            const createParams: CreateStoredAgentParams = {
              id: options.agentId,
              ...sharedParams,
              memory: editMemory,
            };
            await createStoredAgent.mutateAsync(createParams);
            setOverrideCreated(true);

            // Now activate the first version
            const versionsResponse = await client
              .getStoredAgent(options.agentId)
              .listVersions({ sortDirection: 'DESC', perPage: 1 });
            const latestVersion = versionsResponse.versions[0];
            if (latestVersion) {
              await client.getStoredAgent(options.agentId).activateVersion(latestVersion.id);
            }
          } else {
            // Check if there's an unpublished draft version to activate
            const [agentDetails, versionsResponse] = await Promise.all([
              client.getStoredAgent(options.agentId).details(),
              client.getStoredAgent(options.agentId).listVersions({ sortDirection: 'DESC', perPage: 1 }),
            ]);

            const latestVersion = versionsResponse.versions[0];
            if (!latestVersion || latestVersion.id === agentDetails.activeVersionId) {
              toast.error('No draft changes to publish. Save a draft first.');
              return;
            }

            await client.getStoredAgent(options.agentId).activateVersion(latestVersion.id);
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] }),
            queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] }),
            queryClient.invalidateQueries({ queryKey: ['agent', agentId] }),
            queryClient.invalidateQueries({ queryKey: ['agents'] }),
            queryClient.invalidateQueries({ queryKey: ['stored-agents'] }),
          ]);
          toast.success('Agent published');
          options.onSuccess(options.agentId);
        } else {
          const sharedParams = await buildSharedParams(values);
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

          const createParams: CreateStoredAgentParams = {
            ...sharedParams,
            memory: memoryBase,
          };

          const created = await createStoredAgent.mutateAsync(createParams);
          toast.success('Agent created successfully');
          options.onSuccess(created.id);
        }
      } catch (error) {
        const action = isEdit ? 'publish' : 'create';
        toast.error(`Failed to ${action} agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsSubmitting(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      form,
      isEdit,
      needsCreate,
      client,
      createStoredAgent,
      options,
      agentId,
      buildSharedParams,
      buildMemoryParams,
      queryClient,
    ],
  );

  const watched = useWatch({ control: form.control });

  const canPublish = useMemo(() => {
    if (isCodeAgentOverride) {
      // Code agent overrides only need instructions to be filled
      const instructionsDone = (watched.instructionBlocks ?? []).some(
        b =>
          b.type === 'prompt_block_ref' ||
          (b.type === 'prompt_block' && typeof b.content === 'string' && b.content.trim()),
      );
      return instructionsDone;
    }
    const identityDone = !!watched.name && !!watched.model?.provider && !!watched.model?.name;
    const instructionsDone = (watched.instructionBlocks ?? []).some(
      b =>
        b.type === 'prompt_block_ref' ||
        (b.type === 'prompt_block' && typeof b.content === 'string' && b.content.trim()),
    );
    return identityDone && instructionsDone;
  }, [isCodeAgentOverride, watched.name, watched.model?.provider, watched.model?.name, watched.instructionBlocks]);

  const isDirty = form.formState.isDirty;

  return { form, handlePublish, handleSaveDraft, isSubmitting, isSavingDraft, canPublish, isDirty };
}

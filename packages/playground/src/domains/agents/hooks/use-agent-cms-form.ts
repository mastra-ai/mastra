import type { CreateStoredAgentParams } from '@mastra/client-js';
import type { AgentEditorConfig } from '@mastra/core/agent';
import { toast } from '@mastra/playground-ui/utils/toast';
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
import {
  EMPTY_RUNTIME_INSTRUCTIONS_MESSAGE,
  instructionsResolveEmptyDueToDrafts,
} from '../utils/instruction-blocks-runtime';
import { useStoredAgentMutations } from './use-stored-agents';
import { useStoredPromptBlocks } from '@/domains/prompt-blocks';
import { usePlaygroundStore } from '@/store/playground-store';

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
  /** Editor config from the code agent definition — controls which fields are owned by the user vs code */
  editorConfig?: AgentEditorConfig;
  saveSuccessMessage?: string;
  onSuccess: (agentId: string) => void;
};

export type UseAgentCmsFormOptions = CreateOptions | EditOptions;

export function useAgentCmsForm(options: UseAgentCmsFormOptions) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const isEdit = options.mode === 'edit';
  const agentId = isEdit ? options.agentId : undefined;
  const isCodeAgentOverride = isEdit && !!options.isCodeAgentOverride;
  const hasStoredOverride = isEdit && !!options.hasStoredOverride;
  const editorConfig = isEdit ? options.editorConfig : undefined;

  // Derive which fields are owned by the user (vs by code). These flags MUST mirror the server's
  // getCodeAgentOwnership (packages/server/src/server/handlers/stored-agents.ts): on save the server
  // strips any field a code agent doesn't own. If the client and server disagree, Studio either sends
  // data the server silently drops (looks saved, reloads blank) or hides edits the server would keep.
  // Server semantics for instructions:
  //   editor === false           → not owned (locked)
  //   editor unset (undefined)   → owned — legacy default: an editor-unset code agent is fully editable
  //   editor === true            → not owned (a bare boolean is not an object, so `.instructions` is unset)
  //   editor.instructions === true → owned
  // Server semantics for tools mirror this:
  //   editor unset (undefined)   → owned (membership + descriptions)
  //   editor.tools === true      → owned (membership + descriptions)
  //   editor.tools === { description: true } → owns tool descriptions only
  // The missing `undefined` case was the bug (for both instructions and tools): the old
  // `=== true`-only checks made an editor-unset code agent send an empty instructions array and
  // drop tool edits on save, wiping changes the server would have kept.
  const ownsInstructions =
    !isCodeAgentOverride ||
    editorConfig === undefined ||
    (editorConfig !== false && editorConfig?.instructions === true);
  const ownsTools =
    !isCodeAgentOverride || editorConfig === undefined || (editorConfig !== false && editorConfig?.tools === true);
  const ownsToolDescriptions =
    !isCodeAgentOverride ||
    editorConfig === undefined ||
    (editorConfig !== false &&
      (editorConfig?.tools === true ||
        (typeof editorConfig?.tools === 'object' && editorConfig.tools.description === true)));

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

  // Prompt block publication status, used to guard against saving an agent whose
  // instructions would resolve to an empty prompt at runtime because every
  // referenced block is unpublished. The list returns blocks of every status,
  // each carrying `activeVersionId` (present only when published).
  const { data: promptBlocksData } = useStoredPromptBlocks();

  // Resolve the published state of each referenced prompt block. The loaded list
  // is a fast-path cache; any id missing from it — the list is still loading, or
  // the block lives on another page — is fetched on demand so the guard never
  // silently treats a not-yet-loaded draft as published (which would let
  // draft-only instructions slip through right after the form mounts). Lookups
  // that genuinely can't be resolved (e.g. the block was deleted) fall back to
  // "published" so the guard never blocks a save it cannot prove would resolve empty.
  const resolvePublishedStatus = useCallback(
    async (promptBlockIds: string[]): Promise<Map<string, boolean>> => {
      const statuses = new Map<string, boolean>();
      await Promise.all(
        promptBlockIds.map(async id => {
          const match = promptBlocksData?.promptBlocks.find(b => b.id === id);
          if (match) {
            statuses.set(id, Boolean(match.activeVersionId));
            return;
          }
          try {
            const details = await client.getStoredPromptBlock(id).details(requestContext);
            statuses.set(id, Boolean(details?.activeVersionId));
          } catch {
            statuses.set(id, true);
          }
        }),
      );
      return statuses;
    },
    [promptBlocksData?.promptBlocks, client, requestContext],
  );

  // Returns true and surfaces an error toast when the current instruction blocks
  // would resolve to an empty prompt at runtime due to unpublished refs.
  const blocksWouldResolveEmpty = useCallback(
    async (values: AgentFormValues): Promise<boolean> => {
      // Only relevant when the user actually owns/edits instructions.
      if (isCodeAgentOverride && !ownsInstructions) return false;

      const refIds: string[] = [];
      for (const block of values.instructionBlocks ?? []) {
        if (block.type === 'prompt_block_ref') {
          const id = block.promptBlockId?.trim();
          if (id) refIds.push(id);
        }
      }
      if (refIds.length === 0) return false;

      const statuses = await resolvePublishedStatus(refIds);
      if (instructionsResolveEmptyDueToDrafts(values.instructionBlocks, id => statuses.get(id) ?? true)) {
        toast.error(EMPTY_RUNTIME_INSTRUCTIONS_MESSAGE);
        return true;
      }
      return false;
    },
    [isCodeAgentOverride, ownsInstructions, resolvePublishedStatus],
  );

  // Edit mode: reset form + resolve MCP client IDs when data source changes
  // Wrapped in useEffectEvent to avoid form/client/initialValues in the dependency array,
  // which caused infinite re-renders (form.reset -> form ref changes -> effect reruns).
  const resetFormWithData = useEffectEvent(() => {
    if (!initialValues || options.mode !== 'edit') return;

    form.reset(initialValues);

    const mcpClientRecord = options.dataSource.mcpClients as
      Record<string, { tools?: Record<string, { description?: string }> }> | undefined;
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
        form.setValue('mcpClients', mcpClientValues, { shouldDirty: false });

        // Sync MCP tools into form.tools
        const currentTools = form.getValues('tools') ?? {};
        const next = { ...currentTools };
        for (const mcpClient of mcpClientValues) {
          for (const [name, config] of Object.entries(mcpClient.selectedTools ?? {})) {
            next[name] = { description: config.description };
          }
        }
        form.setValue('tools', next, { shouldDirty: false });
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

        // Only send fields the user actually owns. The server will also strip
        // unowned fields as a defense-in-depth measure, but doing it here too
        // avoids sending empty/stale payloads on every save.
        return {
          // name and model are required by the create schema — pass the code agent's values through.
          // applyStoredOverrides will NOT apply these fields for code agent overrides.
          name: values.name,
          model: values.model,
          // Variables (requestContextSchema) are always editable for code agents.
          requestContextSchema: values.variables ? Object.fromEntries(Object.entries(values.variables)) : undefined,
          // Instructions: when the user owns them, send the edited blocks.
          // When they don't, still send an empty array (CREATE schema requires it),
          // the server drops it for unowned fields based on editorConfig.
          instructions: ownsInstructions ? mapInstructionBlocksToApi(values.instructionBlocks) : [],
          // Tools: send when the user owns membership OR descriptions.
          // Server enforces what gets persisted (and rejects membership changes
          // in descriptions-only mode).
          ...(ownsTools || ownsToolDescriptions
            ? {
                tools: Object.keys(registryTools).length > 0 ? registryTools : {},
                integrationTools: transformIntegrationToolsForApi(values.integrationTools),
                mcpClients: mcpClientsParam,
              }
            : {}),
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
    [isEdit, isCodeAgentOverride, ownsInstructions, ownsTools, ownsToolDescriptions, client],
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

      // Block saving an agent that would run with an empty prompt because all of
      // its instruction blocks reference unpublished prompt blocks.
      if (await blocksWouldResolveEmpty(values)) return;

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

        // Reset form dirty state so publish can detect unsaved changes.
        // Pass keepDefaultValues so currently rendered field state (e.g. open tabs,
        // focused inputs) is preserved — only the dirty flag is cleared.
        form.reset(values, { keepValues: true });
        // For code-mode overrides we intentionally skip stored-agent / agent query
        // invalidation: the dataSource reload would cascade through the
        // resetFormWithData effect and remount the System Prompt tab, which
        // is jarring. The filesystem write is authoritative for code mode and
        // the in-memory form already reflects the saved state.
        if (!isCodeAgentOverride) {
          void queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
          void queryClient.invalidateQueries({ queryKey: ['stored-agent', agentId] });
          void queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
        }
        toast.success(
          options.mode === 'edit' && options.saveSuccessMessage ? options.saveSuccessMessage : 'Draft saved',
        );
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
      blocksWouldResolveEmpty,
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

      // Block publishing an agent that would run with an empty prompt because all
      // of its instruction blocks reference unpublished prompt blocks.
      // Skipped when activating a specific existing version (form is read-only).
      if (!publishVersionId && (await blocksWouldResolveEmpty(values))) return;

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
              .listVersions({ orderBy: { field: 'createdAt', direction: 'DESC' }, perPage: 1 });
            const latestVersion = versionsResponse.versions[0];
            if (latestVersion) {
              await client.getStoredAgent(options.agentId).activateVersion(latestVersion.id);
            }
          } else {
            // Check if there's an unpublished draft version to activate
            const [agentDetails, versionsResponse] = await Promise.all([
              client.getStoredAgent(options.agentId).details(),
              client
                .getStoredAgent(options.agentId)
                .listVersions({ orderBy: { field: 'createdAt', direction: 'DESC' }, perPage: 1 }),
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
      blocksWouldResolveEmpty,
    ],
  );

  const getAgentExport = useCallback(async () => {
    if (!isEdit) return;

    const isValid = await form.trigger();
    if (!isValid) {
      toast.error('Please fill in all required fields');
      return;
    }

    const sharedParams = await buildSharedParams(form.getValues());
    return client.getStoredAgent(options.agentId).export(sharedParams);
  }, [buildSharedParams, client, form, isEdit, options]);

  const handleDownloadJson = useCallback(async () => {
    try {
      const response = await getAgentExport();
      if (!response) return;

      const blob = new Blob([response.content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Agent JSON downloaded');
    } catch (error) {
      toast.error(`Failed to download JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [getAgentExport]);

  const handleOpenPr = useCallback(
    async ({ platformApiEndpoint, projectId }: { platformApiEndpoint: string; projectId: string }) => {
      if (!isEdit) return;

      try {
        const response = await getAgentExport();
        if (!response) return;

        const apiEndpoint = platformApiEndpoint.replace(/\/$/, '');
        const prResponse = await fetch(`${apiEndpoint}/v1/server/projects/${projectId}/agent-overrides/pr`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: response.agentId,
            fileName: response.fileName,
            content: response.content,
          }),
        });

        if (!prResponse.ok) {
          const message = await prResponse.text();
          throw new Error(message || `Request failed with ${prResponse.status}`);
        }

        const result = (await prResponse.json()) as { url: string };
        window.open(result.url, '_blank', 'noopener,noreferrer');
        toast.success('Pull request opened');
      } catch (error) {
        toast.error(`Failed to open PR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    },
    [getAgentExport, isEdit],
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

  return {
    form,
    handlePublish,
    handleSaveDraft,
    handleDownloadJson,
    handleOpenPr,
    isSubmitting,
    isSavingDraft,
    canPublish,
    isDirty,
  };
}

import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { workflowDefinitionsQueryKey } from './use-workflow-definitions';

// Types - these will come from client SDK eventually
export interface CreateWorkflowDefinitionParams {
  id: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
  stepGraph: unknown[];
  steps: Record<string, unknown>;
  retryConfig?: { attempts?: number; delay?: number };
  metadata?: Record<string, unknown>;
}

export interface UpdateWorkflowDefinitionParams {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
  stepGraph?: unknown[];
  steps?: Record<string, unknown>;
  retryConfig?: { attempts?: number; delay?: number };
  metadata?: Record<string, unknown>;
}

export function useWorkflowDefinitionMutations() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const createWorkflowDefinition = useMutation({
    mutationFn: async (params: CreateWorkflowDefinitionParams) => {
      return client.createWorkflowDefinition(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowDefinitionsQueryKey });
    },
  });

  const updateWorkflowDefinition = useMutation({
    mutationFn: async ({ id, ...params }: UpdateWorkflowDefinitionParams & { id: string }) => {
      const definition = client.getWorkflowDefinition(id);
      return definition.update(params);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: workflowDefinitionsQueryKey });
      queryClient.invalidateQueries({
        queryKey: [...workflowDefinitionsQueryKey, variables.id],
      });
    },
  });

  const deleteWorkflowDefinition = useMutation({
    mutationFn: async (id: string) => {
      const definition = client.getWorkflowDefinition(id);
      return definition.delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workflowDefinitionsQueryKey });
    },
  });

  return {
    createWorkflowDefinition,
    updateWorkflowDefinition,
    deleteWorkflowDefinition,
  };
}

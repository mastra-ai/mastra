'use client';

import { useMemo } from 'react';
import { useForm, Resolver } from 'react-hook-form';

import { useAgents } from '../../hooks/use-agents';
import { useTools } from '@/domains/tools/hooks/use-all-tools';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useMemoryConfig } from '@/domains/memory/hooks';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import type { AgentFormValues } from '../create-agent/form-validation';

const agentFormResolver: Resolver<AgentFormValues> = async values => {
  const errors: Record<string, { type: string; message: string }> = {};

  if (!values.name || values.name.trim() === '') {
    errors.name = { type: 'required', message: 'Name is required' };
  } else if (values.name.length > 100) {
    errors.name = { type: 'maxLength', message: 'Name must be 100 characters or less' };
  }

  if (values.description && values.description.length > 500) {
    errors.description = { type: 'maxLength', message: 'Description must be 500 characters or less' };
  }

  if (!values.instructions || values.instructions.trim() === '') {
    errors.instructions = { type: 'required', message: 'Instructions are required' };
  }

  if (!values.model?.provider || values.model.provider.trim() === '') {
    errors['model.provider'] = { type: 'required', message: 'Provider is required' };
  }

  if (!values.model?.name || values.model.name.trim() === '') {
    errors['model.name'] = { type: 'required', message: 'Model is required' };
  }

  return {
    values: Object.keys(errors).length === 0 ? values : {},
    errors: Object.keys(errors).length > 0 ? errors : {},
  };
};

export interface UseAgentCreateFormOptions {
  agentId?: string;
  initialValues?: Partial<AgentFormValues>;
}

export function useAgentCreateForm(options: UseAgentCreateFormOptions = {}) {
  const { agentId, initialValues } = options;

  // Data fetching
  const { data: tools, isLoading: toolsLoading } = useTools();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: memoryConfigsData, isLoading: memoryConfigsLoading } = useMemoryConfig();
  const { data: scorers, isLoading: scorersLoading } = useScorers();

  // Form setup
  const form = useForm<AgentFormValues>({
    resolver: agentFormResolver,
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      instructions: initialValues?.instructions ?? '',
      model: initialValues?.model ?? { provider: '', name: '' },
      tools: initialValues?.tools ?? [],
      workflows: initialValues?.workflows ?? [],
      agents: initialValues?.agents ?? [],
      memory: initialValues?.memory ?? '',
      scorers: initialValues?.scorers ?? {},
    },
  });

  // Filter out current agent from sub-agents picker
  const availableAgents = useMemo(() => {
    if (!agents) return [];
    const agentList = Array.isArray(agents)
      ? agents
      : Object.entries(agents).map(([id, agent]) => ({
          id,
          name: (agent as { name?: string }).name || id,
        }));
    return agentList.filter(agent => agent.id !== agentId);
  }, [agents, agentId]);

  // Transform tools data
  const toolOptions = useMemo(() => {
    if (!tools) return [];
    return Object.entries(tools).map(([id, tool]) => ({
      id,
      name: (tool as { name?: string }).name || id,
      description: (tool as { description?: string }).description || '',
    }));
  }, [tools]);

  // Transform workflows data
  const workflowOptions = useMemo(() => {
    if (!workflows) return [];
    return Object.entries(workflows).map(([id, workflow]) => ({
      id,
      name: (workflow as { name?: string }).name || id,
      description: (workflow as { description?: string }).description || '',
    }));
  }, [workflows]);

  // Transform agents data for sub-agents picker
  const agentOptions = useMemo(() => {
    return availableAgents.map(agent => ({
      id: agent.id,
      name: agent.name || agent.id,
      description: '',
    }));
  }, [availableAgents]);

  // Memory options - currently empty as memory config needs different handling
  const memoryOptions = useMemo(() => {
    return [] as { id: string; name: string; description: string }[];
  }, [memoryConfigsData]);

  // Transform scorers data
  const scorerOptions = useMemo(() => {
    if (!scorers) return [];
    return Object.entries(scorers).map(([id, scorer]) => ({
      id,
      name: (scorer as { scorer?: { config?: { name?: string } } }).scorer?.config?.name || id,
      description: (scorer as { scorer?: { config?: { description?: string } } }).scorer?.config?.description || '',
    }));
  }, [scorers]);

  const isLoading = toolsLoading || workflowsLoading || agentsLoading || memoryConfigsLoading || scorersLoading;

  return {
    form,
    isLoading,
    toolOptions,
    workflowOptions,
    agentOptions,
    memoryOptions,
    scorerOptions,
    toolsLoading,
    workflowsLoading,
    agentsLoading,
    memoryConfigsLoading,
    scorersLoading,
  };
}

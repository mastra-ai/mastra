import type { CreateStoredAgentParams } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';

import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { useLinkComponent } from '@/lib/framework';

export interface AgentBuilderFormValues {
  name: string;
  description?: string;
  instructions: string;
  model: {
    provider: string;
    name: string;
  };
  // Capability sections (optional, only included if section is visible)
  tools?: Record<string, { description?: string }>;
  memory?: {
    enabled: boolean;
    lastMessages?: number;
    semanticRecall?: boolean;
  };
  skills?: Record<string, { description?: string }>;
  workflows?: Record<string, { description?: string }>;
  agents?: Record<string, { description?: string }>;
}

export interface VisibleSections {
  tools: boolean;
  memory: boolean;
  skills: boolean;
  workflows: boolean;
  agents: boolean;
}

// Simple validation resolver
function createAgentBuilderResolver(): Resolver<AgentBuilderFormValues> {
  return async values => {
    const errors: Record<string, { type: string; message: string }> = {};

    if (!values.name || values.name.trim() === '') {
      errors.name = { type: 'required', message: 'Name is required' };
    } else if (values.name.length > 100) {
      errors.name = { type: 'maxLength', message: 'Name must be 100 characters or less' };
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
}

export function useAgentBuilderForm(visibleSections: VisibleSections) {
  const navigate = useNavigate();
  const { paths } = useLinkComponent();
  const { data: user } = useCurrentUser();
  const { createStoredAgent } = useStoredAgentMutations();

  const form = useForm<AgentBuilderFormValues>({
    resolver: createAgentBuilderResolver(),
    defaultValues: {
      name: '',
      description: '',
      instructions: '',
      model: { provider: '', name: '' },
      tools: {},
      memory: { enabled: false, lastMessages: 40, semanticRecall: false },
      skills: {},
      workflows: {},
      agents: {},
    },
  });

  const onSubmit = async (values: AgentBuilderFormValues) => {
    // Build payload with only visible sections
    const payload: CreateStoredAgentParams = {
      name: values.name,
      description: values.description || undefined,
      instructions: values.instructions,
      model: values.model,
      authorId: user?.id,
    };

    // Include visible sections if they have values
    if (visibleSections.tools && values.tools && Object.keys(values.tools).length > 0) {
      payload.tools = values.tools;
    }
    if (visibleSections.memory && values.memory?.enabled) {
      payload.memory = {
        options: {
          lastMessages: values.memory.lastMessages,
          semanticRecall: values.memory.semanticRecall,
        },
      };
    }
    if (visibleSections.skills && values.skills && Object.keys(values.skills).length > 0) {
      payload.skills = values.skills;
    }
    if (visibleSections.workflows && values.workflows && Object.keys(values.workflows).length > 0) {
      payload.workflows = values.workflows;
    }
    if (visibleSections.agents && values.agents && Object.keys(values.agents).length > 0) {
      payload.agents = values.agents;
    }

    // Hidden sections with admin defaults handled server-side (memory only for now)

    try {
      const result = await createStoredAgent.mutateAsync(payload);
      toast.success('Agent created successfully');
      void navigate(paths.agentLink(result.id));
    } catch (error) {
      toast.error('Failed to create agent');
      throw error;
    }
  };

  return {
    form,
    onSubmit: form.handleSubmit(onSubmit),
    isSubmitting: createStoredAgent.isPending,
    error: createStoredAgent.error,
  };
}

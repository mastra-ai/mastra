import { useForm, Resolver } from 'react-hook-form';

import { AgentFormValues, createInstructionBlock } from './utils/form-validation';

// Simple validation resolver without zod to avoid version conflicts
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

  // Validate instructions: check blocks if present, otherwise check plain instructions string
  const blocks = values.instructionBlocks;
  const hasBlockContent =
    blocks && blocks.some(b => b.type === 'prompt_block_ref' || (b.type === 'prompt_block' && b.content.trim() !== ''));
  const hasPlainInstructions = values.instructions && values.instructions.trim() !== '';

  if (!hasBlockContent && !hasPlainInstructions) {
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

export interface UseAgentEditFormOptions {
  initialValues?: Partial<AgentFormValues>;
}

export function useAgentEditForm(options: UseAgentEditFormOptions = {}) {
  const { initialValues } = options;

  const form = useForm<AgentFormValues>({
    resolver: agentFormResolver,
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      instructions: initialValues?.instructions ?? '',
      model: initialValues?.model ?? { provider: '', name: '' },
      tools: initialValues?.tools ?? {},
      integrationTools: initialValues?.integrationTools ?? {},
      workflows: initialValues?.workflows ?? {},
      agents: initialValues?.agents ?? {},
      scorers: initialValues?.scorers ?? {},
      variables: initialValues?.variables ?? {},
      instructionBlocks: initialValues?.instructionBlocks ?? [createInstructionBlock()],
      mcpClients: initialValues?.mcpClients ?? [],
      mcpClientsToDelete: [],
      skills: initialValues?.skills ?? {},
    },
  });

  return { form };
}

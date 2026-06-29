import type { AgentFormValues } from '../components/agent-edit-page/utils/form-validation';

export const hasAgentInstructions = (values: Pick<AgentFormValues, 'instructionBlocks' | 'instructions'>) => {
  const hasInstructionBlock = (values.instructionBlocks ?? []).some(block => {
    if (block.type === 'prompt_block_ref') {
      return block.promptBlockId.trim().length > 0;
    }

    return block.content.trim().length > 0;
  });

  return hasInstructionBlock || !!values.instructions?.trim();
};

export const getAgentCmsErrorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

export const isInstructionsRequiredError = (error: unknown) =>
  getAgentCmsErrorMessage(error).includes('Instructions are required');

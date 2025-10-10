import { AgentInstructions } from '@mastra/core/agent';

const resolveInstructionPart = (part: any) => {
  if (typeof part === 'string') {
    return part.trim();
  }
  return part.text?.trim() || '';
};

export const extractPrompt = (instructions?: AgentInstructions): string => {
  if (typeof instructions === 'string') {
    return instructions.trim();
  }

  if (typeof instructions === 'object' && 'content' in instructions) {
    if (Array.isArray(instructions.content)) {
      return instructions.content.map(resolveInstructionPart).join('\n\n').trim();
    }

    return instructions.content.trim();
  }

  if (Array.isArray(instructions)) {
    return instructions.map(extractPrompt).join('\n\n').trim();
  }

  return '';
};

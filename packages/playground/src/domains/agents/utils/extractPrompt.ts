import type { AgentInstructions } from '@mastra/core/agent';

const resolveInstructionPart = (part: unknown) => {
  if (typeof part === 'string') {
    return part;
  }
  if (typeof part !== 'object' || part === null) return '';
  if ('text' in part && typeof part.text === 'string') {
    return part.text;
  }
  return '';
};

export const extractPrompt = (instructions?: AgentInstructions): string => {
  if (typeof instructions === 'string') {
    return instructions;
  }

  if (typeof instructions === 'object' && 'content' in instructions) {
    if (Array.isArray(instructions.content)) {
      return instructions.content.map(resolveInstructionPart).join('\n\n');
    }

    return instructions.content;
  }

  if (Array.isArray(instructions)) {
    return instructions.map(extractPrompt).join('\n\n');
  }

  return '';
};

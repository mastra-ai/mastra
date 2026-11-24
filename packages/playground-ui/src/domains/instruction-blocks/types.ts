import { v4 as uuid } from '@lukeed/uuid';

import type { RuleGroup } from '@/utils/rule-engine';

export type InlineInstructionBlock = {
  id: string;
  type: 'prompt_block';
  content: string;
  rules?: RuleGroup;
};

export type RefInstructionBlock = {
  id: string;
  type: 'prompt_block_ref';
  promptBlockId: string;
  rules?: RuleGroup;
};

export type InstructionBlock = InlineInstructionBlock | RefInstructionBlock;

export const createInstructionBlock = (content = '', rules?: RuleGroup): InlineInstructionBlock => ({
  id: uuid(),
  type: 'prompt_block',
  content,
  rules,
});

export const createRefInstructionBlock = (promptBlockId: string, rules?: RuleGroup): RefInstructionBlock => ({
  id: uuid(),
  type: 'prompt_block_ref',
  promptBlockId,
  rules,
});

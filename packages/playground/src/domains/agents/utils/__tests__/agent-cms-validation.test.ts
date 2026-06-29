import { describe, expect, it } from 'vitest';

import { hasAgentInstructions, isInstructionsRequiredError } from '../agent-cms-validation';

describe('hasAgentInstructions', () => {
  it('returns false when the form has no usable instruction content', () => {
    expect(
      hasAgentInstructions({
        instructions: '   ',
        instructionBlocks: [
          { id: 'inline-empty', type: 'prompt_block', content: '   ' },
          { id: 'ref-empty', type: 'prompt_block_ref', promptBlockId: '   ' },
        ],
      }),
    ).toBe(false);
  });

  it('returns true for inline instruction content', () => {
    expect(
      hasAgentInstructions({
        instructions: '',
        instructionBlocks: [{ id: 'inline', type: 'prompt_block', content: 'You are a chef.' }],
      }),
    ).toBe(true);
  });

  it('returns true for a referenced prompt block', () => {
    expect(
      hasAgentInstructions({
        instructions: '',
        instructionBlocks: [{ id: 'ref', type: 'prompt_block_ref', promptBlockId: 'prompt-block-1' }],
      }),
    ).toBe(true);
  });
});

describe('isInstructionsRequiredError', () => {
  it('detects API errors for missing instructions', () => {
    expect(
      isInstructionsRequiredError(new Error('HTTP error! status: 400 - {"error":"Instructions are required"}')),
    ).toBe(true);
  });
});

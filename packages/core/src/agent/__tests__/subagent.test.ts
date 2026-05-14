import { describe, expect, it } from 'vitest';

import { isAgentCompatible } from '../subagent';

const compatibleSubAgent = {
  id: 'subagent',
  generate: async () => ({}),
  stream: async () => ({}),
  getDescription: () => 'Sub-agent',
  getModel: () => ({}),
  hasOwnMemory: () => false,
  __setMemory: () => undefined,
  getMemory: () => undefined,
  getInstructions: () => '',
  resumeGenerate: async () => undefined,
  resumeStream: async () => undefined,
};

describe('isAgentCompatible', () => {
  it('requires a non-empty string id', () => {
    expect(isAgentCompatible(compatibleSubAgent)).toBe(true);
    expect(isAgentCompatible({ ...compatibleSubAgent, id: undefined })).toBe(false);
    expect(isAgentCompatible({ ...compatibleSubAgent, id: '' })).toBe(false);
  });
});

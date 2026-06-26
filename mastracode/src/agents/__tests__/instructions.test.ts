import { describe, expect, it, vi } from 'vitest';

vi.mock('../../tools/index.js', () => ({
  hasTavilyKey: () => false,
}));

vi.mock('../../utils/project.js', () => ({
  getCurrentGitBranchAsync: vi.fn(async () => 'feature/from-git'),
}));

vi.mock('../../utils/binaries.js', () => ({
  detectCommonBinariesAsync: vi.fn(async () => []),
}));

vi.mock('../prompts/agent-instructions.js', () => ({
  loadAgentInstructions: vi.fn(() => []),
  formatAgentInstructions: vi.fn(() => ''),
}));

import { getDynamicInstructions } from '../instructions.js';

describe('getDynamicInstructions', () => {
  it('builds commit attribution guidance from restored harness model state', async () => {
    const prompt = await getDynamicInstructions({
      requestContext: {
        get: vi.fn(key => {
          const getState = vi.fn(() => ({
            projectPath: '/tmp/project',
            projectName: 'test-project',
            gitBranch: 'main',
            permissionRules: { tools: {} },
          }));
          return key === 'harness'
            ? {
                getState,
                session: {
                  modeId: 'build',
                  modelId: 'anthropic/claude-opus-4-6',
                  state: {
                    get: getState,
                  },
                },
              }
            : undefined;
        }),
      },
    });

    expect(prompt).toContain('Git branch: feature/from-git');
    expect(prompt).toContain(
      'Include `Co-Authored-By: Mastra Code (anthropic/claude-opus-4-6) <noreply@mastra.ai>` in the message body.',
    );
  });
});

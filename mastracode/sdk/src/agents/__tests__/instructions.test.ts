import { describe, expect, it, vi } from 'vitest';

vi.mock('../../tools/index.js', () => ({
  hasParallelKey: () => false,
  hasTavilyKey: () => false,
}));

vi.mock('../../utils/project.js', () => ({
  getCurrentGitBranchAsync: vi.fn(async () => 'feature/from-git'),
}));

vi.mock('../../utils/binaries.js', () => ({
  detectCommonBinariesAsync: vi.fn(async () => []),
}));

vi.mock('../../onboarding/settings.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../onboarding/settings.js')>()),
  loadSettings: () => ({}),
}));

vi.mock('../prompts/agent-instructions.js', () => ({
  loadAgentInstructions: vi.fn(() => []),
  formatAgentInstructions: vi.fn(() => ''),
}));

import { getDynamicInstructions } from '../instructions.js';

describe('getDynamicInstructions', () => {
  it('builds commit attribution guidance from restored controller model state', async () => {
    const prompt = await getDynamicInstructions({
      requestContext: {
        get: vi.fn(key => {
          const getState = vi.fn(() => ({
            projectPath: '/tmp/project',
            projectName: 'test-project',
            gitBranch: 'main',
            permissionRules: { tools: {} },
          }));
          return key === 'controller'
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

  it('never leaks the host cwd, branch, or instruction files into a session without a project', async () => {
    const { getCurrentGitBranchAsync } = await import('../../utils/project.js');
    const { loadAgentInstructions } = await import('../prompts/agent-instructions.js');
    vi.mocked(getCurrentGitBranchAsync).mockClear();
    vi.mocked(loadAgentInstructions).mockClear();

    const prompt = await getDynamicInstructions({
      requestContext: {
        get: vi.fn(key => {
          const getState = vi.fn(() => ({
            // Hosted chat-only session: no project identity at all.
            projectPath: '',
            projectName: '',
            gitBranch: '',
            permissionRules: { tools: {} },
          }));
          return key === 'controller'
            ? { getState, session: { modeId: 'build', state: { get: getState } } }
            : undefined;
        }),
      },
    });

    expect(prompt).toContain('Working directory: (no workspace attached)');
    expect(prompt).toContain('Not a git repository');
    expect(prompt).not.toContain(process.cwd());
    // No host probes: git never ran, no instruction files were read (project
    // locations would resolve against the server cwd, globals against the
    // server homedir).
    expect(getCurrentGitBranchAsync).not.toHaveBeenCalled();
    expect(loadAgentInstructions).not.toHaveBeenCalled();
  });

  it('appends active plugin instructions to the base prompt', async () => {
    const prompt = await getDynamicInstructions({
      requestContext: {
        get: vi.fn(key => {
          const getState = vi.fn(() => ({
            projectPath: '/tmp/project',
            projectName: 'test-project',
            gitBranch: 'main',
            pluginInstructions: ['Use the Alexandria reader policy.', 'Prefer plugin-provided workflows.'],
          }));
          return key === 'controller'
            ? {
                getState,
                session: {
                  modeId: 'build',
                  modelId: 'openai/gpt-5.5',
                  state: { get: getState },
                },
              }
            : undefined;
        }),
      },
    });

    expect(prompt).toContain('# Plugin Instructions');
    expect(prompt).toContain(
      'must not override higher-priority system, developer, repository, safety, or tool-use instructions',
    );
    expect(prompt).toContain(
      '<plugin-instructions index="1">\nUse the Alexandria reader policy.\n</plugin-instructions>',
    );
    expect(prompt).toContain(
      '<plugin-instructions index="2">\nPrefer plugin-provided workflows.\n</plugin-instructions>',
    );
  });
});

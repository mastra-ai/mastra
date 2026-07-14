import { describe, expect, it, vi } from 'vitest';

// Keep prompt tests independent from optional web-search package artifacts.
vi.mock('../../tools/index.js', () => ({
  hasTavilyKey: () => false,
}));

import { buildFullPrompt } from './index.js';

describe('buildFullPrompt task state', () => {
  // The task list is carried on the agent state-signal lane (TaskStateProcessor),
  // not injected into the cached system prompt. Keeping it out of the prompt
  // prefix preserves prompt caching across task updates.
  it('does not inject the task list into the system prompt', () => {
    const promptWithTasks = buildFullPrompt({
      projectPath: '/tmp/project',
      projectName: 'test-project',
      gitBranch: 'main',
      platform: 'darwin',
      date: '2026-03-23',
      mode: 'build',
      activePlan: null,
      modeId: 'build',
      currentDate: '2026-03-23',
      workingDir: '/tmp/project',
      state: {
        permissionRules: { tools: {} },
        tasks: [{ id: 'tests', content: 'Write tests', status: 'pending', activeForm: 'Writing tests' }],
      },
    });

    expect(promptWithTasks).not.toContain('<current-task-list>');
    expect(promptWithTasks).not.toContain('{id: tests}');
  });

  it('produces a stable system-prompt prefix regardless of task state', () => {
    const baseCtx = {
      projectPath: '/tmp/project',
      projectName: 'test-project',
      gitBranch: 'main',
      platform: 'darwin' as const,
      date: '2026-03-23',
      mode: 'build',
      activePlan: null,
      modeId: 'build',
      currentDate: '2026-03-23',
      workingDir: '/tmp/project',
    };

    const promptNoTasks = buildFullPrompt({ ...baseCtx, state: { permissionRules: { tools: {} } } });
    const promptWithTasks = buildFullPrompt({
      ...baseCtx,
      state: {
        permissionRules: { tools: {} },
        tasks: [{ id: 'tests', content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' }],
      },
    });

    // Task updates must not change the system prompt (prompt-cache stability).
    expect(promptWithTasks).toEqual(promptNoTasks);
  });
});

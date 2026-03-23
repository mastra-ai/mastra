import { describe, expect, it } from 'vitest';
import { buildFullPrompt } from '../prompts/index.js';

describe('buildFullPrompt', () => {
  it('includes model-specific prompt content for gpt-5.4', () => {
    const prompt = buildFullPrompt({
      projectPath: '/tmp/project',
      projectName: 'test-project',
      gitBranch: 'main',
      platform: 'darwin',
      date: '2026-03-23',
      mode: 'build',
      modelId: 'openai/gpt-5.4',
      activePlan: null,
      modeId: 'build',
      currentDate: '2026-03-23',
      workingDir: '/tmp/project',
      state: {
        currentModelId: 'openai/gpt-5.4',
        permissionRules: { tools: {} },
      },
    });

    expect(prompt).toContain('<autonomy_and_persistence>');
    expect(prompt).toContain(
      'Persist until the task is fully handled end-to-end within the current turn whenever feasible',
    );
  });

  it('does not include model-specific prompt content for other models', () => {
    const prompt = buildFullPrompt({
      projectPath: '/tmp/project',
      projectName: 'test-project',
      gitBranch: 'main',
      platform: 'darwin',
      date: '2026-03-23',
      mode: 'build',
      modelId: 'anthropic/claude-opus-4-6',
      activePlan: null,
      modeId: 'build',
      currentDate: '2026-03-23',
      workingDir: '/tmp/project',
      state: {
        currentModelId: 'anthropic/claude-opus-4-6',
        permissionRules: { tools: {} },
      },
    });

    expect(prompt).not.toContain('<autonomy_and_persistence>');
  });
});

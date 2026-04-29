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

  it('includes model-specific prompt content for gpt-5.5', () => {
    const prompt = buildFullPrompt({
      projectPath: '/tmp/project',
      projectName: 'test-project',
      gitBranch: 'main',
      platform: 'darwin',
      date: '2026-03-23',
      mode: 'build',
      modelId: 'openai/gpt-5.5',
      activePlan: null,
      modeId: 'build',
      currentDate: '2026-03-23',
      workingDir: '/tmp/project',
      state: {
        currentModelId: 'openai/gpt-5.5',
        permissionRules: { tools: {} },
      },
    });

    expect(prompt).toContain('<coding_behavior>');
    expect(prompt).toContain('Work outcome-first');
    expect(prompt).toContain('without sacrificing correctness, maintainability, or proof');
    expect(prompt).toContain('meaningful decisions, findings, or results');
    expect(prompt).toContain('Read enough code, docs, logs, and command output to act correctly');
    expect(prompt).toContain('positive contribution');
    expect(prompt).not.toContain('<autonomy_and_persistence>');
    expect(prompt).not.toContain('<gpt_5_5_coding_behavior>');
    expect(prompt).not.toContain('Use common-sense autonomy');
    expect(prompt).not.toContain('do not narrate routine tool use');
    expect(prompt).not.toContain('Prefer editing existing code');
    expect(prompt).not.toContain('Write terminal-friendly answers');
    expect(prompt).not.toContain('shortest correct path');
    expect(prompt).not.toContain('Prefer decisive progress over long plans');
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
    expect(prompt).not.toContain('<coding_behavior>');
  });

  it('includes common binary availability in environment details', () => {
    const prompt = buildFullPrompt({
      projectPath: '/tmp/project',
      projectName: 'test-project',
      gitBranch: 'main',
      platform: 'darwin',
      commonBinaries: [
        { name: 'python', path: null },
        { name: 'python3', path: '/usr/bin/python3' },
      ],
      date: '2026-03-23',
      mode: 'build',
      activePlan: null,
      modeId: 'build',
      currentDate: '2026-03-23',
      workingDir: '/tmp/project',
      state: {
        permissionRules: { tools: {} },
      },
    });

    expect(prompt).toContain('Common binaries: python: not found, python3: /usr/bin/python3');
  });
});

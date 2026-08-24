import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GlobalSettings } from '../../onboarding/settings.js';

async function buildPromptWithLspSetting(lsp: GlobalSettings['lsp']) {
  vi.resetModules();
  // Keep prompt tests independent from optional web-search package artifacts.
  vi.doMock('../../tools/index.js', () => ({ hasTavilyKey: () => false }));
  const settings = await vi.importActual<typeof import('../../onboarding/settings.js')>('../../onboarding/settings.js');
  vi.doMock('../../onboarding/settings.js', () => ({
    ...settings,
    loadSettings: () => ({ ...settings.loadSettings(), lsp }),
  }));

  const { buildFullPrompt } = await import('../prompts/index.js');
  return buildFullPrompt({
    projectPath: '/tmp/project',
    projectName: 'test-project',
    gitBranch: 'main',
    platform: 'darwin',
    date: '2026-03-23',
    mode: 'build',
    modelId: 'anthropic/claude-sonnet-4-5',
    activePlan: null,
    modeId: 'build',
    currentDate: '2026-03-23',
    workingDir: '/tmp/project',
    state: { permissionRules: { tools: {} } },
  });
}

afterEach(() => {
  vi.doUnmock('../../onboarding/settings.js');
  vi.doUnmock('../../tools/index.js');
  vi.resetModules();
});

describe('lsp_inspect tool guidance', () => {
  it('is omitted when LSP is disabled', async () => {
    expect(await buildPromptWithLspSetting(false)).not.toContain('lsp_inspect');
  });

  it('is omitted when LSP is unset', async () => {
    expect(await buildPromptWithLspSetting(undefined)).not.toContain('lsp_inspect');
  });

  it('is included once the user opts in', async () => {
    expect(await buildPromptWithLspSetting(true)).toContain('lsp_inspect');
  });
});

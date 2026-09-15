import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GlobalSettings } from '../../onboarding/settings.js';

function createRequestContext(projectPath: string) {
  const requestContext = new RequestContext();
  const getState = () => ({
    projectPath,
    sandboxAllowedPaths: [],
  });
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: { state: { get: getState } },
  });
  return requestContext;
}

async function buildWorkspaceWithLspSetting(lsp: GlobalSettings['lsp'], tempDir: string) {
  vi.resetModules();
  const settings = await vi.importActual<typeof import('../../onboarding/settings.js')>('../../onboarding/settings.js');
  vi.doMock('../../onboarding/settings.js', () => ({
    ...settings,
    loadSettings: () => ({ ...settings.loadSettings(), lsp }),
  }));

  const { getDynamicWorkspace } = await import('../workspace.js');
  return getDynamicWorkspace({ requestContext: createRequestContext(tempDir) as any });
}

afterEach(() => {
  vi.doUnmock('../../onboarding/settings.js');
  vi.resetModules();
});

describe('mastracode workspace LSP opt-in', () => {
  it('does not configure LSP when the setting is absent', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-lsp-off-'));
    try {
      const workspace = await buildWorkspaceWithLspSetting(undefined, tempDir);

      expect(workspace.lsp).toBeUndefined();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not configure LSP when the user opts out explicitly', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-lsp-false-'));
    try {
      const workspace = await buildWorkspaceWithLspSetting(false, tempDir);

      expect(workspace.lsp).toBeUndefined();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('configures LSP when the user opts in with `true`', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-lsp-true-'));
    try {
      const workspace = await buildWorkspaceWithLspSetting(true, tempDir);

      expect(workspace.lsp).toBeDefined();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('configures LSP when the user opts in with a config object', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-lsp-config-'));
    try {
      const workspace = await buildWorkspaceWithLspSetting({ maxOpenClients: 2 }, tempDir);

      expect(workspace.lsp).toBeDefined();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('omits lsp_inspect from the agent toolset when LSP is disabled', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-lsp-tools-'));
    try {
      const { createWorkspaceTools } = await import('@mastra/core/workspace');

      const disabled = await buildWorkspaceWithLspSetting(false, tempDir);
      expect(Object.keys(await createWorkspaceTools(disabled))).not.toContain('lsp_inspect');

      const enabled = await buildWorkspaceWithLspSetting(true, tempDir);
      expect(Object.keys(await createWorkspaceTools(enabled))).toContain('lsp_inspect');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

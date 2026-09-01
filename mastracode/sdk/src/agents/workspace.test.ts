import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

const settingsMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../onboarding/settings.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../onboarding/settings.js')>()),
  loadSettings: () => settingsMock.value,
}));

function createRequestContext(projectPath: string, workspaceRoot?: string) {
  const requestContext = new RequestContext();
  const getState = () => ({
    projectPath,
    ...(workspaceRoot ? { workspaceRoot } : {}),
    sandboxAllowedPaths: [],
  });
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: {
      state: {
        get: getState,
      },
    },
  });
  return requestContext;
}

afterEach(() => {
  settingsMock.value = {};
  vi.resetModules();
});

describe('mastracode workspace LSP configuration', () => {
  it('limits retained language server clients to four by default once LSP is enabled', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-lsp-'));
    settingsMock.value = { lsp: true };
    let workspace: { destroy(): Promise<void>; lsp?: object } | undefined;

    try {
      const { getDynamicWorkspace } = await import('./workspace.js');
      workspace = await getDynamicWorkspace({ requestContext: createRequestContext(tempDir) as any });

      expect(Reflect.get(workspace.lsp!, 'config')).toMatchObject({ maxOpenClients: 4 });
    } finally {
      try {
        await workspace?.destroy();
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('allows user settings to override the default client limit', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-lsp-'));
    settingsMock.value = { lsp: { maxOpenClients: 2 } };
    let workspace: { destroy(): Promise<void>; lsp?: object } | undefined;

    try {
      const { getDynamicWorkspace } = await import('./workspace.js');
      workspace = await getDynamicWorkspace({ requestContext: createRequestContext(tempDir) as any });

      expect(Reflect.get(workspace.lsp!, 'config')).toMatchObject({ maxOpenClients: 2 });
    } finally {
      try {
        await workspace?.destroy();
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  });
});

describe('mastracode workspace root split', () => {
  it('defaults the file-tool and exec root to the project path (coupled behavior)', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-root-'));
    let workspace: { destroy(): Promise<void>; filesystem: any; sandbox: any } | undefined;
    try {
      const { getDynamicWorkspace } = await import('./workspace.js');
      workspace = await getDynamicWorkspace({ requestContext: createRequestContext(tempDir) as any });
      expect(workspace.filesystem.basePath).toBe(tempDir);
      expect(workspace.sandbox.workingDirectory).toBe(tempDir);
    } finally {
      try {
        await workspace?.destroy();
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  });

  it('roots file tools and exec at a distinct workspaceRoot while the workspace stays project-identified', async () => {
    const parentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-parent-'));
    const projectDir = path.join(parentDir, 'repo');
    await fs.mkdir(projectDir);
    let workspace: { destroy(): Promise<void>; id: string; filesystem: any; sandbox: any } | undefined;
    try {
      const { getDynamicWorkspace } = await import('./workspace.js');
      workspace = await getDynamicWorkspace({
        requestContext: createRequestContext(projectDir, parentDir) as any,
      });
      expect(workspace.filesystem.basePath).toBe(parentDir);
      expect(workspace.sandbox.workingDirectory).toBe(parentDir);
      // The workspace identity stays project-scoped.
      expect(workspace.id).toContain(projectDir);
    } finally {
      try {
        await workspace?.destroy();
      } finally {
        await fs.rm(parentDir, { recursive: true, force: true });
      }
    }
  });
});

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

function createRequestContext(projectPath: string, workingDirectory?: string) {
  const requestContext = new RequestContext();
  const getState = () => ({
    projectPath,
    ...(workingDirectory ? { workingDirectory } : {}),
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

describe('mastracode working directory split', () => {
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

  it('roots file tools and exec at a distinct workingDirectory while the workspace stays project-identified', async () => {
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
      // The identity carries both the project and the distinct root.
      expect(workspace.id).toContain(`${projectDir}@${parentDir}`);
    } finally {
      try {
        await workspace?.destroy();
      } finally {
        await fs.rm(parentDir, { recursive: true, force: true });
      }
    }
  });

  it('does not reuse a cached workspace rooted at the project when the working directory changes', async () => {
    const parentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-reuse-'));
    const projectDir = path.join(parentDir, 'repo');
    await fs.mkdir(projectDir);
    const registered = new Map<string, any>();
    const mastra = {
      getWorkspaceById(id: string) {
        const found = registered.get(id);
        if (!found) throw new Error(`not registered: ${id}`);
        return found;
      },
    };
    const created: Array<{ destroy(): Promise<void> }> = [];
    try {
      const { getDynamicWorkspace } = await import('./workspace.js');
      const coupled = await getDynamicWorkspace({
        requestContext: createRequestContext(projectDir) as any,
        mastra: mastra as any,
      });
      created.push(coupled);
      registered.set(coupled.id, coupled);

      const split = await getDynamicWorkspace({
        requestContext: createRequestContext(projectDir, parentDir) as any,
        mastra: mastra as any,
      });
      created.push(split);
      registered.set(split.id, split);

      expect(split).not.toBe(coupled);
      expect(split.filesystem.basePath).toBe(parentDir);
      expect(split.sandbox.workingDirectory).toBe(parentDir);

      // Same roots again reuse the cached workspace.
      const again = await getDynamicWorkspace({
        requestContext: createRequestContext(projectDir, parentDir) as any,
        mastra: mastra as any,
      });
      expect(again).toBe(split);
    } finally {
      try {
        for (const workspace of created) await workspace.destroy();
      } finally {
        await fs.rm(parentDir, { recursive: true, force: true });
      }
    }
  });
});

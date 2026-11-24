import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

const settingsMock = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../onboarding/settings.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../onboarding/settings.js')>()),
  loadSettings: () => settingsMock.value,
}));

function createRequestContext(projectPath: string) {
  const requestContext = new RequestContext();
  const getState = () => ({
    projectPath,
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

describe('mastracode workspace reuse', () => {
  it('builds on a lookup miss and reuses a registered workspace without logging errors', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-reuse-'));
    const mastra = new Mastra({});
    const trackException = vi.spyOn(mastra.getLogger(), 'trackException');
    let workspace: Awaited<ReturnType<typeof import('./workspace.js').getDynamicWorkspace>> | undefined;

    try {
      const { getDynamicWorkspace } = await import('./workspace.js');
      const requestContext = createRequestContext(tempDir) as any;
      workspace = await getDynamicWorkspace({ requestContext, mastra });
      mastra.addWorkspace(workspace);

      expect(await getDynamicWorkspace({ requestContext, mastra })).toBe(workspace);
      expect(trackException).not.toHaveBeenCalled();
    } finally {
      try {
        await workspace?.destroy();
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }
  });
});

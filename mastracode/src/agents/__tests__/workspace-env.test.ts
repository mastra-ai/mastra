import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));
vi.mock('../../onboarding/settings.js', () => ({
  loadSettings: () => ({}),
}));

const originalEnv = { ...process.env };

function createRequestContext(projectPath: string) {
  return {
    get: (key: string) =>
      key === 'harness'
        ? {
            modeId: 'build',
            getState: () => ({
              projectPath,
              sandboxAllowedPaths: [],
            }),
          }
        : undefined,
  };
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe('mastracode workspace sandbox environment', () => {
  it('passes arbitrary parent environment variables to local subprocesses', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-env-'));

    try {
      process.env.MASTRACODE_TEST_ENV = 'works';
      const { getDynamicWorkspace } = await import('../workspace.js');
      const workspace = getDynamicWorkspace({ requestContext: createRequestContext(tempDir) as any });

      const result = await workspace.sandbox!.executeCommand!('node -e "console.log(process.env.MASTRACODE_TEST_ENV)"');

      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('works');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('runs hooks around workspace tool execution', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-workspace-hooks-'));

    try {
      const input = { path: 'hook.txt', content: 'ok' };
      const hookManager = {
        runPreToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
        runPostToolUse: vi.fn(async () => ({ allowed: true, results: [], warnings: [] })),
      };
      const [{ createWorkspaceTools }, { getDynamicWorkspace }] = await Promise.all([
        import('@mastra/core/workspace'),
        import('../workspace.js'),
      ]);
      const workspace = getDynamicWorkspace({
        requestContext: createRequestContext(tempDir) as any,
        hookManager: hookManager as any,
      });
      const tools = await createWorkspaceTools(workspace);

      const output = await tools.write_file.execute(input, { workspace });

      expect(output).toContain('Wrote 2 bytes to hook.txt');
      expect(hookManager.runPreToolUse).toHaveBeenCalledWith('write_file', input);
      expect(hookManager.runPostToolUse).toHaveBeenCalledWith('write_file', input, output, false);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

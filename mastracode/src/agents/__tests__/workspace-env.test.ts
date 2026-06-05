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
});

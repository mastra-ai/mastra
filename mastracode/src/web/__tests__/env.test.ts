import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe('loadWebEnvFiles', () => {
  it('loads Railway credentials from local env files without overriding existing env', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-web-env-'));

    try {
      await fs.writeFile(
        path.join(tempDir, '.env'),
        ['RAILWAY_ENVIRONMENT_ID=env_from_file', 'RAILWAY_API_TOKEN=token_from_file', 'EXISTING_VALUE=file'].join('\n'),
      );
      await fs.writeFile(path.join(tempDir, '.env.local'), 'RAILWAY_API_TOKEN=token_from_local\n');
      process.env.EXISTING_VALUE = 'process';
      delete process.env.RAILWAY_ENVIRONMENT_ID;
      delete process.env.RAILWAY_API_TOKEN;

      const { loadWebEnvFiles } = await import('../env.js');
      loadWebEnvFiles(tempDir);

      expect(process.env.RAILWAY_ENVIRONMENT_ID).toBe('env_from_file');
      expect(process.env.RAILWAY_API_TOKEN).toBe('token_from_local');
      expect(process.env.EXISTING_VALUE).toBe('process');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});

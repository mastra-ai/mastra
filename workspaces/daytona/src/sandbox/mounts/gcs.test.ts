import { describe, it, expect, vi } from 'vitest';

import { mountGCS } from './gcs';

const makeCtx = (commandMap: Record<string, { exitCode: number; stdout: string; stderr: string }> = {}) => {
  const run = vi.fn().mockImplementation(async (cmd: string) => {
    for (const [key, val] of Object.entries(commandMap)) {
      if (cmd.includes(key)) return val;
    }
    return { exitCode: 0, stdout: '', stderr: '' };
  });

  const writeFile = vi.fn().mockResolvedValue(undefined);

  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return { run, writeFile, logger };
};

const BASE_COMMANDS = {
  'storage.googleapis.com': { exitCode: 0, stdout: '', stderr: '' },
  'which gcsfuse': { exitCode: 0, stdout: '/usr/bin/gcsfuse', stderr: '' },
  'id -u && id -g': { exitCode: 0, stdout: '1000\n1000', stderr: '' },
};

describe('mountGCS', () => {
  describe('prefix handling', () => {
    it('passes --only-dir when prefix is set', async () => {
      const ctx = makeCtx(BASE_COMMANDS);

      await mountGCS(
        '/mnt/gcs',
        {
          type: 'gcs',
          bucket: 'test-bucket',
          serviceAccountKey: '{"type":"service_account"}',
          prefix: 'workspace/data/',
        },
        ctx,
      );

      const gcsfuseCall = ctx.run.mock.calls.find(
        ([cmd]: [string]) => cmd.includes('gcsfuse') && cmd.includes('/mnt/gcs') && !cmd.includes('which'),
      );
      expect(gcsfuseCall).toBeDefined();
      expect(gcsfuseCall![0]).toContain('--only-dir=workspace/data');
      expect(gcsfuseCall![0]).not.toContain('--only-dir=workspace/data/');
    });

    it('omits --only-dir when no prefix is set', async () => {
      const ctx = makeCtx(BASE_COMMANDS);

      await mountGCS(
        '/mnt/gcs',
        {
          type: 'gcs',
          bucket: 'test-bucket',
          serviceAccountKey: '{"type":"service_account"}',
        },
        ctx,
      );

      const gcsfuseCall = ctx.run.mock.calls.find(
        ([cmd]: [string]) => cmd.includes('gcsfuse') && cmd.includes('/mnt/gcs') && !cmd.includes('which'),
      );
      expect(gcsfuseCall).toBeDefined();
      expect(gcsfuseCall![0]).not.toContain('--only-dir');
    });

    it('passes --only-dir for anonymous (public) mount with prefix', async () => {
      const ctx = makeCtx(BASE_COMMANDS);

      await mountGCS(
        '/mnt/gcs',
        {
          type: 'gcs',
          bucket: 'public-bucket',
          prefix: 'shared/assets',
        },
        ctx,
      );

      const gcsfuseCall = ctx.run.mock.calls.find(
        ([cmd]: [string]) => cmd.includes('gcsfuse') && cmd.includes('/mnt/gcs') && !cmd.includes('which'),
      );
      expect(gcsfuseCall).toBeDefined();
      expect(gcsfuseCall![0]).toContain('--only-dir=shared/assets');
      expect(gcsfuseCall![0]).toContain('--anonymous-access');
    });
  });
});

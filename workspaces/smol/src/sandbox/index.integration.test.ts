import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SmolSandbox } from './index';

const live = process.env.MASTRA_SMOL_INTEGRATION === '1' ? describe : describe.skip;

live('SmolSandbox with a real local VM', () => {
  it('runs commands on a mounted workspace, uploads files, pauses, resumes and reconnects', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-smol-'));
    const options = {
      id: `mastra-smol-test-${Date.now()}`,
      image: 'node:24-alpine',
      workingDirectory: '/workspace',
      network: false,
      mounts: [{ source: dir, target: '/workspace' }],
    } as const;
    const first = new SmolSandbox(options);
    let second: SmolSandbox | undefined;
    try {
      expect(await first._start()).toMatchObject({ outcome: 'created' });
      const output: string[] = [];
      const run = await first.executeCommand('sh', ['-c', 'printf test > /workspace/guest.txt; echo hello'], {
        onStdout: chunk => output.push(chunk),
        timeout: 5_000,
      });
      expect(run).toMatchObject({ success: true, stdout: 'hello\n', exitCode: 0 });
      expect(output.join('')).toBe('hello\n');
      expect(await readFile(join(dir, 'guest.txt'), 'utf8')).toBe('test');
      await first.writeFiles([{ path: '/workspace/hello.sh', content: '#!/bin/sh\necho from-file\n', mode: 0o755 }]);
      expect((await first.executeCommand('/workspace/hello.sh')).stdout.trim()).toBe('from-file');
      await first._stop();
      second = new SmolSandbox(options);
      expect(await second._start()).toMatchObject({ outcome: 'connected' });
      expect((await second.executeCommand('cat', ['/workspace/guest.txt'])).stdout).toBe('test');
    } finally {
      if (second?.instance) await second._destroy();
      else await first._destroy();
      await rm(dir, { recursive: true, force: true });
    }
  }, 180_000);

  it('captures a portable checkpoint when no host directory is mounted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-smol-checkpoint-'));
    const checkpointPath = join(dir, 'snapshot.smolcheckpoint');
    const sandbox = new SmolSandbox({
      id: `mastra-smol-checkpoint-${Date.now()}`,
      image: 'node:24-alpine',
      network: false,
      checkpointPath,
    });
    try {
      await sandbox._start();
      expect((await sandbox.executeCommand('echo checkpoint > /workspace/checkpoint.txt')).success).toBe(true);
      await sandbox.snapshot();
      expect((await stat(checkpointPath)).size).toBeGreaterThan(0);
      expect(sandbox.checkpointInfo?.id).toBe(checkpointPath);
      await sandbox._stop();
      expect(await sandbox._start()).toMatchObject({ outcome: 'connected' });
      expect((await sandbox.executeCommand('cat', ['/workspace/checkpoint.txt'])).stdout).toBe('checkpoint\n');
    } finally {
      await sandbox._destroy();
      await rm(dir, { recursive: true, force: true });
    }
  }, 180_000);
});

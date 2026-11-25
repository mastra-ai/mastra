import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalSandbox } from './local-sandbox';

const waitCommand = (ms: number) => `"${process.execPath}" -e "setTimeout(() => {}, ${ms})"`;

describe('LocalSandbox foreground timeout defaults', () => {
  let workingDirectory: string;
  const sandboxes: LocalSandbox[] = [];

  beforeEach(async () => {
    workingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-timeout-'));
  });

  afterEach(async () => {
    await Promise.all(sandboxes.splice(0).map(sandbox => sandbox.destroy()));
    await fs.rm(workingDirectory, { recursive: true, force: true });
  });

  function createSandbox(timeout?: number) {
    const sandbox = new LocalSandbox({ workingDirectory, timeout });
    sandboxes.push(sandbox);
    return sandbox;
  }

  it('returns output normally for commands that finish before the default timeout', async () => {
    const result = await createSandbox().executeCommand(`"${process.execPath}" -e "console.log('done')"`);
    expect(result).toMatchObject({ success: true, exitCode: 0 });
    expect(result.stdout.trim()).toBe('done');
  });

  it.each([
    { configured: undefined, override: undefined, expected: 30_000, clone: false },
    { configured: 60_000, override: undefined, expected: 60_000, clone: false },
    { configured: 60_000, override: undefined, expected: 60_000, clone: true },
    { configured: 60_000, override: 5_000, expected: 5_000, clone: false },
    { configured: 60_000, override: 0, expected: 0, clone: false },
    { configured: 0, override: undefined, expected: 0, clone: false },
  ])(
    'forwards timeout $expected (configured=$configured, override=$override, clone=$clone)',
    async ({ configured, override, expected, clone }) => {
      let sandbox = createSandbox(configured);
      if (clone) {
        sandbox = sandbox.clone();
        sandboxes.push(sandbox);
      }
      const result = { success: true, exitCode: 0, stdout: '', stderr: '', executionTimeMs: 0 };
      const spawn = vi.spyOn(sandbox.processes, 'spawn').mockResolvedValue({
        pid: 'test-process',
        exitCode: 0,
        wait: async () => result,
      } as Awaited<ReturnType<typeof sandbox.processes.spawn>>);

      await sandbox.executeCommand('echo done', [], { timeout: override });

      expect(spawn).toHaveBeenCalledWith('echo done', expect.objectContaining({ timeout: expected }));
    },
  );

  it('kills a foreground command that exceeds its timeout', async () => {
    const result = await createSandbox().executeCommand(waitCommand(60_000), [], { timeout: 100 });
    expect(result).toMatchObject({ success: false, exitCode: 124, timedOut: true });
    expect(result.stderr).toContain('Process timed out after 100ms');
  });

  it('disables the configured timeout when a command sets zero', async () => {
    const result = await createSandbox(100).executeCommand(waitCommand(250), [], { timeout: 0 });
    expect(result).toMatchObject({ success: true, exitCode: 0 });
    expect(result.timedOut).not.toBe(true);
  });

  it('does not apply the foreground default to background processes', async () => {
    const sandbox = createSandbox(100);
    const handle = await sandbox.processes.spawn(waitCommand(250));
    const result = await handle.wait();
    expect(result).toMatchObject({ success: true, exitCode: 0 });
    expect(result.timedOut).not.toBe(true);
  });
});

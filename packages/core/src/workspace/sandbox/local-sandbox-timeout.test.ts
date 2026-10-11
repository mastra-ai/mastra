import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

  it('times out foreground commands after 30 seconds when no timeout is supplied', async () => {
    const result = await createSandbox().executeCommand(waitCommand(31_000));
    expect(result).toMatchObject({ success: false, exitCode: 124, timedOut: true });
    expect(result.stderr).toContain('Process timed out after 30000ms');
  }, 40_000);

  it('honors the configured default in a cloned sandbox', async () => {
    const sandbox = createSandbox(100).clone();
    sandboxes.push(sandbox);
    const result = await sandbox.executeCommand(waitCommand(1_000));
    expect(result).toMatchObject({ success: false, exitCode: 124, timedOut: true });
    expect(result.stderr).toContain('Process timed out after 100ms');
  });

  it.each([2_000, 0])('allows a per-command timeout of %i to override the default', async timeout => {
    const result = await createSandbox(100).executeCommand(waitCommand(250), [], { timeout });
    expect(result).toMatchObject({ success: true, exitCode: 0 });
    expect(result.timedOut).not.toBe(true);
  });

  it('honors a shorter per-command timeout', async () => {
    const result = await createSandbox().executeCommand(waitCommand(1_000), [], { timeout: 100 });
    expect(result).toMatchObject({ success: false, exitCode: 124, timedOut: true });
    expect(result.stderr).toContain('Process timed out after 100ms');
  });

  it('does not apply the foreground default to background processes', async () => {
    const sandbox = createSandbox(100);
    const handle = await sandbox.processes.spawn(waitCommand(250));
    const result = await handle.wait();
    expect(result).toMatchObject({ success: true, exitCode: 0 });
    expect(result.timedOut).not.toBe(true);
  });
});

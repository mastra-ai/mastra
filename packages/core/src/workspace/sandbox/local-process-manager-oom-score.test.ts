import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { executeCommandTool } from '../tools/execute-command';
import { Workspace } from '../workspace';
import { LocalSandbox } from './local-sandbox';

// Real processes: the command's own /proc/self/oom_score_adj shows what the kernel OOM killer
// would use for it. The kill itself needs a memory-limited cgroup and is checked outside unit tests.
const ownAdj = (() => {
  try {
    return Number.parseInt(readFileSync('/proc/self/oom_score_adj', 'utf8'), 10);
  } catch {
    return undefined;
  }
})();
const canRaise = process.platform === 'linux' && existsSync('/proc/self/oom_score_adj') && ownAdj! < 500;

describe.skipIf(!canRaise)('LocalSandbox commands get a raised OOM score', () => {
  const directories: string[] = [];
  const sandboxes: LocalSandbox[] = [];

  async function makeSandbox() {
    const directory = await mkdtemp(join(tmpdir(), 'mastra-oom-'));
    directories.push(directory);
    const sandbox = new LocalSandbox({ workingDirectory: directory, isolation: 'none' });
    sandboxes.push(sandbox);
    return sandbox;
  }

  afterEach(async () => {
    vi.unstubAllEnvs();
    await Promise.all(sandboxes.splice(0).map(sandbox => sandbox._destroy().catch(() => {})));
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
  });

  it('runs foreground commands at 500, with output and exit code unchanged', async () => {
    const sandbox = await makeSandbox();
    const result = await sandbox.executeCommand('cat /proc/self/oom_score_adj; printf err >&2; exit 7');
    expect(result.stdout).toBe('500\n');
    expect(result.stderr).toBe('err');
    expect(result.exitCode).toBe(7);
  });

  it('runs background processes at 500', async () => {
    const sandbox = await makeSandbox();
    const handle = await sandbox.processes.spawn('sh -c "cat /proc/self/oom_score_adj"');
    const result = await handle.wait();
    expect(result.stdout).toBe('500\n');
    expect(result.exitCode).toBe(0);
  });

  it('leaves the agent at its own score', async () => {
    const sandbox = await makeSandbox();
    await sandbox.executeCommand('true');
    expect(Number.parseInt(readFileSync('/proc/self/oom_score_adj', 'utf8'), 10)).toBe(ownAdj);
  });

  it('runs commands at the agent score when turned off', async () => {
    vi.stubEnv('MASTRA_COMMAND_OOM_SCORE_ADJ', '0');
    const sandbox = await makeSandbox();
    const result = await sandbox.executeCommand('cat /proc/self/oom_score_adj');
    expect(result.stdout).toBe(`${ownAdj}\n`);
  });

  it('reaches every stage of a pipeline run by execute_command', async () => {
    const sandbox = await makeSandbox();
    const result = await executeCommandTool.execute!(
      { command: 'cat /proc/self/oom_score_adj | tail -1', tail: 0, timeout: 10 },
      { workspace: new Workspace({ sandbox }) },
    );
    expect(result).toBe('500\n');
  });
});

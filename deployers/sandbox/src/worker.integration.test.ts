import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FakeSandbox, makeBuildDir } from './fake-sandbox.mock.js';
import type { SandboxWorkerResourceLimits } from './types.js';
import { deployWorkerToSandbox } from './worker.js';

const temporaryDirectories: string[] = [];

async function generateExecution(command: string, args: string[], resourceLimits: SandboxWorkerResourceLimits) {
  const remoteDir = await mkdtemp(join(tmpdir(), 'mastra-worker-limits-'));
  temporaryDirectories.push(remoteDir);
  const sandbox = new FakeSandbox({ withNetworking: false });
  await deployWorkerToSandbox({
    sandbox,
    dir: await makeBuildDir(tmpdir()),
    remoteDir,
    executionId: 'attempt-1',
    command,
    args,
    installCommand: '',
    resourceLimits,
  });

  const preflight = sandbox.commands.find(script => script.includes('MASTRA_WORKER_CAPABILITY:'));
  const launch = sandbox.writtenFiles.flat().find(file => file.path.endsWith('/attempt-1/launch.sh'));
  if (!preflight || !launch) throw new Error('Expected generated preflight and launch scripts.');
  await mkdir(dirname(launch.path), { recursive: true });
  await writeFile(launch.path, launch.content);
  return { preflight, launchPath: launch.path, remoteDir };
}

async function runShell(
  script: string,
  args: string[] = [],
): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', [script, ...args], { stdio: 'ignore' });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 15_000);
    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

const linuxDescribe = process.platform === 'linux' ? describe : describe.skip;

linuxDescribe('worker resource limits on Linux', () => {
  it('passes the fail-closed capability preflight in a supported environment', async () => {
    const { preflight, remoteDir } = await generateExecution('sh', ['-c', 'exit 0'], {
      cpuTimeSeconds: 2,
      addressSpaceBytes: 64 * 1024 * 1024,
      fileSizeBytes: 1024,
      openFiles: 32,
    });
    const preflightPath = join(remoteDir, 'preflight.sh');
    await writeFile(preflightPath, preflight);

    await expect(runShell(preflightPath)).resolves.toEqual({ code: 0, signal: null });
  });

  it('reports CPU exhaustion from SIGXCPU', async () => {
    const { launchPath, remoteDir } = await generateExecution('sh', ['-c', 'while :; do :; done'], {
      cpuTimeSeconds: 1,
    });

    await runShell(launchPath);
    await expect(readFile(join(remoteDir, '.mastra/executions/attempt-1/status'), 'utf8')).resolves.toBe(
      'resource_exhausted|attempt-1|cpu|1|SIGXCPU\n',
    );
  }, 10_000);

  it('reports file-size exhaustion from SIGXFSZ', async () => {
    const { launchPath, remoteDir } = await generateExecution(
      'sh',
      ['-c', 'dd if=/dev/zero of=large.bin bs=1024 count=1024'],
      { fileSizeBytes: 1024 },
    );

    await runShell(launchPath);
    await expect(readFile(join(remoteDir, '.mastra/executions/attempt-1/status'), 'utf8')).resolves.toBe(
      'resource_exhausted|attempt-1|file_size|1024|SIGXFSZ\n',
    );
  });

  it('applies address-space and file-descriptor hard limits without false attribution', async () => {
    const { launchPath, remoteDir } = await generateExecution(
      'sh',
      [
        '-c',
        'test "$(ulimit -H -v)" = 65536 && test "$(ulimit -H -n)" = 32 && ! ulimit -H -v 65537 2>/dev/null && ! ulimit -H -n 33 2>/dev/null',
      ],
      { addressSpaceBytes: 64 * 1024 * 1024, openFiles: 32 },
    );

    await runShell(launchPath);
    await expect(readFile(join(remoteDir, '.mastra/executions/attempt-1/status'), 'utf8')).resolves.toBe(
      'exited|attempt-1|0|\n',
    );
  });
});

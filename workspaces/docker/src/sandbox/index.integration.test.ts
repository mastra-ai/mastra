/**
 * Docker Sandbox Integration Tests
 *
 * These tests require a running Docker daemon and run against real Docker containers.
 * They are separated from unit tests to avoid mock conflicts.
 *
 * Prerequisites:
 * - Docker daemon running locally
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { SandboxAbortError } from '@mastra/core/workspace';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DockerSandbox } from './index';

const killHelperExitFixture = fileURLToPath(new URL('./kill-helper-exit.fixture.ts', import.meta.url));

async function runKillHelperExitFixture(stdinMode: 'open' | 'closed'): Promise<void> {
  const child = spawn(process.execPath, ['--import', 'tsx', killHelperExitFixture, stdinMode], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => (stdout += chunk));
  child.stderr.on('data', chunk => (stderr += chunk));

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      reject(
        new Error(`Fixture did not exit naturally with stdin ${stdinMode}.\nstdout:\n${stdout}\nstderr:\n${stderr}`),
      );
    }, 60000);

    child.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Fixture exited with code ${code} and signal ${signal} with stdin ${stdinMode}.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
          ),
        );
      }
    });
  });
}

/**
 * Conformance test suite — validates DockerSandbox against the shared sandbox contract.
 */
createSandboxTestSuite({
  suiteName: 'DockerSandbox Conformance',
  createSandbox: options => {
    return new DockerSandbox({
      id: `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      image: 'node:22-slim',
      timeout: 60000,
      ...(options?.env && { env: options.env }),
    });
  },
  createInvalidSandbox: () => {
    return new DockerSandbox({
      id: `bad-config-${Date.now()}`,
      image: 'nonexistent/fake-image-that-does-not-exist:latest',
    });
  },
  cleanupSandbox: async sandbox => {
    try {
      await sandbox._destroy();
    } catch {
      // Ignore cleanup errors
    }
  },
  capabilities: {
    supportsMounting: false,
    supportsReconnection: true,
    supportsConcurrency: true,
    supportsEnvVars: true,
    supportsWorkingDirectory: true,
    supportsTimeout: true,
    supportsStreaming: true,
    supportsStdin: true,
    supportsCloseStdin: true,
  },
});

/**
 * writeFiles — validates bulk file upload against a real container.
 */
describe('DockerSandbox writeFiles (integration)', () => {
  let sandbox: DockerSandbox;

  beforeAll(async () => {
    sandbox = new DockerSandbox({
      id: `writefiles-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      image: 'node:22-slim',
      workingDirectory: '/workspace',
      timeout: 60000,
    });
    await sandbox._start();
  }, 120000);

  afterAll(async () => {
    try {
      await sandbox._destroy();
    } catch {
      // Ignore cleanup errors
    }
  });

  it('writes text and binary files, resolving relative paths and creating parent dirs', async () => {
    const binary = Buffer.from([0x00, 0x01, 0x02, 0xff]);
    await sandbox.writeFiles([
      { path: 'src/index.js', content: 'console.log("hello")\n' },
      { path: '/tmp/absolute.txt', content: 'absolute path\n' },
      { path: 'assets/data.bin', content: binary },
    ]);

    const text = await sandbox.executeCommand!('cat', ['/workspace/src/index.js']);
    expect(text.exitCode).toBe(0);
    expect(text.stdout).toContain('hello');

    const abs = await sandbox.executeCommand!('cat', ['/tmp/absolute.txt']);
    expect(abs.exitCode).toBe(0);
    expect(abs.stdout).toContain('absolute path');

    const size = await sandbox.executeCommand!('stat', ['-c', '%s', '/workspace/assets/data.bin']);
    expect(size.exitCode).toBe(0);
    expect(size.stdout.trim()).toBe(String(binary.length));
  }, 120000);

  it('overwrites existing files', async () => {
    await sandbox.writeFiles([{ path: 'overwrite.txt', content: 'first\n' }]);
    await sandbox.writeFiles([{ path: 'overwrite.txt', content: 'second\n' }]);

    const result = await sandbox.executeCommand!('cat', ['/workspace/overwrite.txt']);
    expect(result.stdout.trim()).toBe('second');
  }, 120000);

  it('applies an explicit file mode on creation and overwrite', async () => {
    await sandbox.writeFiles([{ path: 'run.sh', content: '#!/bin/sh\necho hi\n', mode: 0o755 }]);

    const created = await sandbox.executeCommand!('stat', ['-c', '%a', '/workspace/run.sh']);
    expect(created.exitCode).toBe(0);
    expect(created.stdout.trim()).toBe('755');

    await sandbox.writeFiles([{ path: 'run.sh', content: '#!/bin/sh\necho bye\n', mode: 0o600 }]);

    const overwritten = await sandbox.executeCommand!('stat', ['-c', '%a', '/workspace/run.sh']);
    expect(overwritten.stdout.trim()).toBe('600');
  }, 120000);

  it('rejects with SandboxAbortError when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      sandbox.writeFiles([{ path: 'never.txt', content: 'nope\n' }], { abortSignal: controller.signal }),
    ).rejects.toBeInstanceOf(SandboxAbortError);

    // Container remains usable after a cancelled write.
    await sandbox.writeFiles([{ path: 'after-abort.txt', content: 'ok\n' }]);
    const result = await sandbox.executeCommand!('cat', ['/workspace/after-abort.txt']);
    expect(result.stdout.trim()).toBe('ok');
  }, 120000);
});

/**
 * kill() namespace correctness + zombie reaping — replicates the repro from
 * issue #23773 where kill() reported exit 137 but left processes running in the
 * container, and where the default PID 1 (`sleep infinity`) never reaped
 * children so PIDs accumulated against pidsLimit.
 */
describe('DockerSandbox process kill (integration)', () => {
  let sandbox: DockerSandbox;

  beforeAll(async () => {
    sandbox = new DockerSandbox({
      id: `kill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      image: 'node:22-slim',
      timeout: 60000,
    });
    await sandbox._start();
  }, 120000);

  afterAll(async () => {
    try {
      await sandbox._destroy();
    } catch {
      // Ignore cleanup errors
    }
  });

  const countProcesses = async (): Promise<number> => {
    // Count PIDs directly from /proc so we don't depend on ps being installed.
    const result = await sandbox.executeCommand!('sh', ['-c', 'ls -d /proc/[0-9]* | wc -l']);
    expect(result.exitCode).toBe(0);
    return parseInt(result.stdout.trim(), 10);
  };

  it('kill() actually terminates the process tree and PID count returns to baseline', async () => {
    const baseline = await countProcesses();

    // Spawn a shell that forks a child sleep, mirroring the repro's process tree.
    const handle = await sandbox.processes!.spawn('sh -c "sleep 300 & sleep 300"');
    // Give the tree time to establish.
    await new Promise(r => setTimeout(r, 1000));

    const duringPids = await countProcesses();
    expect(duringPids).toBeGreaterThan(baseline);

    const killed = await handle.kill();
    expect(killed).toBe(true);
    await handle.wait();

    // Poll until the container settles back to (approximately) baseline. With an
    // init reaper as PID 1, killed processes are reaped rather than lingering.
    // Allow a small margin for the transient counting exec itself.
    const tolerance = 1;
    let settled = baseline;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      settled = await countProcesses();
      if (settled <= baseline + tolerance) break;
    }

    // The killed tree (3 procs) is gone; we are back near baseline, not stuck
    // at the elevated during-count (the pre-fix bug left processes running).
    expect(settled).toBeLessThanOrEqual(baseline + tolerance);
    expect(settled).toBeLessThan(duringPids);
  }, 120000);

  it('does not leak PIDs across repeated spawn/kill cycles', async () => {
    const baseline = await countProcesses();

    for (let cycle = 0; cycle < 3; cycle++) {
      const handle = await sandbox.processes!.spawn('sh -c "sleep 300 & sleep 300"');
      await new Promise(r => setTimeout(r, 500));
      await handle.kill();
      await handle.wait();
    }

    let settled = baseline;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      settled = await countProcesses();
      if (settled <= baseline + 1) break;
    }

    // No accumulation of zombies/orphans after several kill cycles.
    expect(settled).toBeLessThanOrEqual(baseline + 1);
  }, 120000);

  it('kill() catches a descendant that drops its environment and re-parents away', async () => {
    const baseline = await countProcesses();

    // An intermediate shell forks a grandchild that re-execs with a *cleared*
    // environment (so it carries no marker), records the grandchild's PID, then
    // exits so the grandchild re-parents away and loses its ancestry link to the
    // leader. The leader itself stays alive (trailing `sleep`) so the process is
    // still running when we kill it. Only a kernel-enforced process-group kill
    // can reach the orphan — an env-marker/PPID sweep would miss it.
    const orphanPidFile = '/tmp/orphan-under-test.pid';
    const handle = await sandbox.processes!.spawn(
      `sh -c "sh -c 'env -i sleep 300 & echo \\$! > ${orphanPidFile}'; sleep 300"`,
    );
    await new Promise(r => setTimeout(r, 1000));

    const duringPids = await countProcesses();
    expect(duringPids).toBeGreaterThan(baseline);

    // Read the exact orphan PID so we can probe it directly rather than relying
    // on an aggregate PID-count tolerance.
    const orphanPid = (await sandbox.executeCommand!('cat', [orphanPidFile])).stdout.trim();
    expect(orphanPid).toMatch(/^[0-9]+$/);

    const killed = await handle.kill();
    expect(killed).toBe(true);
    await handle.wait();

    // The orphaned, environment-less sleep must be gone: probe its exact PID
    // with `kill -0` (0 = still alive). The process-group kill reached it
    // despite the missing marker and severed ancestry.
    let orphanAlive = true;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const probe = await sandbox.executeCommand!('sh', [
        '-c',
        'if kill -0 "$1" 2>/dev/null; then echo alive; else echo dead; fi',
        'sh',
        orphanPid,
      ]);
      orphanAlive = probe.stdout.trim() === 'alive';
      if (!orphanAlive) break;
    }
    expect(orphanAlive).toBe(false);

    let settled = baseline;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      settled = await countProcesses();
      if (settled <= baseline + 1) break;
    }
    expect(settled).toBeLessThanOrEqual(baseline + 1);
    expect(settled).toBeLessThan(duringPids);
  }, 120000);

  it('releases kill-helper responses so subprocesses exit naturally with stdin open or closed', async () => {
    await runKillHelperExitFixture('open');
    await runKillHelperExitFixture('closed');
  }, 130000);
});

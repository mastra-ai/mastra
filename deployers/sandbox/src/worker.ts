import { posix } from 'node:path';

import type { WorkspaceSandbox } from '@mastra/core/workspace';

import { createTarball, hashInstallInputs, uploadFile } from './engine.js';
import { getInfoSafe, resolveRemoteDir, runInSandbox, shellQuote } from './shared.js';
import type { DeployWorkerToSandboxOptions, SandboxWorkerDeployment, SandboxWorkerStatus } from './types.js';

const ARCHIVE = '.mastra-worker.tar.gz';
const SCRIPT = '.mastra-worker.sh';
const PIDFILE = '.mastra-worker.pid';
const LOGFILE = '.mastra-worker.log';
const STATUSFILE = '.mastra-worker.status';
const INSTALL_MARKER = '.mastra-install-hash';

export async function deployWorkerToSandbox(options: DeployWorkerToSandboxOptions): Promise<SandboxWorkerDeployment> {
  const {
    sandbox,
    dir,
    command,
    mode = 'worker',
    args = [],
    env = {},
    workingDirectory = '.',
    installCommand = 'npm install --omit=dev',
    startupTimeoutMs = 10_000,
    executionTimeoutMs,
    terminationGraceMs = 5_000,
  } = options;

  if (!sandbox.executeCommand) {
    throw new Error(
      `Sandbox provider "${sandbox.provider}" does not support executeCommand, which is required for worker deploys.`,
    );
  }
  if (!command || /[\0\r\n]/.test(command)) throw new Error('Worker command must be a non-empty executable path.');
  if (args.some(arg => arg.includes('\0'))) throw new Error('Worker arguments must not contain NUL bytes.');
  for (const key of Object.keys(env)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid worker environment variable name: ${key}`);
  }
  if (posix.isAbsolute(workingDirectory) || posix.normalize(workingDirectory).startsWith('..')) {
    throw new Error('Worker workingDirectory must stay within the deployed artifact root.');
  }

  const remoteDir = await resolveRemoteDir(sandbox, options.remoteDir);
  const archive = `${remoteDir}/${ARCHIVE}`;
  const tarball = await createTarball(dir);
  const installHash = await hashInstallInputs(dir, installCommand);

  await runInSandbox(sandbox, `mkdir -p ${shellQuote(remoteDir)}`);
  await stopWorker(sandbox, remoteDir, terminationGraceMs);
  await uploadFile(sandbox, archive, tarball);
  await runInSandbox(
    sandbox,
    `tar -xzf ${shellQuote(archive)} -C ${shellQuote(remoteDir)} && rm -f ${shellQuote(archive)}`,
    { label: 'extract worker artifact' },
  );

  if (installHash) {
    const marker = `${remoteDir}/${INSTALL_MARKER}`;
    const current = await runInSandbox(sandbox, `cat ${shellQuote(marker)} 2>/dev/null || true`, {
      allowFailure: true,
    });
    if (current.stdout.trim() !== installHash) {
      await runInSandbox(sandbox, `cd ${shellQuote(remoteDir)} && ${installCommand}`, {
        timeout: options.installTimeoutMs,
        label: 'install worker dependencies',
      });
      await runInSandbox(sandbox, `printf %s ${shellQuote(installHash)} > ${shellQuote(marker)}`);
    }
  }

  const cwd = posix.resolve(remoteDir, workingDirectory);
  const envPrefix = Object.entries(env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(' ');
  const executable = [shellQuote(command), ...args.map(shellQuote)].join(' ');
  const target = `${envPrefix ? `${envPrefix} ` : ''}${executable}`;
  const script = [
    '#!/bin/sh',
    `cd ${shellQuote(cwd)}`,
    `rm -f ${shellQuote(`${remoteDir}/${STATUSFILE}`)}`,
    `(${target}) >> ${shellQuote(`${remoteDir}/${LOGFILE}`)} 2>&1 &`,
    'child=$!',
    `trap 'kill "$child" 2>/dev/null || true; printf "cancelled\\n" > ${shellQuote(`${remoteDir}/${STATUSFILE}`)}; rm -f ${shellQuote(`${remoteDir}/${PIDFILE}`)}; exit 143' TERM INT`,
    ...(executionTimeoutMs
      ? [
          `(sleep ${executionTimeoutMs / 1000}; kill "$child" 2>/dev/null || true; sleep ${terminationGraceMs / 1000}; kill -9 "$child" 2>/dev/null || true) &`,
          'watchdog=$!',
        ]
      : []),
    'wait "$child"',
    'code=$?',
    ...(executionTimeoutMs ? ['kill "$watchdog" 2>/dev/null || true'] : []),
    `printf 'exited %s\\n' "$code" > ${shellQuote(`${remoteDir}/${STATUSFILE}`)}`,
    `rm -f ${shellQuote(`${remoteDir}/${PIDFILE}`)}`,
    'exit "$code"',
  ].join('\n');
  await uploadFile(sandbox, `${remoteDir}/${SCRIPT}`, Buffer.from(script));
  await runInSandbox(
    sandbox,
    `chmod 700 ${shellQuote(`${remoteDir}/${SCRIPT}`)}; chmod 600 ${shellQuote(`${remoteDir}/${LOGFILE}`)} 2>/dev/null || true`,
  );
  await launchWorker(sandbox, remoteDir);

  const deadline = Date.now() + startupTimeoutMs;
  let startupStatus: SandboxWorkerStatus = { state: 'unknown' };
  while (Date.now() < deadline) {
    startupStatus = await readWorkerStatus(sandbox, remoteDir);
    if (startupStatus.state !== 'unknown') break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (startupStatus.state === 'unknown') {
    const logs = await tailWorkerLog(sandbox, remoteDir);
    throw new Error(`Worker did not report startup or exit before the startup timeout.${logs ? `\n${logs}` : ''}`);
  }

  const info = await getInfoSafe(sandbox);
  return {
    sandboxId: info?.id ?? sandbox.id ?? 'unknown',
    expiresAt: info?.timeoutAt,
    status: () => readWorkerStatus(sandbox, remoteDir),
    logs: lines => tailWorkerLog(sandbox, remoteDir, lines),
    cancel: () => stopWorker(sandbox, remoteDir, terminationGraceMs),
    stop: async () => {
      await sandbox.stop?.();
    },
    destroy: async () => {
      await sandbox.destroy?.();
    },
    relaunch: async () => {
      const status = await readWorkerStatus(sandbox, remoteDir);
      if (status.state === 'running') return;
      if (mode === 'job' && status.state !== 'unknown') {
        throw new Error(`Cannot relaunch a terminal job with status "${status.state}".`);
      }
      await launchWorker(sandbox, remoteDir);
    },
  };
}

async function launchWorker(sandbox: WorkspaceSandbox, remoteDir: string): Promise<void> {
  await runInSandbox(
    sandbox,
    `: > ${shellQuote(`${remoteDir}/${LOGFILE}`)}; nohup sh ${shellQuote(`${remoteDir}/${SCRIPT}`)} >/dev/null 2>&1 & echo $! > ${shellQuote(`${remoteDir}/${PIDFILE}`)}`,
    { label: 'launch worker' },
  );
}

async function readWorkerStatus(sandbox: WorkspaceSandbox, remoteDir: string): Promise<SandboxWorkerStatus> {
  const result = await runInSandbox(
    sandbox,
    `if [ -f ${shellQuote(`${remoteDir}/${PIDFILE}`)} ] && kill -0 "$(cat ${shellQuote(`${remoteDir}/${PIDFILE}`)})" 2>/dev/null; then echo running; elif [ -f ${shellQuote(`${remoteDir}/${STATUSFILE}`)} ]; then cat ${shellQuote(`${remoteDir}/${STATUSFILE}`)}; else echo unknown; fi`,
    { allowFailure: true, label: 'read worker status' },
  );
  const value = result.stdout.trim();
  if (value === 'running') return { state: 'running' };
  const match = /^exited (\d+)$/.exec(value);
  if (match) return { state: 'exited', exitCode: Number(match[1]) };
  if (value === 'cancelled') return { state: 'cancelled' };
  return { state: 'unknown' };
}

async function stopWorker(sandbox: WorkspaceSandbox, remoteDir: string, graceMs: number): Promise<void> {
  const attempts = Math.max(1, Math.ceil(graceMs / 100));
  await runInSandbox(
    sandbox,
    `if [ -f ${shellQuote(`${remoteDir}/${PIDFILE}`)} ]; then pid="$(cat ${shellQuote(`${remoteDir}/${PIDFILE}`)})"; kill "$pid" 2>/dev/null || true; i=0; while kill -0 "$pid" 2>/dev/null && [ "$i" -lt ${attempts} ]; do sleep 0.1; i=$((i + 1)); done; kill -9 "$pid" 2>/dev/null || true; rm -f ${shellQuote(`${remoteDir}/${PIDFILE}`)}; printf 'cancelled\\n' > ${shellQuote(`${remoteDir}/${STATUSFILE}`)}; fi`,
    { allowFailure: true, timeout: graceMs + 5_000, label: 'stop worker' },
  );
}

async function tailWorkerLog(sandbox: WorkspaceSandbox, remoteDir: string, lines = 50): Promise<string> {
  const safeLines = Math.min(10_000, Math.max(1, Math.floor(lines)));
  const result = await runInSandbox(
    sandbox,
    `tail -n ${safeLines} ${shellQuote(`${remoteDir}/${LOGFILE}`)} 2>/dev/null || true`,
    { allowFailure: true, label: 'tail worker log' },
  );
  return result.stdout;
}

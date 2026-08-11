import { posix } from 'node:path';

import type { WorkspaceSandbox } from '@mastra/core/workspace';

import { createTarball, hashInstallInputs, uploadFile } from './engine.js';
import { getInfoSafe, resolveRemoteDir, runInSandbox, shellQuote } from './shared.js';
import {
  SandboxWorkerCapabilityError,
  type AttachWorkerDeploymentOptions,
  type DeployWorkerToSandboxOptions,
  type SandboxDestroyResult,
  type SandboxWorkerDeployment,
  type SandboxWorkerExecution,
  type SandboxWorkerInput,
  type SandboxWorkerOutput,
  type SandboxWorkerResourceLimitCapability,
  type SandboxWorkerResourceLimits,
  type SandboxWorkerStatus,
} from './types.js';

const ARCHIVE = '.mastra-worker.tar.gz';
const RUNTIME_DIR = '.mastra/executions';
const INSTALL_MARKER = '.mastra-install-hash';
const INSTALL_LOCK = '.mastra-install-lock';
const ARTIFACT_LOCK = '.mastra-artifact-lock';
const EXECUTION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const DEFAULT_INPUT_LIMIT = 16 * 1024 * 1024;
const DEFAULT_OUTPUT_READ_LIMIT = 1024 * 1024;
const RESOURCE_CAPABILITY_PREFIX = 'MASTRA_WORKER_CAPABILITY:';

interface NormalizedResourceLimits {
  cpuTimeSeconds?: number;
  addressSpaceBytes?: number;
  addressSpaceKilobytes?: number;
  fileSizeBytes?: number;
  fileSizeBlocks?: number;
  openFiles?: number;
}

interface WorkerExecutionConfig {
  sandbox: WorkspaceSandbox;
  resolveRemoteDir: () => Promise<string>;
  terminationGraceMs: number;
}

interface WorkerConfig extends WorkerExecutionConfig {
  remoteDir: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  workingDirectory: string;
  mode: 'worker' | 'job';
  startupTimeoutMs: number;
  executionTimeoutMs?: number;
  resourceLimits?: NormalizedResourceLimits;
  terminationGraceMs: number;
  inputLimitBytes: number;
}

export async function deployWorkerToSandbox(options: DeployWorkerToSandboxOptions): Promise<SandboxWorkerDeployment> {
  validateOptions(options);
  const {
    sandbox,
    dir,
    executionId,
    command,
    mode = 'worker',
    args = [],
    env = {},
    workingDirectory = '.',
    installCommand = 'npm install --omit=dev',
    startupTimeoutMs = 10_000,
    executionTimeoutMs,
    resourceLimits: requestedResourceLimits,
    terminationGraceMs = 5_000,
    inputLimitBytes = DEFAULT_INPUT_LIMIT,
  } = options;

  const resourceLimits = normalizeResourceLimits(requestedResourceLimits);
  if (resourceLimits) await preflightResourceLimits(sandbox, resourceLimits);

  const remoteDir = await resolveRemoteDir(sandbox, options.remoteDir);
  const config: WorkerConfig = {
    sandbox,
    remoteDir,
    resolveRemoteDir: async () => remoteDir,
    command,
    args,
    env,
    workingDirectory,
    mode,
    startupTimeoutMs,
    executionTimeoutMs,
    resourceLimits,
    terminationGraceMs,
    inputLimitBytes,
  };

  const archive = `${remoteDir}/${ARCHIVE}`;
  const tarball = await createTarball(dir);
  const installHash = await hashInstallInputs(dir, installCommand);

  const artifactLock = `${remoteDir}/${ARTIFACT_LOCK}`;
  let artifactLockAcquired = false;
  try {
    await runInSandbox(sandbox, `mkdir -p ${shellQuote(remoteDir)}`);
    await acquireLock(sandbox, artifactLock, options.installTimeoutMs, 'worker artifact');
    artifactLockAcquired = true;
    await uploadFile(sandbox, archive, tarball);
    await runInSandbox(
      sandbox,
      `tar -xzf ${shellQuote(archive)} -C ${shellQuote(remoteDir)} && rm -f ${shellQuote(archive)}`,
      { label: 'extract worker artifact' },
    );
  } catch (error) {
    throw workerPhaseError('upload', error);
  } finally {
    if (artifactLockAcquired) {
      await runInSandbox(sandbox, `rm -rf ${shellQuote(artifactLock)}`, {
        allowFailure: true,
        label: 'release worker artifact lock',
      });
    }
  }

  try {
    await installDependencies(sandbox, remoteDir, installHash ?? undefined, installCommand, options.installTimeoutMs);
  } catch (error) {
    throw workerPhaseError('install', error);
  }

  return createExecution(config, executionId, options.input);
}

/** Reattach to a persisted worker execution without its original launch configuration. */
export async function attachWorkerDeployment(options: AttachWorkerDeploymentOptions): Promise<SandboxWorkerExecution> {
  if (!options.sandbox.executeCommand) {
    throw new Error(
      `Sandbox provider "${options.sandbox.provider}" does not support executeCommand, which is required for worker deploys.`,
    );
  }
  validateExecutionId(options.executionId);
  if (
    options.terminationGraceMs !== undefined &&
    (!Number.isFinite(options.terminationGraceMs) || options.terminationGraceMs <= 0)
  ) {
    throw new Error('terminationGraceMs must be greater than zero.');
  }

  let remoteDir: Promise<string> | undefined;
  const config: WorkerExecutionConfig = {
    sandbox: options.sandbox,
    resolveRemoteDir: () => (remoteDir ??= resolveRemoteDir(options.sandbox, options.remoteDir)),
    terminationGraceMs: options.terminationGraceMs ?? 5_000,
  };
  const info = await getInfoSafe(options.sandbox);
  return execution(config, options.executionId, info?.id ?? options.sandbox.id, info?.timeoutAt);
}

function validateOptions(options: DeployWorkerToSandboxOptions): void {
  if (!options.sandbox.executeCommand) {
    throw new Error(
      `Sandbox provider "${options.sandbox.provider}" does not support executeCommand, which is required for worker deploys.`,
    );
  }
  validateExecutionId(options.executionId);
  if (!options.command || /[\0\r\n]/.test(options.command)) {
    throw new Error('Worker command must be a non-empty executable path.');
  }
  if (options.args?.some(arg => arg.includes('\0'))) throw new Error('Worker arguments must not contain NUL bytes.');
  for (const key of Object.keys(options.env ?? {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid worker environment variable name: ${key}`);
  }
  validateRelativePath(options.workingDirectory ?? '.', 'workingDirectory');
  validateInput(options.input);
  for (const [name, value] of [
    ['inputLimitBytes', options.inputLimitBytes],
    ['startupTimeoutMs', options.startupTimeoutMs],
    ['executionTimeoutMs', options.executionTimeoutMs],
    ['terminationGraceMs', options.terminationGraceMs],
  ] as const) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0))
      throw new Error(`${name} must be greater than zero.`);
  }
  const resourceLimits = options.resourceLimits;
  if (resourceLimits) {
    const knownLimits = new Set(['cpuTimeSeconds', 'addressSpaceBytes', 'fileSizeBytes', 'openFiles']);
    for (const name of Object.keys(resourceLimits)) {
      if (!knownLimits.has(name)) throw new Error(`Unknown worker resource limit: ${name}.`);
    }
    for (const [name, value] of [
      ['cpuTimeSeconds', resourceLimits.cpuTimeSeconds],
      ['addressSpaceBytes', resourceLimits.addressSpaceBytes],
      ['fileSizeBytes', resourceLimits.fileSizeBytes],
      ['openFiles', resourceLimits.openFiles],
    ] as const) {
      if (value !== undefined && (!Number.isSafeInteger(value) || value <= 0)) {
        throw new Error(`Worker resourceLimits.${name} must be a positive safe integer.`);
      }
    }
  }
}

function validateRelativePath(value: string, label: string): void {
  if (!value || posix.isAbsolute(value) || posix.normalize(value).startsWith('..')) {
    throw new Error(`Worker ${label} must stay within the deployed artifact root.`);
  }
}

function validateInput(input: SandboxWorkerInput | undefined): void {
  if (input?.type === 'file') validateRelativePath(input.path, 'input file path');
}

function normalizeResourceLimits(
  limits: SandboxWorkerResourceLimits | undefined,
): NormalizedResourceLimits | undefined {
  if (!limits || Object.values(limits).every(value => value === undefined)) return undefined;
  return {
    cpuTimeSeconds: limits.cpuTimeSeconds,
    addressSpaceBytes: limits.addressSpaceBytes,
    addressSpaceKilobytes:
      limits.addressSpaceBytes === undefined ? undefined : Math.floor(limits.addressSpaceBytes / 1024),
    fileSizeBytes: limits.fileSizeBytes,
    fileSizeBlocks: limits.fileSizeBytes === undefined ? undefined : Math.floor(limits.fileSizeBytes / 512),
    openFiles: limits.openFiles,
  };
}

async function preflightResourceLimits(
  sandbox: WorkspaceSandbox,
  resourceLimits: NormalizedResourceLimits,
): Promise<void> {
  const checks: string[] = [];
  if (resourceLimits.cpuTimeSeconds !== undefined) {
    checks.push(`check_limit cpu_time -t ${resourceLimits.cpuTimeSeconds}`);
  }
  if (resourceLimits.addressSpaceKilobytes !== undefined) {
    checks.push(`check_limit address_space -v ${resourceLimits.addressSpaceKilobytes}`);
  }
  if (resourceLimits.fileSizeBlocks !== undefined) {
    checks.push(`check_limit file_size -f ${resourceLimits.fileSizeBlocks}`);
  }
  if (resourceLimits.openFiles !== undefined) {
    checks.push(`check_limit open_files -n ${resourceLimits.openFiles}`);
  }
  if (resourceLimits.cpuTimeSeconds !== undefined) {
    checks.push(`kill -l XCPU >/dev/null 2>&1 || fail cpu_signal`);
  }
  if (resourceLimits.fileSizeBytes !== undefined) {
    checks.push(`kill -l XFSZ >/dev/null 2>&1 || fail file_size_signal`);
  }

  const script = `
fail() {
  printf '${RESOURCE_CAPABILITY_PREFIX}%s\\n' "$1" >&2
  exit 1
}
check_limit() {
  capability="$1"
  flag="$2"
  value="$3"
  (
    ulimit -S "$flag" "$value" >/dev/null 2>&1 || exit 1
    ulimit -H "$flag" "$value" >/dev/null 2>&1 || exit 1
    [ "$(ulimit -S "$flag")" = "$value" ] || exit 1
    [ "$(ulimit -H "$flag")" = "$value" ] || exit 1
    if ulimit -H "$flag" "$((value + 1))" >/dev/null 2>&1; then exit 1; fi
  ) || fail "$capability"
}
[ "$(uname -s 2>/dev/null)" = Linux ] && [ -r /proc/self/stat ] || fail linux_proc
command -v setsid >/dev/null 2>&1 || fail process_groups
setsid sh -c 'kill -0 -$$ 2>/dev/null' || fail process_groups
${checks.join('\n')}
`;

  let result;
  try {
    result = await runInSandbox(sandbox, script, { allowFailure: true, label: 'preflight worker resource limits' });
  } catch (error) {
    throw new SandboxWorkerCapabilityError('sandbox_command', undefined, { cause: error });
  }
  if (result.exitCode === 0) return;

  const detail = `${result.stderr}\n${result.stdout}`;
  const match = detail.match(new RegExp(`${RESOURCE_CAPABILITY_PREFIX}([a-z_]+)`));
  const capability = (match?.[1] ?? 'sandbox_command') as SandboxWorkerResourceLimitCapability;
  throw new SandboxWorkerCapabilityError(capability, undefined, {
    cause: new Error(detail.trim() || 'Resource-limit preflight command failed.'),
  });
}

async function acquireLock(
  sandbox: WorkspaceSandbox,
  lock: string,
  timeout: number | undefined,
  label: string,
): Promise<void> {
  const timeoutMs = timeout ?? 600_000;
  const attempts = Math.max(1, Math.ceil(timeoutMs / 1000));
  await runInSandbox(
    sandbox,
    [
      'i=0',
      `while ! mkdir ${shellQuote(lock)} 2>/dev/null; do`,
      `  if [ "$i" -ge ${attempts} ]; then echo ${shellQuote(`${label} lock timeout`)} >&2; exit 1; fi`,
      '  sleep 1; i=$((i + 1))',
      'done',
    ].join('\n'),
    { timeout: timeoutMs, label: `acquire ${label} lock` },
  );
}

async function installDependencies(
  sandbox: WorkspaceSandbox,
  remoteDir: string,
  installHash: string | undefined,
  installCommand: string,
  timeout?: number,
): Promise<void> {
  if (!installHash) return;
  const marker = `${remoteDir}/${INSTALL_MARKER}`;
  const lock = `${remoteDir}/${INSTALL_LOCK}`;
  await acquireLock(sandbox, lock, timeout, 'dependency install');
  try {
    const script = [
      `current="$(cat ${shellQuote(marker)} 2>/dev/null || true)"`,
      `if [ "$current" != ${shellQuote(installHash)} ]; then`,
      `  cd ${shellQuote(remoteDir)} && ${installCommand}`,
      `  printf %s ${shellQuote(installHash)} > ${shellQuote(`${marker}.tmp`)}`,
      `  mv ${shellQuote(`${marker}.tmp`)} ${shellQuote(marker)}`,
      'fi',
    ].join('\n');
    await runInSandbox(sandbox, script, {
      timeout: timeout ?? 600_000,
      label: 'install worker dependencies',
    });
  } finally {
    await runInSandbox(sandbox, `rm -rf ${shellQuote(lock)}`, {
      allowFailure: true,
      label: 'release dependency install lock',
    });
  }
}

async function createExecution(
  config: WorkerConfig,
  executionId: string,
  input?: SandboxWorkerInput,
): Promise<SandboxWorkerDeployment> {
  validateExecutionId(executionId);
  const paths = executionPaths(config.remoteDir, executionId);
  await runInSandbox(
    config.sandbox,
    `mkdir -p ${shellQuote(`${config.remoteDir}/${RUNTIME_DIR}`)} && mkdir -m 700 ${shellQuote(paths.dir)}`,
    { label: 'create worker execution namespace' },
  );
  const stdinPath = await stageInput(config, paths, input);
  const script = buildExecutionScript(config, paths, stdinPath);
  await uploadFile(config.sandbox, paths.script, Buffer.from(script));
  await runInSandbox(config.sandbox, `chmod 700 ${shellQuote(paths.script)}`);

  try {
    await launchExecution(config.sandbox, paths);
  } catch (error) {
    await writeFailedStatus(config.sandbox, paths, executionId, 'launch', error);
    throw workerPhaseError('launch', error);
  }

  const resolvePaths = async () => paths;
  const startup = await waitForStartup(config, executionId, resolvePaths);
  if (startup.state === 'timed_out') await cancelExecution(config, executionId, resolvePaths, 'startup');
  if (startup.state === 'failed' || startup.state === 'timed_out' || startup.state === 'provider_unavailable') {
    throw new Error(
      `Worker ${startup.state} during startup${'message' in startup && startup.message ? `: ${startup.message}` : ''}.`,
    );
  }

  const info = await getInfoSafe(config.sandbox);
  return deployment(config, executionId, info?.id ?? config.sandbox.id ?? 'unknown', info?.timeoutAt);
}

function execution(
  config: WorkerExecutionConfig,
  executionId: string,
  sandboxId: string,
  expiresAt?: Date,
): SandboxWorkerExecution {
  const resolvePaths = async () => executionPaths(await config.resolveRemoteDir(), executionId);
  return {
    sandboxId,
    executionId,
    expiresAt,
    status: options => readWorkerStatus(config.sandbox, executionId, resolvePaths, options),
    readOutput: (stream, options) => readOutput(config.sandbox, executionId, resolvePaths, stream, options),
    cancel: () => cancelExecution(config, executionId, resolvePaths),
    stop: async () => {
      if (!config.sandbox.stop) throw new Error(`Sandbox provider "${config.sandbox.provider}" does not support stop.`);
      await config.sandbox.stop();
    },
    destroy: options => destroyWithRetry(config.sandbox, options),
  };
}

function deployment(
  config: WorkerConfig,
  executionId: string,
  sandboxId: string,
  expiresAt?: Date,
): SandboxWorkerDeployment {
  return {
    ...execution(config, executionId, sandboxId, expiresAt),
    relaunch: async options => {
      if (options.executionId === executionId) throw new Error('Relaunch requires a new executionId.');
      validateInput(options.input);
      return createExecution(config, options.executionId, options.input);
    },
  };
}

async function stageInput(
  config: WorkerConfig,
  paths: ReturnType<typeof executionPaths>,
  input?: SandboxWorkerInput,
): Promise<string | undefined> {
  if (!input) return undefined;
  const data = typeof input.data === 'string' ? Buffer.from(input.data) : Buffer.from(input.data);
  if (data.byteLength > config.inputLimitBytes) {
    throw new Error(`Worker input exceeds inputLimitBytes (${data.byteLength} > ${config.inputLimitBytes}).`);
  }
  const path = input.type === 'stdin' ? paths.stdin : posix.resolve(config.remoteDir, input.path);
  await uploadFile(config.sandbox, path, data);
  await runInSandbox(config.sandbox, `chmod 600 ${shellQuote(path)}`);
  return input.type === 'stdin' ? path : undefined;
}

function buildExecutionScript(
  config: WorkerConfig,
  paths: ReturnType<typeof executionPaths>,
  stdinPath?: string,
): string {
  const cwd = posix.resolve(config.remoteDir, config.workingDirectory);
  const envPrefix = Object.entries(config.env)
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(' ');
  const executable = [shellQuote(config.command), ...config.args.map(shellQuote)].join(' ');
  const target = `${envPrefix ? `env ${envPrefix} ` : ''}${executable}`;
  const limitCommands: string[] = [];
  if (config.resourceLimits?.cpuTimeSeconds !== undefined) {
    limitCommands.push(`ulimit -S -t ${config.resourceLimits.cpuTimeSeconds}`);
    limitCommands.push(`ulimit -H -t ${config.resourceLimits.cpuTimeSeconds}`);
  }
  if (config.resourceLimits?.addressSpaceKilobytes !== undefined) {
    limitCommands.push(`ulimit -S -v ${config.resourceLimits.addressSpaceKilobytes}`);
    limitCommands.push(`ulimit -H -v ${config.resourceLimits.addressSpaceKilobytes}`);
  }
  if (config.resourceLimits?.fileSizeBlocks !== undefined) {
    limitCommands.push(`ulimit -S -f ${config.resourceLimits.fileSizeBlocks}`);
    limitCommands.push(`ulimit -H -f ${config.resourceLimits.fileSizeBlocks}`);
  }
  if (config.resourceLimits?.openFiles !== undefined) {
    limitCommands.push(`ulimit -S -n ${config.resourceLimits.openFiles}`);
    limitCommands.push(`ulimit -H -n ${config.resourceLimits.openFiles}`);
  }
  const workload = config.resourceLimits
    ? `${limitCommands.map(command => `${command} || exit 125`).join('\n')}\nexec ${target}`
    : `exec ${target}`;
  const graceAttempts = Math.max(1, Math.ceil(config.terminationGraceMs / 1000));
  const state = (value: string) =>
    `tmp=${shellQuote(`${paths.status}.tmp.$$`)}; printf '%s\\n' ${shellQuote(value)} > "$tmp"; mv "$tmp" ${shellQuote(paths.status)};`;
  const normalExitStatus = `signal=''; if [ "$code" -gt 128 ]; then signal="SIG$((code - 128))"; fi; tmp=${shellQuote(
    `${paths.status}.tmp.$$`,
  )}; printf 'exited|%s|%s|%s\\n' "$execution_id" "$code" "$signal" > "$tmp"; mv "$tmp" ${shellQuote(paths.status)};`;
  const resourceExitBranches: string[] = [];
  if (config.resourceLimits?.cpuTimeSeconds !== undefined) {
    resourceExitBranches.push(
      `if xcpu="$(kill -l XCPU 2>/dev/null)" && [ -n "$xcpu" ] && [ "$code" -eq $((128 + xcpu)) ]; then ${state(
        `resource_exhausted|${paths.executionId}|cpu|${config.resourceLimits.cpuTimeSeconds}|SIGXCPU`,
      )}`,
    );
  }
  if (config.resourceLimits?.fileSizeBytes !== undefined) {
    resourceExitBranches.push(
      `${resourceExitBranches.length ? 'elif' : 'if'} xfsz="$(kill -l XFSZ 2>/dev/null)" && [ -n "$xfsz" ] && [ "$code" -eq $((128 + xfsz)) ]; then ${state(
        `resource_exhausted|${paths.executionId}|file_size|${config.resourceLimits.fileSizeBytes}|SIGXFSZ`,
      )}`,
    );
  }
  const resourceExitStatus = resourceExitBranches.length
    ? `${resourceExitBranches.join(' ')} else ${normalExitStatus} fi`
    : normalExitStatus;

  return [
    '#!/bin/sh',
    `cd ${shellQuote(cwd)}`,
    `execution_id=${shellQuote(paths.executionId)}`,
    `stdout=${shellQuote(paths.stdout)}`,
    `stderr=${shellQuote(paths.stderr)}`,
    `pidfile=${shellQuote(paths.pid)}`,
    `tokenfile=${shellQuote(paths.pidToken)}`,
    `: > "$stdout"; : > "$stderr"`,
    state(`starting|${paths.executionId}`),
    `setsid sh -c ${shellQuote(`${workload}${stdinPath ? ` < ${shellQuote(stdinPath)}` : ''}`)} > "$stdout" 2> "$stderr" &`,
    'child=$!',
    'printf %s "$child" > "$pidfile"',
    `if [ -r "/proc/$child/stat" ]; then awk '{print $22}' "/proc/$child/stat" > "$tokenfile"; else : > "$tokenfile"; fi`,
    state(`running|${paths.executionId}`),
    'cancelled=0',
    `trap 'cancelled=1; kill -TERM -"$child" 2>/dev/null || kill -TERM "$child" 2>/dev/null || true' TERM INT`,
    ...(config.executionTimeoutMs
      ? [
          `(sleep ${Math.max(1, Math.ceil(config.executionTimeoutMs / 1000))}; if kill -0 "$child" 2>/dev/null; then ${state(
            `timed_out|${paths.executionId}|execution`,
          )} kill -TERM -"$child" 2>/dev/null || kill -TERM "$child" 2>/dev/null || true; i=0; while kill -0 "$child" 2>/dev/null && [ "$i" -lt ${graceAttempts} ]; do sleep 1; i=$((i + 1)); done; kill -KILL -"$child" 2>/dev/null || kill -KILL "$child" 2>/dev/null || true; fi) &`,
          'watchdog=$!',
        ]
      : []),
    'wait "$child"',
    'code=$?',
    ...(config.executionTimeoutMs ? ['kill "$watchdog" 2>/dev/null || true'] : []),
    `current="$(cat ${shellQuote(paths.status)} 2>/dev/null || true)"`,
    `case "$current" in timed_out*) ;; *) if [ "$cancelled" -eq 1 ]; then ${state(
      `cancelled|${paths.executionId}|TERM`,
    )} else ${resourceExitStatus} fi ;; esac`,
    'rm -f "$pidfile" "$tokenfile"',
    'exit "$code"',
  ].join('\n');
}

async function launchExecution(sandbox: WorkspaceSandbox, paths: ReturnType<typeof executionPaths>): Promise<void> {
  await runInSandbox(sandbox, `setsid nohup sh ${shellQuote(paths.script)} >/dev/null 2>&1 & echo $!`, {
    label: 'launch worker execution',
  });
}

async function waitForStartup(
  config: WorkerConfig,
  executionId: string,
  resolvePaths: () => Promise<ReturnType<typeof executionPaths>>,
): Promise<SandboxWorkerStatus> {
  const deadline = Date.now() + config.startupTimeoutMs;
  while (Date.now() < deadline) {
    const status = await readWorkerStatus(config.sandbox, executionId, resolvePaths);
    if (status.state !== 'unknown' && status.state !== 'starting') return status;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return { state: 'timed_out', executionId, phase: 'startup' };
}

async function readWorkerStatus(
  sandbox: WorkspaceSandbox,
  executionId: string,
  resolvePaths: () => Promise<ReturnType<typeof executionPaths>>,
  options?: { wake?: boolean },
): Promise<SandboxWorkerStatus> {
  const providerState = sandbox.status;
  if (providerState === 'destroyed' || providerState === 'destroying') {
    return { state: 'provider_unavailable', executionId, providerState };
  }
  if (providerState === 'stopped' || providerState === 'stopping') {
    if (!options?.wake || !sandbox.start) return { state: 'provider_unavailable', executionId, providerState };
    try {
      await sandbox.start();
    } catch (error) {
      return { state: 'provider_unavailable', executionId, providerState, message: errorMessage(error) };
    }
  }

  try {
    const paths = await resolvePaths();
    const result = await runInSandbox(
      sandbox,
      [
        `status="$(cat ${shellQuote(paths.status)} 2>/dev/null || true)"`,
        `if [ -f ${shellQuote(paths.pid)} ]; then`,
        `  pid="$(cat ${shellQuote(paths.pid)})"`,
        `  expected="$(cat ${shellQuote(paths.pidToken)} 2>/dev/null || true)"`,
        `  actual="$(if [ -r "/proc/$pid/stat" ]; then awk '{print $22}' "/proc/$pid/stat"; fi)"`,
        `  if kill -0 "$pid" 2>/dev/null && { [ -z "$expected" ] || [ "$expected" = "$actual" ]; }; then echo "running|${executionId}"; exit 0; fi`,
        `  if kill -0 "$pid" 2>/dev/null; then echo "stale|${executionId}"; exit 0; fi`,
        'fi',
        `if [ -n "$status" ]; then printf '%s\\n' "$status"; else echo "unknown|${executionId}"; fi`,
      ].join('\n'),
      { allowFailure: true, label: 'read worker status' },
    );
    if (result.exitCode !== 0) {
      return {
        state: 'provider_unavailable',
        executionId,
        providerState: sandbox.status,
        message: result.stderr || result.stdout || 'Sandbox status inspection failed.',
      };
    }
    return parseStatus(executionId, result.stdout.trim());
  } catch (error) {
    return { state: 'provider_unavailable', executionId, providerState: sandbox.status, message: errorMessage(error) };
  }
}

function parseStatus(executionId: string, value: string): SandboxWorkerStatus {
  const [state, recordedId, first, second, third] = value.split('|');
  if (recordedId !== executionId || state === 'stale') return { state: 'unknown', executionId };
  if (state === 'starting') return { state, executionId };
  if (state === 'running') return { state, executionId };
  if (state === 'exited') {
    const exitCode = Number(first);
    return Number.isInteger(exitCode)
      ? { state, executionId, exitCode, ...(second ? { signal: second } : {}) }
      : { state: 'unknown', executionId };
  }
  if (state === 'resource_exhausted') {
    const limit = Number(second);
    if (first === 'cpu' && Number.isSafeInteger(limit) && limit > 0 && third === 'SIGXCPU') {
      return { state, executionId, resource: first, limit, signal: third };
    }
    if (first === 'file_size' && Number.isSafeInteger(limit) && limit > 0 && third === 'SIGXFSZ') {
      return { state, executionId, resource: first, limit, signal: third };
    }
    return { state: 'unknown', executionId };
  }
  if (state === 'cancelled') return { state, executionId, ...(first ? { signal: first } : {}) };
  if (state === 'timed_out' && (first === 'startup' || first === 'execution')) {
    return { state, executionId, phase: first };
  }
  if (state === 'failed' && (first === 'upload' || first === 'install' || first === 'launch')) {
    return { state, executionId, phase: first, message: second ?? '' };
  }
  return { state: 'unknown', executionId };
}

async function cancelExecution(
  config: WorkerExecutionConfig,
  executionId: string,
  resolvePaths: () => Promise<ReturnType<typeof executionPaths>>,
  timeoutPhase?: 'startup',
): Promise<SandboxWorkerStatus> {
  const current = await readWorkerStatus(config.sandbox, executionId, resolvePaths);
  if (current.state !== 'running' && current.state !== 'starting') return current;
  const paths = await resolvePaths();
  const attempts = Math.max(1, Math.ceil(config.terminationGraceMs / 1000));
  const terminal = timeoutPhase ? `timed_out|${executionId}|startup` : `cancelled|${executionId}|TERM`;
  await runInSandbox(
    config.sandbox,
    [
      `pid="$(cat ${shellQuote(paths.pid)} 2>/dev/null || true)"`,
      '[ -n "$pid" ] || exit 0',
      `expected="$(cat ${shellQuote(paths.pidToken)} 2>/dev/null || true)"`,
      `actual="$(if [ -r "/proc/$pid/stat" ]; then awk '{print $22}' "/proc/$pid/stat"; fi)"`,
      '[ -n "$expected" ] && [ "$expected" != "$actual" ] && exit 0',
      'kill -TERM -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true',
      `i=0; while kill -0 "$pid" 2>/dev/null && [ "$i" -lt ${attempts} ]; do sleep 1; i=$((i + 1)); done`,
      'kill -KILL -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true',
      `tmp=${shellQuote(`${paths.status}.tmp.$$`)}; printf '%s\\n' ${shellQuote(terminal)} > "$tmp"; mv "$tmp" ${shellQuote(paths.status)}`,
      `rm -f ${shellQuote(paths.pid)} ${shellQuote(paths.pidToken)}`,
    ].join('\n'),
    { allowFailure: true, timeout: config.terminationGraceMs + 5_000, label: 'cancel worker execution' },
  );
  return parseStatus(executionId, terminal);
}

async function readOutput(
  sandbox: WorkspaceSandbox,
  executionId: string,
  resolvePaths: () => Promise<ReturnType<typeof executionPaths>>,
  stream: 'stdout' | 'stderr',
  options?: { offset?: number; maxBytes?: number },
): Promise<SandboxWorkerOutput> {
  const offset = Math.max(0, Math.floor(options?.offset ?? 0));
  const maxBytes = Math.max(1, Math.floor(options?.maxBytes ?? DEFAULT_OUTPUT_READ_LIMIT));
  try {
    const paths = await resolvePaths();
    const path = stream === 'stdout' ? paths.stdout : paths.stderr;
    const result = await runInSandbox(
      sandbox,
      `size=$(wc -c < ${shellQuote(path)} 2>/dev/null || echo 0); printf '%s\\n' "$size"; tail -c +${offset + 1} ${shellQuote(
        path,
      )} 2>/dev/null | head -c ${maxBytes} | base64`,
      { allowFailure: true, label: `read worker ${stream}` },
    );
    if (result.exitCode !== 0) throw new Error(result.stderr || result.stdout || `Unable to read worker ${stream}.`);
    const newline = result.stdout.indexOf('\n');
    const totalBytes = Number((newline === -1 ? result.stdout : result.stdout.slice(0, newline)).trim()) || 0;
    const encoded = newline === -1 ? '' : result.stdout.slice(newline + 1).replace(/\s/g, '');
    const data = Buffer.from(encoded, 'base64');
    const nextOffset = offset + data.byteLength;
    const status = await readWorkerStatus(sandbox, executionId, resolvePaths);
    const terminal = ['exited', 'resource_exhausted', 'cancelled', 'timed_out', 'failed'].includes(status.state);
    const interrupted = status.state === 'provider_unavailable' || status.state === 'unknown';
    return {
      stream,
      data,
      offset,
      nextOffset,
      totalBytes,
      eof: terminal && nextOffset >= totalBytes,
      truncated: nextOffset < totalBytes,
      interrupted,
    };
  } catch {
    return {
      stream,
      data: new Uint8Array(),
      offset,
      nextOffset: offset,
      totalBytes: offset,
      eof: false,
      truncated: false,
      interrupted: true,
    };
  }
}

async function destroyWithRetry(
  sandbox: WorkspaceSandbox,
  options?: { attempts?: number; delayMs?: number },
): Promise<SandboxDestroyResult> {
  if (!sandbox.destroy) return { state: 'unsupported', attempts: 0 };
  const attempts = Math.max(1, Math.floor(options?.attempts ?? 3));
  const delayMs = Math.max(0, Math.floor(options?.delayMs ?? 250));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await sandbox.destroy();
      return { state: 'destroyed', attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  return { state: 'exhausted', attempts, error: lastError };
}

async function writeFailedStatus(
  sandbox: WorkspaceSandbox,
  paths: ReturnType<typeof executionPaths>,
  executionId: string,
  phase: 'upload' | 'install' | 'launch',
  error: unknown,
): Promise<void> {
  await writeStatus(
    sandbox,
    paths.status,
    `failed|${executionId}|${phase}|${sanitizeStatusValue(errorMessage(error))}`,
  );
}

async function writeStatus(sandbox: WorkspaceSandbox, path: string, value: string): Promise<void> {
  await runInSandbox(
    sandbox,
    `tmp=${shellQuote(`${path}.tmp.$$`)}; printf '%s\\n' ${shellQuote(value)} > "$tmp"; mv "$tmp" ${shellQuote(path)}`,
    { allowFailure: true, label: 'write worker status' },
  );
}

function executionPaths(remoteDir: string, executionId: string) {
  const dir = `${remoteDir}/${RUNTIME_DIR}/${executionId}`;
  return {
    executionId,
    dir,
    script: `${dir}/launch.sh`,
    pid: `${dir}/pid`,
    pidToken: `${dir}/pid-start`,
    status: `${dir}/status`,
    stdin: `${dir}/stdin`,
    stdout: `${dir}/stdout`,
    stderr: `${dir}/stderr`,
  };
}

function validateExecutionId(executionId: string): void {
  if (!executionId || !EXECUTION_ID_PATTERN.test(executionId)) {
    throw new Error('Worker executionId must contain only letters, numbers, dots, underscores, and hyphens.');
  }
}

function workerPhaseError(phase: 'upload' | 'install' | 'launch', error: unknown): Error {
  return new Error(`Worker ${phase} failed: ${errorMessage(error)}`, { cause: error });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sanitizeStatusValue(value: string): string {
  return value.replace(/[|\r\n]/g, ' ').slice(0, 500);
}

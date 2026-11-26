import { DockerSandbox } from '@mastra/docker';
import { randomUUID } from 'node:crypto';
import { pack } from 'tar-stream';
import { RuntimeDiagnostic, type Settings } from '../config/settings.js';
import { inspectOwnedImage, ownerIdentity, OWNER_LABEL, RUN_LABEL, type ImageReceipt } from './docker.js';
import { inspectAppliedPolicy, loadSandboxPolicy } from './seccomp.js';
import { BROWSER_FLAGS, parseBrowserSandboxStatus } from './browser.js';

export function sandboxOptions(settings: Settings, receipt: ImageReceipt, id: string) {
  const memory = settings.SANDBOX_MEMORY_MIB * 1024 * 1024;
  return {
    id,
    name: id,
    image: receipt.imageId,
    command: ['sleep', 'infinity'],
    network: 'none',
    privileged: false,
    memory,
    memorySwap: memory,
    cpuPeriod: 100_000,
    cpuQuota: 100_000,
    pidsLimit: settings.SANDBOX_PIDS,
    init: true,
    // Native archive writes into tmpfs can be invisible to container exec.
    // Stage files in the owned ephemeral layer; browser temp mounts stay bounded.
    readonlyRootfs: false,
    capDrop: ['ALL'],
    securityOpt: ['no-new-privileges:true', `seccomp=${loadSandboxPolicy(settings).serialized}`],
    tmpfs: {
      '/tmp': 'rw,nosuid,nodev,size=134217728,mode=1777',
      '/dev/shm': 'rw,nosuid,nodev,noexec,size=134217728,mode=1777',
    },
    ulimits: [{ name: 'nofile', soft: 1024, hard: 1024 }],
    workingDirectory: '/workspace',
    timeout: settings.COMMAND_TIMEOUT_MS,
    dockerOptions: { socketPath: settings.DOCKER_SOCKET, timeout: 30_000 },
    labels: { [OWNER_LABEL]: ownerIdentity(settings), [RUN_LABEL]: id },
  };
}

async function stagePrivateHeader(sandbox: DockerSandbox, signal: AbortSignal) {
  const archive = pack();
  const content = Buffer.from(`X-Scanner-Probe: ${randomUUID()}\n`);
  archive.entry({ name: 'probe-headers', mode: 0o600, uid: 10001, gid: 10001, size: content.length }, content);
  archive.finalize();
  const abort = () => archive.destroy();
  signal.addEventListener('abort', abort, { once: true });
  try {
    // DockerSandbox exposes its native container for provider-specific controls.
    // copyUIDGID applies the image's nonroot user, unlike writeFiles' default tar ownership.
    await sandbox.container.putArchive(archive as unknown as NodeJS.ReadableStream, {
      path: '/workspace',
      copyUIDGID: true,
      abortSignal: signal,
    });
  } finally {
    signal.removeEventListener('abort', abort);
    archive.destroy();
    content.fill(0);
  }
}

/** Probe the owned runtime for the required namespace, process and browser controls. */
export async function probeSandbox(settings: Settings, receipt: ImageReceipt, abortSignal?: AbortSignal) {
  abortSignal?.throwIfAborted();
  const image = await inspectOwnedImage(settings, receipt.imageId, receipt.sourceHash);
  if (image.Id !== receipt.imageId || image.Config.User !== '10001:10001') {
    throw new RuntimeDiagnostic(
      'IMAGE_MISMATCH',
      'The managed image must use its recorded immutable ID and nonroot user.',
    );
  }
  const id = `security-scanner-probe-${randomUUID()}`;
  const sandbox = new DockerSandbox(sandboxOptions(settings, receipt, id));
  const executeCommand = sandbox.executeCommand?.bind(sandbox);
  if (!executeCommand)
    throw new RuntimeDiagnostic(
      'COMMAND_UNAVAILABLE',
      'The native sandbox does not support bounded command execution.',
    );
  const signal = AbortSignal.any([AbortSignal.timeout(120_000), ...(abortSignal ? [abortSignal] : [])]);
  /** Execute a bounded sandbox probe and reject unsuccessful or incomplete command output. */
  const command = async (executable: string, args: string[], maximumBytes = settings.OUTPUT_LIMIT_BYTES) => {
    const result = await executeCommand(executable, args, {
      timeout: settings.COMMAND_TIMEOUT_MS,
      abortSignal: signal,
      maxRetainedBytes: maximumBytes,
    });
    if (!result.success || result.timedOut || result.killed) {
      throw new RuntimeDiagnostic(
        'CAPABILITY_UNAVAILABLE',
        `Fixed probe ${executable} failed (exit=${result.exitCode}, timedOut=${Boolean(result.timedOut)}, killed=${Boolean(result.killed)}): ${result.stderr.replace(/[^\x20-\x7e]/g, ' ').slice(0, 512) || 'no stderr'}. Unsafe browser flags are not enabled.`,
      );
    }
    return result;
  };
  let failure: unknown;
  try {
    await sandbox.start({ abortSignal: signal });
    const inspection = await sandbox.container.inspect();
    const appliedPolicySha256 = inspectAppliedPolicy(inspection.HostConfig.SecurityOpt);
    if (
      inspection.Config.Labels[OWNER_LABEL] !== ownerIdentity(settings) ||
      inspection.Config.Labels[RUN_LABEL] !== id ||
      inspection.Image !== receipt.imageId ||
      inspection.Config.User !== '10001:10001' ||
      inspection.HostConfig.NetworkMode !== 'none' ||
      inspection.HostConfig.Privileged ||
      !inspection.HostConfig.CapDrop?.includes('ALL') ||
      !inspection.HostConfig.SecurityOpt?.includes('no-new-privileges:true') ||
      inspection.HostConfig.Memory !== settings.SANDBOX_MEMORY_MIB * 1024 * 1024 ||
      inspection.HostConfig.MemorySwap !== inspection.HostConfig.Memory ||
      inspection.HostConfig.PidsLimit !== settings.SANDBOX_PIDS
    )
      throw new RuntimeDiagnostic('SANDBOX_MISMATCH', 'The sandbox does not match the owned immutable runtime.');

    await sandbox.writeFiles([{ path: '/workspace/public-probe', content: 'scanner-runtime-ready\n', mode: 0o644 }], {
      abortSignal: signal,
    });
    const harmless = await command('cat', ['/workspace/public-probe']);
    if (harmless.stdout.trim() !== 'scanner-runtime-ready')
      throw new RuntimeDiagnostic('CAPABILITY_UNAVAILABLE', 'The native file/command probe did not complete.');
    await stagePrivateHeader(sandbox, signal);
    const permissions = await command('stat', ['-c', '%a:%u:%g', '/workspace/probe-headers']);
    await command('test', ['-r', '/workspace/probe-headers']);
    if (permissions.stdout.trim() !== '600:10001:10001')
      throw new RuntimeDiagnostic(
        'PRIVATE_FILE_UNAVAILABLE',
        'The sandbox did not provision a readable private header file.',
      );

    const version = await command('katana', ['-version']);
    if (!/1\.8\.0/.test(version.stdout + version.stderr))
      throw new RuntimeDiagnostic('KATANA_VERSION_MISMATCH', 'The pinned image did not report Katana 1.8.0.');
    const help = await command('katana', ['-h'], 65536);
    if (help.stdoutTruncated || help.stderrTruncated)
      throw new RuntimeDiagnostic('KATANA_HELP_LIMIT', 'Katana help exceeded the finite capability inspection bound.');
    if (
      !['-headers', '-jsonl', '-headless', '-proxy', '-disable-update-check'].every(flag =>
        (help.stdout + help.stderr).includes(flag),
      )
    ) {
      throw new RuntimeDiagnostic(
        'KATANA_FLAGS_UNAVAILABLE',
        'The pinned Katana runtime lacks required discovery flags.',
      );
    }
    const browser = await command('scanner-chromium', [...BROWSER_FLAGS, '--dump-dom', 'about:blank']);
    if (!browser.stdout.includes('<html'))
      throw new RuntimeDiagnostic(
        'BROWSER_UNAVAILABLE',
        'Chromium did not render the harmless offline page with its sandbox enabled.',
      );
    const sandboxStatus = await command(
      'scanner-chromium',
      [...BROWSER_FLAGS, '--allow-chrome-scheme-url', '--dump-dom', 'chrome://sandbox'],
      65536,
    );
    if (sandboxStatus.stdoutTruncated || sandboxStatus.stderrTruncated) {
      throw new RuntimeDiagnostic(
        'BROWSER_STATUS_LIMIT',
        'Chromium sandbox status exceeded the finite inspection bound.',
      );
    }
    const browserSandboxStatus = parseBrowserSandboxStatus(sandboxStatus.stdout);
    let streamedBytes = 0;
    const bounded = await executeCommand('head', ['-c', '131072', '/dev/zero'], {
      timeout: settings.COMMAND_TIMEOUT_MS,
      abortSignal: signal,
      maxRetainedBytes: settings.OUTPUT_LIMIT_BYTES,
      onStdout: chunk => {
        streamedBytes += Buffer.byteLength(chunk);
      },
    });
    if (
      !bounded.success ||
      !bounded.stdoutTruncated ||
      Buffer.byteLength(bounded.stdout) > settings.OUTPUT_LIMIT_BYTES
    ) {
      throw new RuntimeDiagnostic(
        'OUTPUT_BOUND_UNAVAILABLE',
        'The native command output retention bound was not enforced.',
      );
    }
    const stats = await sandbox.container.stats({ stream: false });
    return {
      sandboxId: id,
      containerId: inspection.Id,
      imageId: inspection.Image,
      user: inspection.Config.User,
      network: inspection.HostConfig.NetworkMode,
      memoryLimitBytes: inspection.HostConfig.Memory,
      memorySwapBytes: inspection.HostConfig.MemorySwap,
      cpuQuota: inspection.HostConfig.CpuQuota,
      cpuPeriod: inspection.HostConfig.CpuPeriod,
      pidsLimit: inspection.HostConfig.PidsLimit,
      privileged: inspection.HostConfig.Privileged,
      readonlyRootfs: inspection.HostConfig.ReadonlyRootfs,
      capDrop: inspection.HostConfig.CapDrop,
      noNewPrivileges: inspection.HostConfig.SecurityOpt?.includes('no-new-privileges:true') === true,
      appliedPolicySha256,
      mounts: inspection.HostConfig.Tmpfs,
      memoryUsageBytes: stats.memory_stats.usage,
      privateFileMode: 0o600,
      privateFileReadable: true,
      katanaVersion: '1.8.0',
      browserSandboxEnabled: true,
      browserSandboxStatus,
      retainedOutputBytes: Buffer.byteLength(bounded.stdout),
      streamedBytes,
      outputTruncated: bounded.stdoutTruncated,
    };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    try {
      // SDK destroy awaits owned container removal, including tmpfs secrets.
      await sandbox.destroy();
    } catch {
      throw new RuntimeDiagnostic(
        'SANDBOX_CLEANUP_FAILED',
        `Owned sandbox ${id} needs cleanup${failure ? ' after a failed probe' : ''}. Retry removal of this sandbox only.`,
      );
    }
  }
}

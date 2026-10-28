import Docker from 'dockerode';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { IMAGE_OWNER, KATANA_BASE, RuntimeDiagnostic, type Settings } from '../config/settings.js';
import { loadSandboxPolicy } from './seccomp.js';

export const OWNER_LABEL = 'dev.mastra.security-scanner.owner';
export const INPUT_LABEL = 'dev.mastra.security-scanner.input';
export const RUN_LABEL = 'dev.mastra.security-scanner.run';

export function dockerClient(settings: Settings) {
  return new Docker({ socketPath: settings.DOCKER_SOCKET, timeout: 30_000 });
}

export function ownerIdentity(settings: Settings) {
  return `${IMAGE_OWNER}-${createHash('sha256').update(settings.root).digest('hex').slice(0, 16)}`;
}

export async function preflight(settings: Settings) {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new RuntimeDiagnostic('UNSUPPORTED_NODE', 'Select the Node version in .nvmrc before running this template.');
  }
  const policy = loadSandboxPolicy(settings);
  let info;
  try {
    info = await dockerClient(settings).info();
  } catch {
    throw new RuntimeDiagnostic(
      'DOCKER_UNAVAILABLE',
      'Start Docker and check DOCKER_SOCKET points to an accessible local Unix socket.',
    );
  }
  const architecture =
    info.Architecture === 'aarch64' ? 'arm64' : info.Architecture === 'x86_64' ? 'amd64' : info.Architecture;
  if (info.OSType !== 'linux' || settings.DOCKER_PLATFORM !== `linux/${architecture}`) {
    throw new RuntimeDiagnostic(
      'UNSUPPORTED_PLATFORM',
      'DOCKER_PLATFORM must match the native Linux Docker daemon architecture; emulation is not enabled.',
    );
  }
  return {
    dockerVersion: info.ServerVersion,
    platform: settings.DOCKER_PLATFORM,
    nodeVersion: process.versions.node,
    sandboxPolicySha256: policy.policySha256,
  };
}

export const imageReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  imageId: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  source: z.literal(KATANA_BASE),
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  platform: z.enum(['linux/arm64', 'linux/amd64']),
  owner: z.string(),
  sizeBytes: z.number().positive(),
});

export type ImageReceipt = z.infer<typeof imageReceiptSchema>;

export async function inspectOwnedImage(settings: Settings, imageId: string, sourceHash?: string) {
  let image;
  try {
    image = await dockerClient(settings).getImage(imageId).inspect();
  } catch {
    throw new RuntimeDiagnostic('IMAGE_UNAVAILABLE', 'Run npm run setup to build the managed local image.');
  }
  if (
    image.Config.Labels?.[OWNER_LABEL] !== ownerIdentity(settings) ||
    (sourceHash !== undefined && image.Config.Labels?.[INPUT_LABEL] !== sourceHash) ||
    `${image.Os}/${image.Architecture}` !== settings.DOCKER_PLATFORM
  ) {
    throw new RuntimeDiagnostic(
      'IMAGE_MISMATCH',
      'The image is not the managed build for this installation and platform.',
    );
  }
  return image;
}

async function build(settings: Settings, sourceHash: string, runId: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'build',
        '--network=none',
        '--pull=false',
        '--platform',
        settings.DOCKER_PLATFORM,
        '--label',
        `${OWNER_LABEL}=${ownerIdentity(settings)}`,
        '--label',
        `${INPUT_LABEL}=${sourceHash}`,
        '--label',
        `${RUN_LABEL}=${runId}`,
        '--tag',
        settings.DOCKER_DISCOVERY_IMAGE,
        join(settings.root, 'docker', 'discovery'),
      ],
      {
        shell: false,
        detached: true,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          DOCKER_CONFIG: process.env.DOCKER_CONFIG,
          DOCKER_HOST: `unix://${settings.DOCKER_SOCKET}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let bytes = 0;
    let failure: RuntimeDiagnostic | undefined;
    const stop = (code: string, message: string) => {
      failure ??= new RuntimeDiagnostic(code, message);
      if (child.pid) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') reject(failure);
        }
      }
    };
    const abort = () => stop('SETUP_CANCELLED', 'Setup was cancelled; owned resources are being cleaned up.');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(
      () => stop('BUILD_TIMEOUT', 'The local image build exceeded ten minutes. Check Docker and retry.'),
      600_000,
    );
    const count = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 8 * 1024 * 1024) stop('BUILD_OUTPUT_LIMIT', 'The local build exceeded its diagnostic output budget.');
    };
    child.stdout.on('data', count);
    child.stderr.on('data', count);
    child.on('error', () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new RuntimeDiagnostic('BUILD_UNAVAILABLE', 'Install the Docker CLI and ensure it is on PATH.'));
    });
    child.on('close', code => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      if (failure) reject(failure);
      else if (code !== 0)
        reject(
          new RuntimeDiagnostic(
            'BUILD_FAILED',
            'Docker could not build the pinned local image. Check registry access and Docker build support.',
          ),
        );
      else resolve();
    });
  });
}

export async function buildLocalImage(settings: Settings, signal?: AbortSignal): Promise<ImageReceipt> {
  signal?.throwIfAborted();
  const dockerfile = await readFile(join(settings.root, 'docker', 'discovery', 'Dockerfile'), 'utf8');
  if (!dockerfile.startsWith(`FROM ${KATANA_BASE}\n`)) {
    throw new RuntimeDiagnostic(
      'BUILD_INPUT_MISMATCH',
      'Restore the reviewed immutable Katana base in docker/discovery/Dockerfile.',
    );
  }
  const sourceHash = createHash('sha256').update(dockerfile).update(settings.DOCKER_PLATFORM).digest('hex');
  const client = dockerClient(settings);
  try {
    await client.getImage(settings.DOCKER_DISCOVERY_IMAGE).inspect();
    const image = await inspectOwnedImage(settings, settings.DOCKER_DISCOVERY_IMAGE, sourceHash);
    return imageReceiptSchema.parse({
      schemaVersion: 1,
      imageId: image.Id,
      source: KATANA_BASE,
      sourceHash,
      platform: settings.DOCKER_PLATFORM,
      owner: ownerIdentity(settings),
      sizeBytes: image.Size,
    });
  } catch (error) {
    if (error instanceof RuntimeDiagnostic) throw error;
    if ((error as { statusCode?: number }).statusCode !== 404) {
      throw new RuntimeDiagnostic('IMAGE_INSPECTION_FAILED', 'Cannot inspect the local image. Check Docker access.');
    }
  }
  const runId = randomUUID();
  try {
    await build(settings, sourceHash, runId, signal);
  } catch (error) {
    try {
      const partial = await client.getImage(settings.DOCKER_DISCOVERY_IMAGE).inspect();
      if (
        partial.Config.Labels?.[OWNER_LABEL] === ownerIdentity(settings) &&
        partial.Config.Labels?.[RUN_LABEL] === runId
      ) {
        await client.getImage(partial.Id).remove({ force: false, noprune: true });
      }
    } catch (cleanupError) {
      if ((cleanupError as { statusCode?: number }).statusCode !== 404)
        throw new RuntimeDiagnostic(
          'BUILD_CLEANUP_FAILED',
          'A cancelled build may retain an owned image. Inspect the managed image before retrying.',
        );
    }
    throw error;
  }
  const image = await inspectOwnedImage(settings, settings.DOCKER_DISCOVERY_IMAGE, sourceHash);
  return imageReceiptSchema.parse({
    schemaVersion: 1,
    imageId: image.Id,
    source: KATANA_BASE,
    sourceHash,
    platform: settings.DOCKER_PLATFORM,
    owner: ownerIdentity(settings),
    sizeBytes: image.Size,
  });
}

export async function reconcileOwnedSandboxes(settings: Settings) {
  const client = dockerClient(settings);
  const containers = await client.listContainers({
    all: true,
    filters: { label: [`${OWNER_LABEL}=${ownerIdentity(settings)}`] },
  });
  for (const container of containers) {
    if (!/^security-scanner-probe-[a-f0-9-]{36}$/.test(container.Labels[RUN_LABEL] ?? '')) continue;
    try {
      await client.getContainer(container.Id).remove({ force: true, v: false });
    } catch {
      throw new RuntimeDiagnostic(
        'SANDBOX_CLEANUP_FAILED',
        'A previous owned probe could not be removed. Check Docker access and retry setup.',
      );
    }
  }
}

export async function releaseImage(settings: Settings, receipt: ImageReceipt) {
  if (settings.DOCKER_RETAIN_SHARED_BASE_IMAGE) return 'retained' as const;
  const client = dockerClient(settings);
  const image = await inspectOwnedImage(settings, receipt.imageId, receipt.sourceHash);
  const users = await client.listContainers({ all: true, filters: { ancestor: [image.Id] } });
  if (users.length > 0) return 'in-use' as const;
  try {
    await client.getImage(image.Id).remove({ force: false, noprune: true });
  } catch {
    throw new RuntimeDiagnostic(
      'IMAGE_CLEANUP_FAILED',
      'The owned image remains. Stop its consumers and retry setup; no global prune is needed.',
    );
  }
  return 'removed' as const;
}

import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import Docker from 'dockerode';
import { build } from 'esbuild';
import { z } from 'zod';
import type { Settings } from '../src/config/settings.js';
import { dockerClient, INPUT_LABEL, OWNER_LABEL, ownerIdentity } from '../src/runtime/docker.js';
import { ownedLabBoundary } from '../src/discovery/lab.js';
import { acquireExampleLaunchLock } from './store.js';

const LAB_LABEL = 'dev.mastra.security-scanner.lab';
const KIND_LABEL = 'dev.mastra.security-scanner.kind';
const BASE_LABEL = 'dev.mastra.security-scanner.example-base';
const LOCK_LABEL = 'dev.mastra.security-scanner.example-lock';
const KIND = 'example-target';
const BASE_IMAGE = 'node:24.19.0-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43';
const BASE_DIGEST = BASE_IMAGE.slice(BASE_IMAGE.indexOf('@') + 1);
const receiptSchema = z.object({
  version: z.literal(1),
  pid: z.number().int().positive(),
  owner: z.string(),
  token: z.string().uuid(),
  mode: z.enum(['vulnerable', 'protected']),
  phase: z.enum(['PREPARING', 'RUNNING', 'DEBT']),
  imageId: z.string().optional(),
  sourceHash: z.string().optional(),
  baseDigest: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/)
    .optional(),
  lockHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  containerId: z.string().optional(),
  networkId: z.string().optional(),
  relayContainerId: z.string().optional(),
  accessNetworkId: z.string().optional(),
  hostPort: z.number().int().min(1024).max(65535).optional(),
});
export type ExampleReceipt = z.infer<typeof receiptSchema>;
const home = (settings: Settings) => join(settings.dataDirectory, 'example-target');
const receiptPath = (settings: Settings) => join(home(settings), 'transport.json');
const imageTag = (settings: Settings) => `security-scanner/example-target:${ownerIdentity(settings).slice(-16)}`;
/** Read a bounded build input after checking its ownership, permissions and file type. */
async function readPrivateBuildFile(path: string, maxBytes: number) {
  try {
    const info = await lstat(path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid?.() ||
      (info.mode & 0o777) !== 0o600 ||
      info.size > maxBytes
    )
      throw new Error('EXAMPLE_BUILD_EVIDENCE_UNSAFE');
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function writeReceipt(settings: Settings, receipt: ExampleReceipt) {
  const path = receiptPath(settings),
    temporary = `${path}.${randomUUID()}`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(receiptSchema.parse(receipt)));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path);
}
/** Load the private transport receipt, returning null only when it does not exist. */
async function readReceipt(settings: Settings) {
  try {
    const path = receiptPath(settings),
      info = await lstat(path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid?.() ||
      (info.mode & 0o777) !== 0o600 ||
      info.size > 4096
    )
      throw new Error('EXAMPLE_RECEIPT_UNSAFE');
    return receiptSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
/** Find the receipt-bound example image and verify its ownership and source labels. */
async function inspectImage(client: Docker, settings: Settings, receipt: ExampleReceipt) {
  if (!receipt.sourceHash) return null;
  const image = await client.getImage(receipt.imageId ?? imageTag(settings)).inspect();
  if (
    (receipt.imageId && image.Id !== receipt.imageId) ||
    image.Config.Labels?.[OWNER_LABEL] !== receipt.owner ||
    image.Config.Labels?.[INPUT_LABEL] !== receipt.sourceHash ||
    image.Config.Labels?.[KIND_LABEL] !== KIND ||
    image.Config.Labels?.[BASE_LABEL] !== receipt.baseDigest ||
    image.Config.Labels?.[LOCK_LABEL] !== receipt.lockHash ||
    receipt.owner !== ownerIdentity(settings)
  )
    throw new Error('EXAMPLE_IMAGE_CHANGED');
  return image;
}
/** Release only the example resources attributed to the supplied owner receipt. */
async function cleanupExampleTransport(settings: Settings, receipt: ExampleReceipt) {
  if (receipt.owner !== ownerIdentity(settings)) throw new Error('EXAMPLE_OWNER_CHANGED');
  const client = dockerClient(settings);
  let debt = false;
  if (receipt.relayContainerId || receipt.networkId)
    try {
      const relay = client.getContainer(receipt.relayContainerId ?? `scanner-example-relay-${receipt.token}`),
        inspected = await relay.inspect();
      if (
        (receipt.relayContainerId && inspected.Id !== receipt.relayContainerId) ||
        inspected.Config.Labels?.[OWNER_LABEL] !== receipt.owner ||
        inspected.Config.Labels?.[LAB_LABEL] !== receipt.token ||
        inspected.Config.Labels?.[KIND_LABEL] !== KIND ||
        (receipt.imageId && inspected.Image !== receipt.imageId)
      )
        throw new Error('EXAMPLE_RELAY_CHANGED');
      await relay.remove({ force: true, v: false });
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) debt = true;
    }
  if (receipt.containerId || receipt.networkId)
    try {
      const container = client.getContainer(receipt.containerId ?? `scanner-example-${receipt.token}`),
        inspected = await container.inspect();
      if (
        (receipt.containerId && inspected.Id !== receipt.containerId) ||
        inspected.Config.Labels?.[OWNER_LABEL] !== receipt.owner ||
        inspected.Config.Labels?.[LAB_LABEL] !== receipt.token ||
        inspected.Config.Labels?.[KIND_LABEL] !== KIND ||
        (receipt.imageId && inspected.Image !== receipt.imageId)
      )
        throw new Error('EXAMPLE_CONTAINER_CHANGED');
      await container.remove({ force: true, v: false });
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) debt = true;
    }
  if (receipt.networkId || receipt.imageId)
    try {
      const network = client.getNetwork(receipt.networkId ?? `scanner-example-${receipt.token}`),
        inspected = await network.inspect();
      if (
        (receipt.networkId && inspected.Id !== receipt.networkId) ||
        inspected.Labels?.[OWNER_LABEL] !== receipt.owner ||
        inspected.Labels?.[LAB_LABEL] !== receipt.token ||
        inspected.Labels?.[KIND_LABEL] !== KIND ||
        !inspected.Internal
      )
        throw new Error('EXAMPLE_NETWORK_CHANGED');
      await network.remove();
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) debt = true;
    }
  if (receipt.accessNetworkId || receipt.networkId)
    try {
      const network = client.getNetwork(receipt.accessNetworkId ?? `scanner-example-access-${receipt.token}`),
        inspected = await network.inspect();
      if (
        (receipt.accessNetworkId && inspected.Id !== receipt.accessNetworkId) ||
        inspected.Labels?.[OWNER_LABEL] !== receipt.owner ||
        inspected.Labels?.[LAB_LABEL] !== receipt.token ||
        inspected.Labels?.[KIND_LABEL] !== KIND ||
        inspected.Internal
      )
        throw new Error('EXAMPLE_ACCESS_NETWORK_CHANGED');
      await network.remove();
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) debt = true;
    }
  if (receipt.imageId || receipt.sourceHash)
    try {
      const image = await inspectImage(client, settings, receipt);
      if (image && (await client.listContainers({ all: true, filters: { ancestor: [image.Id] } })).length) debt = true;
      else if (image) await client.getImage(image.Id).remove({ force: false, noprune: true });
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) debt = true;
    }
  if (debt) {
    await writeReceipt(settings, { ...receipt, phase: 'DEBT' });
    throw new Error('EXAMPLE_CLEANUP_DEBT');
  }
  await rm(receiptPath(settings), { force: true });
}

/** Build the locally owned example image from its recorded source inputs. */
async function buildImage(settings: Settings, receipt: ExampleReceipt) {
  const context = join(home(settings), 'build');
  await rm(context, { recursive: true, force: true });
  await mkdir(context, { mode: 0o700 });
  const rootManifest = JSON.parse(await readFile(join(settings.root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const manifest = JSON.stringify({
    type: 'module',
    private: true,
    dependencies: {
      '@hono/node-server': rootManifest.dependencies['@hono/node-server'],
      '@libsql/client': rootManifest.dependencies['@libsql/client'],
      hono: rootManifest.dependencies.hono,
    },
  });
  const dockerfile = await readFile(join(settings.root, 'example-target-api', 'Dockerfile'));
  if (!dockerfile.toString().startsWith(`FROM ${BASE_IMAGE}\n`)) throw new Error('EXAMPLE_BASE_CHANGED');
  const evidence = join(home(settings), 'build-evidence');
  await mkdir(evidence, { mode: 0o700, recursive: true });
  const evidenceInfo = await lstat(evidence);
  if (!evidenceInfo.isDirectory() || evidenceInfo.isSymbolicLink() || evidenceInfo.uid !== process.getuid?.())
    throw new Error('EXAMPLE_BUILD_EVIDENCE_UNSAFE');
  await chmod(evidence, 0o700);
  const manifestPath = join(evidence, 'package.json');
  const lockPath = join(evidence, 'package-lock.json');
  const provenancePath = join(evidence, 'provenance.json');
  const previousManifest = (await readPrivateBuildFile(manifestPath, 4096))?.toString() ?? null;
  if (previousManifest !== manifest) {
    await rm(lockPath, { force: true });
    await rm(provenancePath, { force: true });
    await writeFile(manifestPath, manifest, { mode: 0o600 });
  }
  await chmod(manifestPath, 0o600);
  let lockBytes = await readPrivateBuildFile(lockPath, 1_000_000);
  if (!lockBytes) {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'npm',
        ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', '--workspaces=false'],
        {
          cwd: evidence,
          env: { PATH: process.env.PATH, HOME: process.env.HOME },
          stdio: ['ignore', 'ignore', 'ignore'],
        },
      );
      child.on('error', () => reject(new Error('EXAMPLE_LOCK_UNAVAILABLE')));
      child.on('close', code => (code === 0 ? resolve() : reject(new Error('EXAMPLE_LOCK_RESOLUTION_FAILED'))));
    });
    lockBytes = await readFile(lockPath);
  }
  await chmod(lockPath, 0o600);
  const locked = JSON.parse(lockBytes.toString()) as {
    lockfileVersion?: number;
    packages?: Record<string, { version?: string; integrity?: string; dependencies?: Record<string, string> }>;
  };
  if (
    locked.lockfileVersion !== 3 ||
    JSON.stringify(locked.packages?.['']?.dependencies) !== JSON.stringify(JSON.parse(manifest).dependencies) ||
    Object.entries(locked.packages ?? {}).some(
      ([path, item]) => path.startsWith('node_modules/') && (!item.version || !item.integrity),
    )
  )
    throw new Error('EXAMPLE_LOCK_INVALID');
  const lockHash = createHash('sha256').update(lockBytes).digest('hex');
  const priorProvenance = (await readPrivateBuildFile(provenancePath, 4096))?.toString() ?? null;
  if (priorProvenance) {
    const previous = JSON.parse(priorProvenance) as { lockHash?: string };
    if (previous.lockHash !== lockHash) throw new Error('EXAMPLE_LOCK_CHANGED');
  }
  await build({
    entryPoints: [join(settings.root, 'example-target-api', 'server.ts')],
    outfile: join(context, 'server.js'),
    platform: 'node',
    target: 'node24',
    format: 'esm',
    bundle: true,
    packages: 'external',
    logLevel: 'silent',
  });
  await build({
    entryPoints: [join(settings.root, 'example-target-api', 'relay.ts')],
    outfile: join(context, 'relay.js'),
    platform: 'node',
    target: 'node24',
    format: 'esm',
    bundle: true,
    packages: 'external',
    logLevel: 'silent',
  });
  await writeFile(join(context, 'package.json'), manifest, { mode: 0o600 });
  await writeFile(join(context, 'package-lock.json'), lockBytes, { mode: 0o600 });
  await writeFile(join(context, 'Dockerfile'), dockerfile, { mode: 0o600 });
  const sourceHash = createHash('sha256')
    .update(dockerfile)
    .update(manifest)
    .update(lockBytes)
    .update(settings.DOCKER_PLATFORM)
    .update(await readFile(join(context, 'server.js')))
    .update(await readFile(join(context, 'relay.js')))
    .digest('hex');
  receipt.sourceHash = sourceHash;
  receipt.baseDigest = BASE_DIGEST;
  receipt.lockHash = lockHash;
  await writeReceipt(settings, receipt);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'docker',
      [
        'build',
        '--platform',
        settings.DOCKER_PLATFORM,
        '--label',
        `${OWNER_LABEL}=${receipt.owner}`,
        '--label',
        `${INPUT_LABEL}=${sourceHash}`,
        '--label',
        `${KIND_LABEL}=${KIND}`,
        '--label',
        `${BASE_LABEL}=${BASE_DIGEST}`,
        '--label',
        `${LOCK_LABEL}=${lockHash}`,
        '--tag',
        imageTag(settings),
        context,
      ],
      {
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          DOCKER_CONFIG: process.env.DOCKER_CONFIG,
          DOCKER_HOST: `unix://${settings.DOCKER_SOCKET}`,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let diagnostic = '',
      bytes = 0;
    /** Retain only the bounded prefix of image-build diagnostics while counting all received bytes. */
    const capture = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes < 65536) diagnostic += chunk.toString();
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', () => reject(new Error('EXAMPLE_BUILD_UNAVAILABLE')));
    child.on('close', code =>
      code === 0 ? resolve() : reject(new Error(`EXAMPLE_BUILD_FAILED: ${diagnostic.slice(-2000)}`)),
    );
  });
  const image = await dockerClient(settings).getImage(imageTag(settings)).inspect();
  if (
    image.Config.Labels?.[OWNER_LABEL] !== receipt.owner ||
    image.Config.Labels?.[INPUT_LABEL] !== sourceHash ||
    image.Config.Labels?.[KIND_LABEL] !== KIND ||
    image.Config.Labels?.[BASE_LABEL] !== BASE_DIGEST ||
    image.Config.Labels?.[LOCK_LABEL] !== lockHash ||
    `${image.Os}/${image.Architecture}` !== settings.DOCKER_PLATFORM
  )
    throw new Error('EXAMPLE_IMAGE_MISMATCH');
  receipt.imageId = image.Id;
  await writeReceipt(settings, receipt);
  const provenance = JSON.stringify({
    version: 1,
    baseDigest: BASE_DIGEST,
    lockHash,
    sourceHash,
    imageId: image.Id,
    platform: settings.DOCKER_PLATFORM,
  });
  const provenanceTemporary = `${provenancePath}.${randomUUID()}`;
  const provenanceFile = await open(provenanceTemporary, 'wx', 0o600);
  try {
    await provenanceFile.writeFile(provenance);
    await provenanceFile.sync();
  } finally {
    await provenanceFile.close();
  }
  await rename(provenanceTemporary, provenancePath);
  await rm(context, { recursive: true, force: true });
  return image.Id;
}

/** Start the example API behind the launch fence and persist its owned resource receipt. */
async function startLockedExampleTransport(
  settings: Settings,
  mode: ExampleReceipt['mode'],
  releaseLaunch: () => Promise<void>,
) {
  const client = dockerClient(settings);
  const prior = await readReceipt(settings);
  if (prior) await cleanupExampleTransport(settings, prior);
  const receipt: ExampleReceipt = {
    version: 1,
    pid: process.pid,
    owner: ownerIdentity(settings),
    token: randomUUID(),
    mode,
    phase: 'PREPARING',
  };
  await writeReceipt(settings, receipt);
  try {
    const imageId = await buildImage(settings, receipt);
    const labels = { [OWNER_LABEL]: receipt.owner, [LAB_LABEL]: receipt.token, [KIND_LABEL]: KIND };
    const network = await client.createNetwork({
      Name: `scanner-example-${receipt.token}`,
      Internal: true,
      Driver: 'bridge',
      Labels: labels,
    });
    receipt.networkId = network.id;
    await writeReceipt(settings, receipt);
    const container = await client.createContainer({
      name: `scanner-example-${receipt.token}`,
      Image: imageId,
      Cmd: [mode],
      Labels: labels,
      User: `${process.getuid?.()}:${process.getgid?.()}`,
      HostConfig: {
        NetworkMode: network.id,
        Binds: [`${join(home(settings), 'db')}:/app/data:rw`],
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        ReadonlyRootfs: true,
        Memory: 268435456,
        MemorySwap: 268435456,
        PidsLimit: 64,
        LogConfig: { Type: 'none', Config: {} },
        Init: true,
      },
    });
    receipt.containerId = container.id;
    await writeReceipt(settings, receipt);
    await container.start();
    const boundary = await ownedLabBoundary(client, container.id, network.id, receipt.token);
    const accessNetwork = await client.createNetwork({
      Name: `scanner-example-access-${receipt.token}`,
      Internal: false,
      Driver: 'bridge',
      Labels: labels,
    });
    receipt.accessNetworkId = accessNetwork.id;
    await writeReceipt(settings, receipt);
    const relay = await client.createContainer({
      name: `scanner-example-relay-${receipt.token}`,
      Image: imageId,
      Entrypoint: ['node', '/app/relay.js'],
      Cmd: [boundary.address],
      Labels: labels,
      ExposedPorts: { '18080/tcp': {} },
      HostConfig: {
        NetworkMode: accessNetwork.id,
        PortBindings: { '18080/tcp': [{ HostIp: '127.0.0.1', HostPort: '' }] },
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        ReadonlyRootfs: true,
        Memory: 67108864,
        MemorySwap: 67108864,
        PidsLimit: 32,
        LogConfig: { Type: 'none', Config: {} },
        Init: true,
      },
    });
    receipt.relayContainerId = relay.id;
    await writeReceipt(settings, receipt);
    await network.connect({ Container: relay.id, EndpointConfig: {} });
    await relay.start();
    const inspected = await relay.inspect();
    const binding = inspected.NetworkSettings.Ports?.['18080/tcp'];
    const hostPort = Number(binding?.[0]?.HostPort);
    if (binding?.[0]?.HostIp !== '127.0.0.1' || !Number.isInteger(hostPort) || hostPort < 1024)
      throw new Error('EXAMPLE_HOST_BINDING_INVALID');
    receipt.hostPort = hostPort;
    const baseUrl = `http://127.0.0.1:${hostPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const response = await fetch(`${baseUrl}/openapi.json`, { signal: AbortSignal.timeout(1000) }).catch(() => null);
      if (response?.status === 200) {
        ready = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('EXAMPLE_NOT_READY');
    receipt.phase = 'RUNNING';
    await writeReceipt(settings, receipt);
    let closing: Promise<void> | undefined;
    return {
      receipt,
      baseUrl,
      scannerUrl: `http://${boundary.address}:18080`,
      close: () =>
        (closing ??= (async () => {
          try {
            await cleanupExampleTransport(settings, receipt);
          } finally {
            await releaseLaunch();
          }
        })()),
    };
  } catch (error) {
    const cleanupErrors: unknown[] = [];
    await rm(join(home(settings), 'build'), { recursive: true, force: true }).catch(cleanupError =>
      cleanupErrors.push(cleanupError),
    );
    await cleanupExampleTransport(settings, receipt).catch(cleanupError => cleanupErrors.push(cleanupError));
    if (cleanupErrors.length) throw new AggregateError([error, ...cleanupErrors], 'EXAMPLE_START_FAILED');
    throw error;
  }
}

/** Acquire the launch fence and start the requested vulnerable or protected example mode. */
export async function startExampleTransport(settings: Settings, mode: ExampleReceipt['mode']) {
  const releaseLaunch = await acquireExampleLaunchLock(settings.root);
  try {
    return await startLockedExampleTransport(settings, mode, releaseLaunch);
  } catch (error) {
    await releaseLaunch();
    throw error;
  }
}

/** Reconcile receipt-bound example resources while holding the launch fence. */
export async function reconcileExampleTransport(settings: Settings) {
  const releaseLaunch = await acquireExampleLaunchLock(settings.root);
  try {
    const receipt = await readReceipt(settings);
    if (receipt) await cleanupExampleTransport(settings, receipt);
  } finally {
    await releaseLaunch();
  }
}

/** Validate the running example receipt before exposing its owned target boundary. */
export async function readExampleBoundary(settings: Settings) {
  const receipt = await readReceipt(settings);
  if (!receipt) return undefined;
  if (
    receipt.phase !== 'RUNNING' ||
    receipt.owner !== ownerIdentity(settings) ||
    !receipt.containerId ||
    !receipt.networkId ||
    !receipt.imageId ||
    !receipt.baseDigest ||
    !receipt.lockHash ||
    !receipt.hostPort ||
    !receipt.relayContainerId ||
    !receipt.accessNetworkId
  )
    throw new Error('EXAMPLE_HANDOFF_INVALID');
  const client = dockerClient(settings);
  await inspectImage(client, settings, receipt);
  const container = await client.getContainer(receipt.containerId).inspect();
  const relay = await client.getContainer(receipt.relayContainerId).inspect();
  const accessNetwork = await client.getNetwork(receipt.accessNetworkId).inspect();
  const internalNetwork = await client.getNetwork(receipt.networkId).inspect();
  const ports = relay.NetworkSettings.Ports?.['18080/tcp'];
  if (
    container.Config.Labels?.[KIND_LABEL] !== KIND ||
    container.Config.Labels?.[OWNER_LABEL] !== receipt.owner ||
    container.Image !== receipt.imageId ||
    Object.keys(container.NetworkSettings.Networks).length !== 1 ||
    !container.NetworkSettings.Networks[internalNetwork.Name] ||
    Object.values(container.NetworkSettings.Ports ?? {}).some(binding => binding?.length) ||
    relay.Config.Labels?.[KIND_LABEL] !== KIND ||
    relay.Config.Labels?.[LAB_LABEL] !== receipt.token ||
    relay.Config.Labels?.[OWNER_LABEL] !== receipt.owner ||
    relay.Image !== receipt.imageId ||
    !relay.State.Running ||
    Object.keys(relay.NetworkSettings.Networks).length !== 2 ||
    !relay.NetworkSettings.Networks[internalNetwork.Name] ||
    !relay.NetworkSettings.Networks[accessNetwork.Name] ||
    accessNetwork.Labels?.[OWNER_LABEL] !== receipt.owner ||
    accessNetwork.Labels?.[LAB_LABEL] !== receipt.token ||
    accessNetwork.Labels?.[KIND_LABEL] !== KIND ||
    accessNetwork.Internal ||
    ports?.length !== 1 ||
    ports?.[0]?.HostIp !== '127.0.0.1' ||
    Number(ports?.[0]?.HostPort) !== receipt.hostPort
  )
    throw new Error('EXAMPLE_HANDOFF_CHANGED');
  return ownedLabBoundary(client, receipt.containerId, receipt.networkId, receipt.token);
}

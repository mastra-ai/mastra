import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { loadSettings } from '../../src/config/settings.js';
import {
  buildLocalImage,
  dockerClient,
  ownerIdentity,
  OWNER_LABEL,
  RUN_LABEL,
  releaseImage,
} from '../../src/runtime/docker.js';
import { randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import { DiscoveryStore } from '../../src/discovery/store.js';
import { ScanResources } from '../../src/discovery/resources.js';
import { INPUT_LABEL } from '../../src/runtime/docker.js';
import { startDiscoveryLab } from './harness.js';

/** Verify shared-image consumers protect each other's resources throughout cleanup. */
export async function sharedImageLifecycle() {
  const lab = await startDiscoveryLab();
  const store = new DiscoveryStore(lab.settings.databaseUrl);
  await store.initialize();
  const token = randomUUID();
  const network = await lab.client.createNetwork({
    Name: `unrelated-sentinel-${token}`,
    Internal: true,
    Labels: { 'scanner-test-sentinel': token },
  });
  const volumeName = `unrelated-sentinel-${token}`;
  await lab.client.createVolume({
    Name: volumeName,
    Labels: { 'scanner-test-sentinel': token },
  });
  const volume = lab.client.getVolume(volumeName);
  const consumer = await lab.client.createContainer({
    name: `unrelated-consumer-${token}`,
    Image: lab.images.firewall,
    Entrypoint: [],
    Cmd: ['sleep', 'infinity'],
    Labels: { 'scanner-test-sentinel': token, 'dev.mastra.security-scanner.owner': 'unrelated-sentinel-owner' },
    HostConfig: {
      NetworkMode: network.id,
      LogConfig: { Type: 'none', Config: {} },
      Mounts: [{ Type: 'volume', Source: volumeName, Target: '/sentinel' }],
    },
  });
  let removed = false;
  try {
    await consumer.start();
    const resources = new ScanResources(lab.settings, store, randomUUID());
    const image = await lab.client.getImage(lab.images.firewall).inspect();
    await store.remember({
      id: `${resources.scanId}:${image.Id}`,
      imageId: image.Id,
      kind: 'image',
      scanId: resources.scanId,
      token: image.Config.Labels![INPUT_LABEL]!,
    });
    const owned = await resources.network(true);
    expect(await resources.cleanup()).toBe(true);
    expect((await consumer.inspect()).State.Running).toBe(true);
    expect((await consumer.inspect()).Config.Labels?.['dev.mastra.security-scanner.owner']).toBe(
      'unrelated-sentinel-owner',
    );
    expect((await network.inspect()).Id).toBe(network.id);
    expect((await volume.inspect()).Name).toBe(volumeName);
    expect((await lab.client.getImage(image.Id).inspect()).Id).toBe(image.Id);
    expect(await store.resources(resources.scanId)).toHaveLength(1);
    await expect(owned.network.inspect()).rejects.toMatchObject({ statusCode: 404 });
    await consumer.remove({ force: true, v: false });
    removed = true;
    expect(await resources.cleanup()).toBe(true);
    await expect(lab.client.getImage(image.Id).inspect()).rejects.toMatchObject({ statusCode: 404 });
    expect(await store.resources(resources.scanId)).toEqual([]);
    expect((await network.inspect()).Id).toBe(network.id);
    expect((await volume.inspect()).Name).toBe(volumeName);
  } finally {
    if (!removed) await consumer.remove({ force: true, v: false });
    await network.remove();
    await volume.remove();
    await store.close();
  }
}

/** Verify classic-builder artifacts and shared consumers are reconciled without broad deletion. */
export async function legacySharedImageLifecycle() {
  const root = await mkdtemp(join(tmpdir(), 'scanner-legacy-image-'));
  const home = join(root, 'home');
  await mkdir(home, { mode: 0o700 });
  await cp(resolve(import.meta.dirname, '../../docker/discovery'), join(root, 'docker/discovery'), { recursive: true });
  const settings = loadSettings({ DOCKER_DISCOVERY_IMAGE: `security-scanner/katana:legacy-${randomUUID()}` }, root);
  const client = dockerClient(settings),
    owner = ownerIdentity(settings),
    run = randomUUID();
  const input = createHash('sha256')
    .update(await readFile(join(root, 'docker/discovery/Dockerfile')))
    .update(settings.DOCKER_PLATFORM)
    .digest('hex');
  const created: string[] = [];
  let consumer: ReturnType<typeof client.getContainer> | undefined;
  let primaryFailure: { error: unknown } | undefined;
  try {
    // Exercise the supported classic builder, independently of the operator's
    // buildx plugin/cache configuration. All build inputs and labels are owned.
    await promisify(execFile)(
      'docker',
      [
        'build',
        '--network=none',
        '--pull=false',
        '--platform',
        settings.DOCKER_PLATFORM,
        '--label',
        `${OWNER_LABEL}=${owner}`,
        '--label',
        `${INPUT_LABEL}=${input}`,
        '--label',
        `${RUN_LABEL}=${run}`,
        '--tag',
        settings.DOCKER_DISCOVERY_IMAGE,
        join(root, 'docker/discovery'),
      ],
      {
        env: {
          PATH: process.env.PATH,
          HOME: home,
          DOCKER_HOST: `unix://${settings.DOCKER_SOCKET}`,
          DOCKER_BUILDKIT: '0',
        },
        timeout: 120000,
        maxBuffer: 1048576,
      },
    );
    const receipt = await buildLocalImage(settings);
    created.push(receipt.imageId);
    const all = await client.listImages({
      all: true,
      filters: { label: [`${OWNER_LABEL}=${owner}`, `${INPUT_LABEL}=${input}`] },
    });
    for (const image of all) if (!created.includes(image.Id)) created.push(image.Id);
    expect(all.length).toBeGreaterThan(1);
    const top = await client.getImage(receipt.imageId).inspect();
    expect(top.Parent).toMatch(/^sha256:[a-f0-9]{64}$/);
    const parent = await client.getImage(top.Parent).inspect();
    expect(parent.Config.Labels?.[OWNER_LABEL]).toBe(owner);
    expect(parent.Config.Labels?.[INPUT_LABEL]).toBe(input);
    expect(parent.Config.Labels?.[RUN_LABEL]).toBeUndefined();
    consumer = await client.createContainer({
      name: `legacy-shared-consumer-${run}`,
      Image: receipt.imageId,
      Entrypoint: [],
      Cmd: ['sleep', 'infinity'],
      User: '10001:10001',
      Labels: { 'scanner-test-sentinel': run, [OWNER_LABEL]: 'unrelated-sentinel-owner' },
      HostConfig: {
        NetworkMode: 'none',
        CapDrop: ['ALL'],
        SecurityOpt: ['no-new-privileges:true'],
        LogConfig: { Type: 'none', Config: {} },
      },
    });
    await consumer.start();
    expect(await releaseImage(settings, receipt)).toBe('in-use');
    expect((await consumer.inspect()).State.Running).toBe(true);
    expect((await client.getImage(parent.Id).inspect()).Id).toBe(parent.Id);
    await consumer.remove({ force: true, v: true });
    consumer = undefined;
    expect(await releaseImage(settings, receipt)).toBe('removed');
    expect(await client.listImages({ all: true, filters: { label: [`${OWNER_LABEL}=${owner}`] } })).toEqual([]);
    // The unowned parent remains intact. Cleanup never prunes through it.
    expect((await client.getImage(parent.Parent).inspect()).Id).toBe(parent.Parent);
    console.log(
      `OPERATIONS_LEGACY_IMAGE_RECORD ${JSON.stringify({ owner, input, finalImageId: receipt.imageId, ownedImageIds: created, unownedBoundaryId: parent.Parent, remainingOwnedImages: 0 })}`,
    );
  } catch (error) {
    primaryFailure = { error };
  }
  const failures: unknown[] = [];
  /** Attempt exact-resource cleanup, ignoring only absence and collecting other failures. */
  const cleanup = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
    } catch (error) {
      if ((error as { statusCode?: number } | null)?.statusCode !== 404) failures.push(error);
    }
  };
  if (consumer) await cleanup(() => consumer!.remove({ force: true, v: true }));
  // Attempt every exact owned resource even if an earlier cleanup fails.
  for (const id of created) {
    await cleanup(async () => {
      const image = await client.getImage(id).inspect();
      if (image.Config.Labels?.[OWNER_LABEL] !== owner || image.Config.Labels?.[INPUT_LABEL] !== input)
        throw new Error('LEGACY_IMAGE_OWNERSHIP_MISMATCH');
      if (!(await client.listContainers({ all: true, filters: { ancestor: [id] } })).length)
        await client.getImage(id).remove({ force: false, noprune: true });
    });
  }
  await cleanup(() => rm(root, { recursive: true, force: true }));
  if (primaryFailure) {
    if (failures.length)
      throw new AggregateError([primaryFailure.error, ...failures], 'LEGACY_IMAGE_LIFECYCLE_FAILED', {
        cause: primaryFailure.error,
      });
    throw primaryFailure.error;
  }
  if (failures.length) throw new AggregateError(failures, 'LEGACY_IMAGE_CLEANUP_FAILED');
}

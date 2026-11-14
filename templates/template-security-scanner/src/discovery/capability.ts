import { constants } from 'node:fs';
import { open, readFile, rename, unlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Settings } from '../config/settings.js';
import { ControlPlaneError } from '../core/contracts.js';
import { dockerClient, ownerIdentity, preflight } from '../runtime/docker.js';
import { buildDiscoveryImages, releaseDiscoveryImages, digest } from './images.js';
import type { DiscoveryMode } from './contracts.js';

const receiptSchema = z
  .object({
    version: z.literal(1),
    owner: z.string(),
    platform: z.literal('linux/arm64'),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    modes: z.tuple([z.literal('http'), z.literal('headless')]),
    completedAt: z.iso.datetime(),
    status: z.literal('prerequisites-ready'),
    scanApproval: z.literal('operator-enablement-required'),
  })
  .strict();
/** Hash discovery-relevant source files for runtime capability binding. */
async function sourceHash(settings: Settings) {
  const source = (await readdir(join(settings.root, 'src'), { recursive: true }))
    .filter(path => path.endsWith('.ts'))
    .map(path => `src/${path}`);
  const runtime = (await readdir(join(settings.root, 'scripts/runtime'))).map(path => `scripts/runtime/${path}`);
  const files = [
    ...source,
    ...runtime,
    'docker/gateway/policy.py',
    'docker/discovery/seccomp.json',
    'docker/discovery/Dockerfile',
  ].sort();
  const inputs: Buffer[] = [];
  for (const path of files) {
    const bytes = await readFile(join(settings.root, path));
    inputs.push(Buffer.from(`${path}\0${bytes.length}\0`), bytes);
  }
  return digest(Buffer.concat(inputs));
}
export async function prepareDiscoveryCapability(settings: Settings, signal?: AbortSignal) {
  const images = await buildDiscoveryImages(settings, signal);
  try {
    const receipt = receiptSchema.parse({
      version: 1,
      owner: ownerIdentity(settings),
      platform: settings.DOCKER_PLATFORM,
      sourceHash: await sourceHash(settings),
      modes: ['http', 'headless'],
      completedAt: new Date().toISOString(),
      status: 'prerequisites-ready',
      scanApproval: 'operator-enablement-required',
    });
    const temporary = join(settings.dataDirectory, `discovery-${randomUUID()}.json`);
    const file = await open(
      temporary,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(JSON.stringify(receipt));
      await file.sync();
    } finally {
      await file.close();
    }
    try {
      await rename(temporary, join(settings.dataDirectory, 'discovery-capabilities.json'));
    } finally {
      await unlink(temporary).catch(() => undefined);
    }
    return receipt;
  } finally {
    await releaseDiscoveryImages(dockerClient(settings), settings, images);
  }
}
/** Reject discovery until runtime capability evidence matches the current inputs and policy. */
export async function requireDiscoveryCapability(settings: Settings, mode: DiscoveryMode) {
  if (!settings.SCANNER_DISCOVERY_ENABLED) throw new ControlPlaneError('EXECUTION_DISABLED', 503);
  await preflight(settings);
  let file;
  try {
    file = await open(
      join(settings.dataDirectory, 'discovery-capabilities.json'),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o600 || stat.size > 16384)
      throw new Error();
    const receipt = receiptSchema.parse(JSON.parse(await file.readFile('utf8')));
    if (
      receipt.owner !== ownerIdentity(settings) ||
      receipt.platform !== settings.DOCKER_PLATFORM ||
      receipt.sourceHash !== (await sourceHash(settings)) ||
      !receipt.modes.includes(mode)
    )
      throw new Error();
    return receipt;
  } catch {
    throw new ControlPlaneError('DISCOVERY_SETUP_REQUIRED', 503);
  } finally {
    await file?.close();
  }
}

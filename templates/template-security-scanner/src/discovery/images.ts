import Docker from 'dockerode';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, lstat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { ControlPlaneError } from '../core/contracts.js';
import type { Settings } from '../config/settings.js';
import { dockerClient, ownerIdentity, OWNER_LABEL, INPUT_LABEL } from '../runtime/docker.js';

const artifactSchema = z
  .object({
    name: z.string().regex(/^[a-zA-Z0-9_.+-]+\.apk$/),
    url: z.url().startsWith('https://dl-cdn.alpinelinux.org/alpine/'),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    size: z.number().int().positive().max(10000000),
    license: z.string(),
    sourceRevision: z.string(),
  })
  .strict();
const inputsSchema = z
  .object({
    platform: z.literal('linux/arm64'),
    mitmproxy: z
      .object({ image: z.string(), version: z.literal('12.3.1'), source: z.url(), license: z.literal('MIT') })
      .strict(),
    alpine: z.object({ image: z.string(), version: z.literal('3.22.7') }).strict(),
    firewall: z.array(artifactSchema).min(1).max(32),
    nss: z.array(artifactSchema).min(1).max(16),
    certutilSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
/** Create a private discovery-input directory and reject unsafe existing entries. */
async function directory(path: string) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.())
    throw new ControlPlaneError('UNSAFE_RUNTIME_CACHE', 503);
}
/** Obtain a bounded discovery artifact and verify its pinned size and digest before storage. */
async function download(path: string, input: z.infer<typeof artifactSchema>, signal?: AbortSignal) {
  let bytes: Buffer | undefined;
  try {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== input.size)
      throw new ControlPlaneError('RUNTIME_INPUT_INVALID', 503);
    bytes = await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (!bytes) {
    const response = await fetch(input.url, {
      redirect: 'error',
      signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]),
    });
    if (!response.ok || !response.body) throw new ControlPlaneError('RUNTIME_DOWNLOAD_FAILED', 503);
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = response.body.getReader();
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.length;
        if (size > input.size) {
          await reader.cancel();
          throw new ControlPlaneError('RUNTIME_INPUT_SIZE', 503);
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    bytes = Buffer.concat(chunks);
    if (bytes.length !== input.size || digest(bytes) !== input.sha256)
      throw new ControlPlaneError('RUNTIME_INPUT_INTEGRITY', 503);
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
  }
  if (bytes.length !== input.size || digest(bytes) !== input.sha256)
    throw new ControlPlaneError('RUNTIME_INPUT_INTEGRITY', 503);
  return bytes;
}
/** Extract the certificate utility from the bounded pinned Alpine package archive. */
function certutil(apk: Buffer) {
  const archive = gunzipSync(apk, { maxOutputLength: 4 * 1024 * 1024 });
  let offset = 0;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString().replace(/\0.*$/, '');
    const size = parseInt(header.subarray(124, 136).toString().replace(/\0.*$/, '').trim() || '0', 8);
    if (!Number.isFinite(size) || size < 0 || size > archive.length - offset - 512)
      throw new ControlPlaneError('NSS_ARCHIVE_INVALID', 503);
    if (name === 'usr/bin/certutil') return archive.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  throw new ControlPlaneError('NSS_BINARY_MISSING', 503);
}
/** Stage and verify the pinned files required to build the confined discovery images. */
export async function prepareDiscoveryInputs(settings: Settings, signal?: AbortSignal) {
  const manifest = inputsSchema.parse(
    JSON.parse(await readFile(join(settings.root, 'scripts/runtime/inputs.json'), 'utf8')),
  );
  if (settings.DOCKER_PLATFORM !== manifest.platform)
    throw new ControlPlaneError('DISCOVERY_PLATFORM_UNSUPPORTED', 503);
  const root = join(settings.dataDirectory, 'runtime-inputs');
  await directory(root);
  for (const group of ['firewall', 'nss'] as const) {
    await directory(join(root, group));
    for (const input of manifest[group]) await download(join(root, group, input.name), input, signal);
  }
  const nss = manifest.nss.find(input => input.name.startsWith('nss-tools-'))!;
  const binary = certutil(await readFile(join(root, 'nss', nss.name)));
  if (digest(binary) !== manifest.certutilSha256) throw new ControlPlaneError('NSS_BINARY_INTEGRITY', 503);
  return { manifest, root, certutil: Buffer.from(binary) };
}
/** Built local gateway/firewall images and integrity-checked browser support input. */
export type DiscoveryImages = {
  /** Immutable local gateway image ID. */
  gateway: string;
  /** Immutable local namespace-firewall initializer image ID. */
  firewall: string;
  /** Fingerprint shared by the verified image inputs. */
  inputHash: string;
  /** Verified NSS certutil binary bytes used for the private browser profile. */
  certutil: Buffer;
};
/** Build the owned crawler and browser images from verified discovery inputs. */
export async function buildDiscoveryImages(
  settings: Settings,
  signal?: AbortSignal,
  acquired?: (imageId: string, inputHash: string) => Promise<void>,
  acquiring?: (tag: string, inputHash: string) => Promise<void>,
  built?: (kind: 'gateway' | 'firewall', tag: string, imageId: string) => Promise<void>,
): Promise<DiscoveryImages> {
  signal?.throwIfAborted();
  const inputs = await prepareDiscoveryInputs(settings, signal);
  const cache = join(settings.dataDirectory, 'runtime-build');
  await directory(cache);
  const owner = ownerIdentity(settings),
    client = dockerClient(settings);
  const images: Partial<Record<'gateway' | 'firewall', string>> = {};
  const inputHash = digest(JSON.stringify(inputs.manifest));
  const attempted: Array<{ tag: string; hash: string }> = [];
  try {
    for (const kind of ['gateway', 'firewall'] as const) {
      const context = join(cache, kind);
      await directory(context);
      const dockerfile =
        kind === 'gateway'
          ? `FROM ${inputs.manifest.mitmproxy.image}\nCOPY policy.py /opt/scanner/policy.py\nRUN chmod 444 /opt/scanner/policy.py\nENTRYPOINT []\n`
          : `FROM ${inputs.manifest.alpine.image}\nCOPY apks/ /apks/\nRUN apk add --repositories-file /dev/null --no-network --no-cache /apks/*.apk && rm -rf /apks\nCOPY install-firewall.sh /opt/scanner/install-firewall.sh\nRUN chmod 444 /opt/scanner/install-firewall.sh\nENTRYPOINT []\n`;
      await writeFile(join(context, 'Dockerfile'), dockerfile, { mode: 0o600 });
      let source: string;
      if (kind === 'gateway') {
        source = await readFile(join(settings.root, 'docker/gateway/policy.py'), 'utf8');
        await writeFile(join(context, 'policy.py'), source, { mode: 0o600 });
      } else {
        source = await readFile(join(settings.root, 'scripts/runtime/install-firewall.sh'), 'utf8');
        await writeFile(join(context, 'install-firewall.sh'), source, { mode: 0o600 });
        await directory(join(context, 'apks'));
        for (const input of inputs.manifest.firewall)
          await writeFile(
            join(context, 'apks', input.name),
            await readFile(join(inputs.root, 'firewall', input.name)),
            {
              mode: 0o600,
            },
          );
      }
      const hash = digest(dockerfile + source + inputHash),
        tag = `security-scanner/${kind}:${owner.slice(-16)}-${hash.slice(0, 16)}`;
      attempted.push({ tag, hash });
      await acquiring?.(tag, hash);
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
            `${OWNER_LABEL}=${owner}`,
            '--label',
            `${INPUT_LABEL}=${hash}`,
            '--tag',
            tag,
            context,
          ],
          {
            shell: false,
            env: { PATH: process.env.PATH, HOME: process.env.HOME, DOCKER_HOST: `unix://${settings.DOCKER_SOCKET}` },
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
        let bytes = 0,
          stopped = false;
        const stop = () => {
          stopped = true;
          child.kill('SIGKILL');
        };
        const timer = setTimeout(stop, 600000);
        signal?.addEventListener('abort', stop, { once: true });
        if (signal?.aborted) stop();
        /** Stop the discovery image build when streamed output exceeds its byte ceiling. */
        const count = (chunk: Buffer) => {
          bytes += chunk.length;
          if (bytes > 8 * 1024 * 1024) stop();
        };
        child.stdout.on('data', count);
        child.stderr.on('data', count);
        child.once('error', () => {
          clearTimeout(timer);
          reject(new ControlPlaneError('RUNTIME_BUILD_UNAVAILABLE', 503));
        });
        child.once('close', code => {
          clearTimeout(timer);
          signal?.removeEventListener('abort', stop);
          if (code !== 0 || stopped) reject(new ControlPlaneError('RUNTIME_BUILD_FAILED', 503));
          else resolve();
        });
      });
      const image = await client.getImage(tag).inspect();
      if (
        image.Config.Labels?.[OWNER_LABEL] !== owner ||
        image.Config.Labels?.[INPUT_LABEL] !== hash ||
        `${image.Os}/${image.Architecture}` !== settings.DOCKER_PLATFORM
      )
        throw new ControlPlaneError('DISCOVERY_IMAGE_MISMATCH', 503);
      images[kind] = image.Id;
      await built?.(kind, tag, image.Id);
      await acquired?.(image.Id, hash);
    }
    return { gateway: images.gateway!, firewall: images.firewall!, inputHash, certutil: inputs.certutil };
  } catch (error) {
    let cleanupFailed = false;
    for (const artifact of attempted.reverse())
      try {
        const observed = await client.getImage(artifact.tag).inspect();
        if (
          observed.Config.Labels?.[OWNER_LABEL] !== owner ||
          observed.Config.Labels?.[INPUT_LABEL] !== artifact.hash
        ) {
          cleanupFailed = true;
          continue;
        }
        if (!(await client.listContainers({ all: true, filters: { ancestor: [observed.Id] } })).length)
          await client.getImage(observed.Id).remove({ force: false, noprune: true });
      } catch (cleanup) {
        if ((cleanup as { statusCode?: number }).statusCode !== 404) cleanupFailed = true;
      }
    inputs.certutil.fill(0);
    if (cleanupFailed) throw new ControlPlaneError('RUNTIME_IMAGE_CLEANUP_REQUIRED', 503);
    throw error;
  }
}
/** Release discovery images only after checking for remaining owned consumers. */
export async function releaseDiscoveryImages(client: Docker, settings: Settings, images: DiscoveryImages) {
  for (const id of [images.gateway, images.firewall]) {
    let image;
    try {
      image = await client.getImage(id).inspect();
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) continue;
      throw error;
    }
    if (image.Config.Labels?.[OWNER_LABEL] !== ownerIdentity(settings))
      throw new ControlPlaneError('IMAGE_OWNERSHIP_CHANGED', 503);
    if ((await client.listContainers({ all: true, filters: { ancestor: [id] } })).length) continue;
    await client.getImage(id).remove({ force: false, noprune: true });
  }
  images.certutil.fill(0);
}

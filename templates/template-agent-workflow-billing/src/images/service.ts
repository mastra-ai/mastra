import { readImageProfile } from './profile.js';
import { constants } from 'node:fs';
import { open, rename, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { BillingError, parseInput } from '../billing/contracts/core.js';
import { boundedJson } from '../billing/runtime/accounting.js';
import type { AdmissionIdentity } from '../billing/runtime/accounting.js';
import type { ArtifactReader, ArtifactPersistence } from '../billing/contracts/artifacts.js';
import { currentExecution } from '../billing/runtime/execution-scope.js';
import type { ExecutionScope } from '../billing/runtime/execution-scope.js';
import { privateDirectory } from '../billing/storage/private-files.js';
import { artifactSchema, briefSchema, kitOutputSchema } from './schemas.js';
import type { Artifact } from './schemas.js';
import { maxImageBytes, validatePng } from './png-validation.js';

const responseSchema = z.object({
  data: z.tuple([
    z.object({
      b64_json: z
        .string()
        .min(1)
        .max(12 * 1024 * 1024),
    }),
  ]),
});
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export class ImageService implements ArtifactReader {
  readonly directory: string;
  readonly profile: ReturnType<typeof readImageProfile>;
  constructor(
    private readonly environment: NodeJS.ProcessEnv,
    private readonly artifacts: ArtifactPersistence,
    directory?: string,
  ) {
    this.profile = readImageProfile(environment);
    const root = resolve(environment.BILLING_PROJECT_ROOT ?? environment.MASTRA_PROJECT_ROOT ?? '.');
    this.directory = directory ?? resolve(root, 'data/private-images');
  }
  private async files() {
    await privateDirectory(dirname(this.directory));
    await privateDirectory(this.directory);
  }
  private async load(artifact: Artifact): Promise<Buffer | null> {
    try {
      await this.files();
      const handle = await open(
        resolve(this.directory, `${artifact.id}.png`),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const info = await handle.stat();
        if (
          !info.isFile() ||
          info.nlink !== 1 ||
          info.uid !== process.getuid?.() ||
          (info.mode & 0o7777) !== 0o600 ||
          info.size !== artifact.bytes
        )
          return null;
        const bounded = Buffer.alloc(artifact.bytes + 1);
        let length = 0;
        while (length < bounded.length) {
          const result = await handle.read(bounded, length, bounded.length - length, length);
          if (!result.bytesRead) break;
          length += result.bytesRead;
        }
        if (length !== artifact.bytes) return null;
        const bytes = bounded.subarray(0, length);
        if (digest(bytes) !== artifact.sha256) return null;
        validatePng(bytes, artifact);
        return bytes;
      } finally {
        await handle.close();
      }
    } catch {
      return null;
    }
  }
  async generate(): Promise<Artifact> {
    const scope = currentExecution();
    const prompt = parseInput(briefSchema, scope.prompt);
    await scope.checkpoint();
    const identity = JSON.stringify(
      boundedJson({ prompt, profile: this.profile, slot: scope.slot, budget: scope.collector.artifactSlots }),
    );
    const previous = await this.artifacts.claim(scope, identity, artifactSchema);
    if (previous) {
      if (!(await this.load(previous))) throw new BillingError('state_unavailable');
      return previous;
    }
    let temporary: string | undefined;
    let unregistered: string | undefined;
    try {
      await scope.checkpoint();
      // A durable dispatch claim is never automatically reissued, including after timeout or process death.
      const signal = AbortSignal.any([scope.signal, AbortSignal.timeout(120000)]);
      const response = await fetch(
        `${(this.environment.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/images/generations`,
        {
          method: 'POST',
          signal,
          redirect: 'error',
          headers: {
            authorization: `Bearer ${this.environment.OPENAI_API_KEY ?? ''}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ ...this.profile, prompt }),
        },
      );
      if (!response.ok) {
        await response.body?.cancel();
        throw new BillingError('state_unavailable');
      }
      const limit = 12 * 1024 * 1024;
      if (Number(response.headers.get('content-length')) > limit) {
        await response.body?.cancel();
        throw new BillingError('state_unavailable');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new BillingError('state_unavailable');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > limit) throw new BillingError('state_unavailable');
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => {});
      }
      const data = parseInput(responseSchema, JSON.parse(Buffer.concat(chunks).toString('utf8'))).data[0].b64_json;
      if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new BillingError('state_unavailable');
      const bytes = Buffer.from(data, 'base64');
      if (bytes.toString('base64') !== data) throw new BillingError('state_unavailable');
      if (bytes.length > maxImageBytes) throw new BillingError('state_unavailable');
      const [width, height] = this.profile.size.split('x').map(Number);
      const dimensions = validatePng(bytes, { width, height });
      await scope.checkpoint();
      await this.files();
      const id = randomUUID();
      temporary = resolve(this.directory, `${id}.tmp`);
      const handle = await open(
        temporary,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } finally {
        await handle.close();
      }
      const permanent = resolve(this.directory, `${id}.png`);
      await rename(temporary, permanent);
      unregistered = permanent;
      temporary = undefined;
      const directory = await open(this.directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      // Registration may commit even when its acknowledgement is lost. Retain
      // the durable PNG once publication starts so recovery can read it.
      unregistered = undefined;
      return await this.artifacts.complete(
        scope,
        {
          id,
          filename: `image-${scope.slot + 1}.png`,
          title: `Generated image ${scope.slot + 1}`,
          mime: 'image/png',
          ...dimensions,
          bytes: bytes.length,
          sha256: digest(bytes),
        },
        artifactSchema,
      );
    } catch {
      await this.artifacts.uncertain(scope).catch(() => {});
      throw new BillingError('state_unavailable');
    } finally {
      if (temporary) await unlink(temporary).catch(() => {});
      if (unregistered) await unlink(unregistered).catch(() => {});
    }
  }
  async completed(scope: ExecutionScope): Promise<Artifact> {
    await scope.checkpoint();
    const artifact = await this.artifacts.completed(scope, artifactSchema);
    if (!(await this.load(artifact))) throw new BillingError('state_unavailable');
    return artifact;
  }
  async completeKit(scope: ExecutionScope, value: unknown) {
    const output = parseInput(kitOutputSchema, value);
    const artifacts: Artifact[] = [];
    for (let slot = 0; slot < 3; slot++) artifacts.push(await this.completed({ ...scope, slot }));
    if (JSON.stringify(artifacts) !== JSON.stringify(output.artifacts)) throw new BillingError('state_unavailable');
    return output;
  }
  async read(identity: AdmissionIdentity, artifactId: string) {
    const id = parseInput(z.uuid(), artifactId);
    const artifact = await this.artifacts.read(identity, id, artifactSchema);
    const bytes = await this.load(artifact);
    return bytes ? { bytes, filename: artifact.filename, mime: artifact.mime } : null;
  }
}

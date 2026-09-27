import type {
  GetObjectCommandOutput,
  HeadObjectCommandOutput,
  ListObjectsV2CommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import { GetObjectCommand, HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { RetryErrorInfo, RetryStrategyV2, RetryToken } from '@aws-sdk/types';
import type { FileStat, ListOptions, ReadOptions } from '@mastra/core/workspace';
import type { S3FilesystemOptions } from '@mastra/s3';
import { S3Filesystem } from '@mastra/s3';

import type { S3Source } from './catalog.js';
import { normalizeS3Prefix } from './catalog.js';
import { ExtractionError, MAX_RECORD_BYTES } from './extractors.js';

export const MAX_S3_ENTRIES = 1_000;
export const MAX_S3_PAGES = 100;
export const MAX_S3_DEPTH = 32;
export const MAX_INSPECTION_BYTES = 64 * 1024;
export const S3_EXTRACTION_VERSION = 's3-extraction-v1';
export const S3_REQUEST_TIMEOUT_MS = 30_000;

export type S3Validator = { etag: string; size: number; modifiedAt?: string };
export type S3Object = {
  key: string;
  relativePath: string;
  title: string;
  validator?: S3Validator;
};
export type S3Listing = { objects: S3Object[]; complete: boolean; errors: string[] };

type S3ClientLike = Pick<S3Client, 'send'>;

const oneAttemptToken: RetryToken = { getRetryCount: () => 0, getRetryDelay: () => 0 };
/** The native S3 client stays public; this strategy makes boundedRequest own all three wire attempts. */
const oneAttemptRetryStrategy: RetryStrategyV2 = {
  acquireInitialRetryToken: async () => oneAttemptToken,
  refreshRetryTokenForRetry: async (_token: RetryToken, error: RetryErrorInfo) => Promise.reject(error.error),
  recordSuccess: () => undefined,
};

function transient(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  const name = (error as { name?: string }).name;
  return status === 429 || (status !== undefined && status >= 500) || name === 'TimeoutError';
}

function notFound(error: unknown): boolean {
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  const name = (error as { name?: string }).name;
  return status === 404 || name === 'NoSuchKey' || name === 'NotFound';
}

async function withTransientRetries<T>(action: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (attempt === 2 || !transient(error)) throw error;
    }
  }
  throw new Error('S3 request retry limit was reached.');
}

async function boundedRequest<T>(client: S3ClientLike, command: object): Promise<T> {
  return withTransientRetries(
    () =>
      client.send(command as never, { abortSignal: AbortSignal.timeout(S3_REQUEST_TIMEOUT_MS) } as never) as Promise<T>,
  );
}

function safeRelativeKey(key: string): string | undefined {
  if (!key || key.includes('\\') || key.includes('\0') || key.startsWith('/')) return undefined;
  const parts = key.split('/');
  for (const part of parts) {
    if (!part || /[\0-\x1f\x7f]/.test(part)) return undefined;
    let decoded = part;
    for (let depth = 0; depth < 3; depth++) {
      try {
        const next = decodeURIComponent(decoded);
        if (next === decoded) break;
        decoded = next;
      } catch {
        // A literal percent sign is a legitimate object-key character.
        break;
      }
    }
    if (part === '.' || part === '..' || decoded === '.' || decoded === '..' || /[\\/\0-\x1f\x7f]/.test(decoded))
      return undefined;
  }
  return key;
}

function validatorOf(object: { ETag?: string; Size?: number; LastModified?: Date }): S3Validator | undefined {
  const size = object.Size;
  if (!object.ETag || typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) return undefined;
  return { etag: object.ETag, size, ...(object.LastModified ? { modifiedAt: object.LastModified.toISOString() } : {}) };
}

function pathFor(prefix: string, path: string): string {
  const relative = safeRelativeKey(path);
  if (!relative) throw new Error('Requested path must be a non-empty path contained within its source mount.');
  return prefix + relative;
}

export function supportedS3Path(path: string): boolean {
  return /\.(md|markdown|pdf|docx)$/i.test(path);
}

async function boundedBody(body: unknown, maximum: number): Promise<Buffer> {
  if (!body || typeof body !== 'object' || !(Symbol.asyncIterator in body))
    throw new ExtractionError('S3 object response did not include a readable body.');
  const timeout = setTimeout(() => {
    if ('destroy' in body && typeof body.destroy === 'function') body.destroy(new Error('S3 body read timed out.'));
  }, S3_REQUEST_TIMEOUT_MS);
  try {
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const value of body as AsyncIterable<Uint8Array>) {
      const length = value.byteLength;
      if (bytes + length > maximum) {
        if ('destroy' in body && typeof body.destroy === 'function') body.destroy();
        throw new ExtractionError(`Binary input exceeds ${maximum / (1024 * 1024)} MiB.`);
      }
      bytes += length;
      chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof ExtractionError) throw error;
    throw new ExtractionError('S3 object body could not be read.');
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * This remains the official Mastra S3 mount. Native reads lack conditional,
 * streamed bounds and listing completeness, so the public client is shared by
 * the bounded helpers rather than reinitializing a parallel provider client.
 */
export class BoundedS3Filesystem extends S3Filesystem {
  constructor(
    options: S3FilesystemOptions,
    private readonly source: S3Source,
  ) {
    super(options);
    // Smithy's retry middleware reads this public provider at request time.
    // Do not set config.maxAttempts: its resolved retry controller may already
    // have captured an ambient setting before this mount is constructed.
    this.client.config.retryStrategy = async () => oneAttemptRetryStrategy;
  }

  async init(): Promise<void> {
    try {
      await boundedRequest(this.client, new HeadBucketCommand({ Bucket: this.source.bucket }));
    } catch {
      throw new Error('S3 source is unavailable. Confirm its configured credentials and bucket access.');
    }
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    try {
      const key = pathFor(normalizeS3Prefix(this.source.prefix), path);
      const stat = await boundedRequest<HeadObjectCommandOutput>(
        this.client,
        new HeadObjectCommand({ Bucket: this.source.bucket, Key: key }),
      );
      if ((stat.ContentLength ?? 0) > MAX_INSPECTION_BYTES)
        throw new Error(`Record exceeds the ${MAX_INSPECTION_BYTES / 1024} KiB inspection limit.`);
      if (!stat.ETag) throw new Error('S3 object cannot be safely bound to an observed revision.');
      const response = await boundedRequest<GetObjectCommandOutput>(
        this.client,
        new GetObjectCommand({ Bucket: this.source.bucket, Key: key, IfMatch: stat.ETag }),
      );
      const content = await boundedBody(response.Body, MAX_INSPECTION_BYTES);
      if (stat.ETag && response.ETag !== stat.ETag) throw new Error('S3 object changed while it was being inspected.');
      return options?.encoding ? content.toString(options.encoding) : content;
    } catch (error) {
      if (error instanceof ExtractionError || (error instanceof Error && error.message.includes('inspection limit')))
        throw error;
      throw new Error('S3 file is unavailable or changed during inspection.');
    }
  }

  async stat(path: string): Promise<FileStat> {
    const normalized = path.replace(/^\/+|\/+$/g, '');
    if (!normalized)
      return {
        name: '',
        path,
        type: 'directory',
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
    const key = pathFor(normalizeS3Prefix(this.source.prefix), path);
    try {
      const response = await boundedRequest<HeadObjectCommandOutput>(
        this.client,
        new HeadObjectCommand({ Bucket: this.source.bucket, Key: key }),
      );
      const modifiedAt = response.LastModified ?? new Date();
      return {
        name: path.split('/').at(-1) ?? '',
        path,
        type: 'file',
        size: response.ContentLength ?? 0,
        createdAt: modifiedAt,
        modifiedAt,
        mimeType: response.ContentType,
      };
    } catch (error) {
      if (!notFound(error)) throw new Error('S3 file is unavailable.');
      if (await this.isDirectory(path)) {
        const now = new Date();
        return {
          name: normalized.split('/').at(-1) ?? '',
          path,
          type: 'directory',
          size: 0,
          createdAt: now,
          modifiedAt: now,
        };
      }
      throw new Error('S3 file is unavailable.');
    }
  }

  async exists(path: string): Promise<boolean> {
    if (!path.replace(/^\/+|\/+$/g, '')) return true;
    return (await this.isFile(path)) || (await this.isDirectory(path));
  }

  async isFile(path: string): Promise<boolean> {
    if (!path || path.endsWith('/')) return false;
    try {
      const key = pathFor(normalizeS3Prefix(this.source.prefix), path);
      await boundedRequest(this.client, new HeadObjectCommand({ Bucket: this.source.bucket, Key: key }));
      return true;
    } catch (error) {
      if (notFound(error)) return false;
      throw new Error('S3 file is unavailable.');
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    const requested = path.replace(/^\/+|\/+$/g, '');
    if (!requested) return true;
    try {
      const prefix = normalizeS3Prefix(this.source.prefix) + pathFor('', requested) + '/';
      const listed = await new ScopedS3Reader(this.source, this.client).list(prefix);
      if (!listed.complete) throw new Error('S3 directory is unavailable.');
      return listed.objects.length > 0;
    } catch (error) {
      if (error instanceof Error && error.message === 'S3 directory is unavailable.') throw error;
      return false;
    }
  }

  async destroy(): Promise<void> {
    this.client.destroy();
  }

  async readdir(
    path: string,
    options?: ListOptions,
  ): Promise<Array<{ name: string; type: 'file' | 'directory'; size?: number }>> {
    const requested = path.replace(/^\/+|\/+$/g, '');
    const prefix = normalizeS3Prefix(this.source.prefix) + (requested ? pathFor('', requested) + '/' : '');
    const listed = await new ScopedS3Reader(this.source, this.client).list(prefix);
    if (!listed.complete) throw new Error('S3 directory listing is incomplete.');
    const entries = new Map<string, { name: string; type: 'file' | 'directory'; size?: number }>();
    for (const object of listed.objects) {
      const name = options?.recursive ? object.relativePath : object.relativePath.split('/')[0]!;
      if (!name) continue;
      if (!options?.recursive && object.relativePath.includes('/')) {
        entries.set(name, { name, type: 'directory' });
        continue;
      }
      const extensions = options?.extension
        ? Array.isArray(options.extension)
          ? options.extension
          : [options.extension]
        : [];
      if (extensions.length && !extensions.some(extension => name.endsWith(extension))) continue;
      entries.set(name, { name, type: 'file', size: object.validator?.size });
    }
    return [...entries.values()];
  }
}

export class ScopedS3Reader {
  constructor(
    private readonly source: S3Source,
    private readonly client: S3ClientLike,
  ) {}

  async #send(command: ConstructorParameters<typeof ListObjectsV2Command>[0]): Promise<ListObjectsV2CommandOutput> {
    return boundedRequest<ListObjectsV2CommandOutput>(this.client, new ListObjectsV2Command(command));
  }

  async list(overridePrefix?: string): Promise<S3Listing> {
    const configuredPrefix = normalizeS3Prefix(this.source.prefix);
    let prefix = configuredPrefix;
    if (overridePrefix !== undefined) {
      try {
        prefix = normalizeS3Prefix(overridePrefix);
      } catch {
        return {
          objects: [],
          complete: false,
          errors: ['S3 listing prefix is unsafe or outside its configured source.'],
        };
      }
      if (!prefix.startsWith(configuredPrefix))
        return { objects: [], complete: false, errors: ['S3 listing prefix is outside its configured source.'] };
    }
    const objects: S3Object[] = [];
    const errors: string[] = [];
    const tokens = new Set<string>();
    let continuationToken: string | undefined;
    let entries = 0;
    let pages = 0;
    try {
      do {
        if (++pages > MAX_S3_PAGES) return { objects, complete: false, errors: ['S3 listing exceeds 100 pages.'] };
        const page = await this.#send({
          Bucket: this.source.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: Math.min(MAX_S3_ENTRIES, 1_000),
        });
        for (const object of page.Contents ?? []) {
          if (++entries > MAX_S3_ENTRIES)
            return { objects, complete: false, errors: ['S3 listing exceeds 1,000 entries.'] };
          if (!object.Key?.startsWith(prefix))
            return { objects, complete: false, errors: ['S3 listing contains an out-of-prefix key.'] };
          if (!object.Key || object.Key === prefix || object.Key.endsWith('/')) continue;
          const relativePath = safeRelativeKey(object.Key.slice(prefix.length));
          if (!relativePath) {
            errors.push('S3 listing contains an unsafe key.');
            return { objects, complete: false, errors };
          }
          if (relativePath.split('/').length > MAX_S3_DEPTH) {
            errors.push('S3 object exceeds nesting limit.');
            return { objects, complete: false, errors };
          }
          objects.push({
            key: object.Key,
            relativePath,
            title: relativePath.split('/').at(-1)!,
            validator: validatorOf(object),
          });
        }
        continuationToken = page.NextContinuationToken;
        if (page.IsTruncated && !continuationToken)
          return { objects, complete: false, errors: ['S3 listing ended without its required continuation token.'] };
        if (!page.IsTruncated) continuationToken = undefined;
        if (continuationToken) {
          if (tokens.has(continuationToken))
            return { objects, complete: false, errors: ['S3 listing repeated a continuation token.'] };
          tokens.add(continuationToken);
        }
      } while (continuationToken);
      return { objects, complete: true, errors };
    } catch {
      return { objects, complete: false, errors: ['S3 listing failed; check source access and retry.'] };
    }
  }

  async extract(object: S3Object) {
    const prefix = normalizeS3Prefix(this.source.prefix);
    const relativePath = safeRelativeKey(object.relativePath);
    if (
      !relativePath ||
      object.key !== prefix + relativePath ||
      !object.key.startsWith(prefix) ||
      object.key.slice(prefix.length) !== relativePath
    )
      throw new ExtractionError('S3 object is outside its configured source.');
    let observed = object.validator;
    if (!observed) {
      const head = await boundedRequest<HeadObjectCommandOutput>(
        this.client,
        new HeadObjectCommand({ Bucket: this.source.bucket, Key: object.key }),
      );
      observed = validatorOf({ ETag: head.ETag, Size: head.ContentLength, LastModified: head.LastModified });
    }
    if (!observed?.etag) throw new ExtractionError('S3 object has no verifiable revision metadata.');
    if (observed.size > MAX_RECORD_BYTES) throw new ExtractionError('Binary input exceeds 20 MiB.');
    const response = await boundedRequest<GetObjectCommandOutput>(
      this.client,
      new GetObjectCommand({ Bucket: this.source.bucket, Key: object.key, IfMatch: observed.etag }),
    );
    if (response.ETag !== observed.etag) {
      if (response.Body && typeof response.Body === 'object' && 'destroy' in response.Body)
        (response.Body as { destroy?: () => void }).destroy?.();
      throw new ExtractionError('S3 object changed during download.');
    }
    const data = await boundedBody(response.Body, MAX_RECORD_BYTES);
    return (await import('./extractors.js')).extractRecord(object.relativePath, data);
  }
}

import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { DocumentStorage } from '../../contracts/providers/document-storage.js';
import { ProviderResultInvalidError, ProviderUnavailableError } from '../../contracts/shared/provider.js';
import { documentContentReferenceSchema, type DocumentContentReference } from '../../domain/documents.js';
import { IdempotencyConflictError, NotFoundError } from '../../domain/errors.js';

const isCode = (error: unknown, code: string): boolean =>
  error instanceof Error && 'code' in error && error.code === code;

const storageUnavailable = (): ProviderUnavailableError =>
  new ProviderUnavailableError({
    providerId: 'local-filesystem',
    operation: 'DOCUMENT_STORAGE',
    safeMessage: 'The document storage operation failed',
  });

const safeSegment = (segment: string): boolean =>
  segment.length > 0 && segment !== '.' && segment !== '..' && !segment.includes('\0');

export class LocalFilesystemDocumentStorage implements DocumentStorage {
  readonly #root: string;

  constructor(root: string) {
    this.#root = resolve(root);
  }

  async store(input: Parameters<DocumentStorage['store']>[0]) {
    const tenantPartition = createHash('sha256').update(input.tenantId).digest('hex').slice(0, 32);
    const storageKey = `${tenantPartition}/${input.caseId}/${input.documentId}`;
    const digest = createHash('sha256').update(input.bytes).digest('hex');
    const reference = documentContentReferenceSchema.parse({
      storageKey,
      digest,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
    });
    const idempotencyPath = await this.#idempotencyPath(input.tenantId, input.idempotencyKey);
    const prior = await this.#readReference(idempotencyPath);
    if (prior !== undefined) {
      this.#assertSameReference(prior, reference);
      await this.#assertContent(prior, input.bytes);
      return prior;
    }

    const documentDirectory = await this.#ensureDirectory([tenantPartition, input.caseId]);
    const documentPath = join(documentDirectory, input.documentId);
    try {
      await this.#writeExclusive(documentPath, input.bytes);
    } catch (error) {
      if (!isCode(error, 'EEXIST')) throw this.#mapStorageError(error);
      await this.#assertContent(reference, input.bytes);
    }
    try {
      await this.#writeExclusive(idempotencyPath, new TextEncoder().encode(JSON.stringify(reference)));
    } catch (error) {
      if (!isCode(error, 'EEXIST')) throw this.#mapStorageError(error);
      const concurrent = await this.#readReference(idempotencyPath);
      if (concurrent === undefined) throw storageUnavailable();
      this.#assertSameReference(concurrent, reference);
      await this.#assertContent(concurrent, input.bytes);
    }
    return reference;
  }

  async open(input: Parameters<DocumentStorage['open']>[0]) {
    const path = await this.#safeTenantFilePath(input.tenantId, input.reference.storageKey);
    try {
      return { bytes: await this.#readFileNoFollow(path) };
    } catch (error) {
      if (isCode(error, 'ENOENT')) throw new NotFoundError('Document');
      throw this.#mapStorageError(error);
    }
  }

  async remove(input: Parameters<DocumentStorage['remove']>[0]): Promise<void> {
    const path = await this.#safeTenantFilePath(input.tenantId, input.reference.storageKey);
    try {
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isFile()) throw storageUnavailable();
      await unlink(path);
    } catch (error) {
      if (isCode(error, 'ENOENT')) return;
      throw this.#mapStorageError(error);
    }
  }

  async #rootPath(): Promise<string> {
    await mkdir(this.#root, { recursive: true, mode: 0o700 });
    const stat = await lstat(this.#root);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw storageUnavailable();
    return realpath(this.#root);
  }

  async #ensureDirectory(segments: readonly string[]): Promise<string> {
    let current = await this.#rootPath();
    for (const segment of segments) {
      if (!safeSegment(segment) || segment.includes('/') || segment.includes('\\')) throw new NotFoundError('Document');
      current = join(current, segment);
      try {
        await mkdir(current, { mode: 0o700 });
      } catch (error) {
        if (!isCode(error, 'EEXIST')) throw this.#mapStorageError(error);
      }
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw storageUnavailable();
      if ((await realpath(current)) !== current) throw storageUnavailable();
    }
    return current;
  }

  #storageKeySegments(storageKey: string): string[] {
    const normalized = storageKey.replaceAll('\\', '/');
    let segments: string[];
    try {
      segments = normalized.split('/').map(segment => decodeURIComponent(segment));
    } catch {
      throw new NotFoundError('Document');
    }
    if (segments.length !== 3 || segments.some(segment => !safeSegment(segment))) throw new NotFoundError('Document');
    return segments;
  }

  async #safeTenantFilePath(tenantId: string, storageKey: string): Promise<string> {
    const tenantPartition = createHash('sha256').update(tenantId).digest('hex').slice(0, 32);
    const segments = this.#storageKeySegments(storageKey);
    if (segments[0] !== tenantPartition) throw new NotFoundError('Document');
    const parent = await this.#ensureExistingDirectory(segments.slice(0, -1));
    return join(parent, segments[2] ?? '');
  }

  async #ensureExistingDirectory(segments: readonly string[]): Promise<string> {
    let current = await this.#rootPath();
    for (const segment of segments) {
      if (!safeSegment(segment)) throw new NotFoundError('Document');
      current = join(current, segment);
      let stat: Awaited<ReturnType<typeof lstat>>;
      try {
        stat = await lstat(current);
      } catch (error) {
        if (isCode(error, 'ENOENT')) throw new NotFoundError('Document');
        throw this.#mapStorageError(error);
      }
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw storageUnavailable();
      if ((await realpath(current)) !== current) throw storageUnavailable();
    }
    return current;
  }

  async #idempotencyPath(tenantId: string, idempotencyKey: string): Promise<string> {
    const key = createHash('sha256').update(tenantId).update('\0').update(idempotencyKey).digest('hex');
    const directory = await this.#ensureDirectory(['.idempotency']);
    return join(directory, `${key}.json`);
  }

  async #writeExclusive(path: string, bytes: Uint8Array): Promise<void> {
    const flags = constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW;
    const handle = await open(path, flags, 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  async #readFileNoFollow(path: string): Promise<Uint8Array<ArrayBuffer>> {
    const flags = constants.O_RDONLY | constants.O_NOFOLLOW;
    const handle = await open(path, flags);
    try {
      const stat = await handle.stat();
      if (!stat.isFile()) throw storageUnavailable();
      const source = await handle.readFile();
      const copy = new Uint8Array(source.byteLength);
      copy.set(source);
      return copy;
    } finally {
      await handle.close();
    }
  }

  async #readReference(path: string): Promise<DocumentContentReference | undefined> {
    try {
      const bytes = await this.#readFileNoFollow(path);
      return documentContentReferenceSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (error) {
      if (isCode(error, 'ENOENT')) return undefined;
      if (isCode(error, 'ELOOP')) throw storageUnavailable();
      if (error instanceof ProviderUnavailableError) throw error;
      throw new ProviderResultInvalidError({
        providerId: 'local-filesystem',
        operation: 'DOCUMENT_STORAGE',
        safeMessage: 'Stored document metadata is invalid',
      });
    }
  }

  #assertSameReference(prior: DocumentContentReference, current: DocumentContentReference): void {
    if (
      prior.storageKey !== current.storageKey ||
      prior.digest !== current.digest ||
      prior.mimeType !== current.mimeType ||
      prior.sizeBytes !== current.sizeBytes
    )
      throw new IdempotencyConflictError();
  }

  async #assertContent(reference: DocumentContentReference, expected: Uint8Array): Promise<void> {
    try {
      const segments = this.#storageKeySegments(reference.storageKey);
      const parent = await this.#ensureExistingDirectory(segments.slice(0, -1));
      const stored = await this.#readFileNoFollow(join(parent, segments[2] ?? ''));
      this.#assertDigest(reference, expected, stored);
    } catch (error) {
      throw this.#mapStorageError(error);
    }
  }

  #assertDigest(reference: DocumentContentReference, expected: Uint8Array, stored: Uint8Array): void {
    const digest = createHash('sha256').update(stored).digest('hex');
    const expectedDigest = createHash('sha256').update(expected).digest('hex');
    if (digest !== reference.digest || digest !== expectedDigest) throw new IdempotencyConflictError();
  }

  #mapStorageError(error: unknown): Error {
    if (
      error instanceof ProviderUnavailableError ||
      error instanceof ProviderResultInvalidError ||
      error instanceof IdempotencyConflictError ||
      error instanceof NotFoundError
    )
      return error;
    return storageUnavailable();
  }
}

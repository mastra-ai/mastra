import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import type { ContainerClient } from '@azure/storage-blob';

import { BlobStore } from '@mastra/core/storage';
import type { StorageBlobEntry } from '@mastra/core/storage';

/**
 * Configuration for AzureBlobStore.
 */
export interface AzureBlobStoreOptions {
  /** Azure Blob container name */
  container: string;
  /** Storage account name (required unless using connectionString) */
  accountName?: string;
  /** Storage account key */
  accountKey?: string;
  /** SAS token for authentication */
  sasToken?: string;
  /** Full connection string (takes priority over accountName/accountKey) */
  connectionString?: string;
  /**
   * Use DefaultAzureCredential from @azure/identity for authentication.
   * Requires @azure/identity to be installed as a peer dependency.
   */
  useDefaultCredential?: boolean;
  /** Custom endpoint URL (e.g. for the Azurite emulator) */
  endpoint?: string;
  /**
   * Key prefix for all blob objects.
   * Defaults to 'mastra_skill_blobs/'.
   */
  prefix?: string;
}

/** Trim leading and trailing slashes. */
function trimSlashes(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === '/') start++;
  while (end > start && s[end - 1] === '/') end--;
  return s.slice(start, end);
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { statusCode?: number }).statusCode === 404;
}

/** Azure metadata batch limit per request. */
const BATCH_DELETE_SIZE = 256;

/**
 * Azure Blob Storage-backed content-addressable blob store for skill versioning.
 *
 * Each blob is stored as a block blob keyed by its SHA-256 hash. Metadata
 * (size, mimeType, createdAt) is stored as Azure blob metadata.
 *
 * Since blobs are content-addressable, writes are idempotent — the same hash
 * always maps to the same content, so overwrites are safe and equivalent to
 * a no-op.
 *
 * @example Connection string
 * ```typescript
 * import { AzureBlobStore } from '@mastra/azure/blob';
 *
 * const blobs = new AzureBlobStore({
 *   container: 'my-skill-blobs',
 *   connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
 * });
 * ```
 *
 * @example Account key
 * ```typescript
 * import { AzureBlobStore } from '@mastra/azure/blob';
 *
 * const blobs = new AzureBlobStore({
 *   container: 'my-skill-blobs',
 *   accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME!,
 *   accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY!,
 * });
 * ```
 */
export class AzureBlobStore extends BlobStore {
  private readonly containerName: string;
  private readonly accountName?: string;
  private readonly accountKey?: string;
  private readonly sasToken?: string;
  private readonly connectionString?: string;
  private readonly useDefaultCredential: boolean;
  private readonly endpoint?: string;
  private readonly prefix: string;

  private _containerClient: ContainerClient | null = null;

  constructor(options: AzureBlobStoreOptions) {
    super();
    this.containerName = options.container;
    this.accountName = options.accountName;
    this.accountKey = options.accountKey;
    this.sasToken = options.sasToken;
    this.connectionString = options.connectionString;
    this.useDefaultCredential = options.useDefaultCredential ?? false;
    this.endpoint = options.endpoint;
    this.prefix = options.prefix ? trimSlashes(options.prefix) + '/' : 'mastra_skill_blobs/';
  }

  private async getContainerClient(): Promise<ContainerClient> {
    if (this._containerClient) return this._containerClient;

    let serviceClient: BlobServiceClient;

    if (this.connectionString) {
      serviceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    } else {
      if (!this.endpoint && !this.accountName) {
        throw new Error(
          'Azure Blob Storage requires either a connectionString, or an accountName/endpoint. ' +
            'Provide at least one of: connectionString, accountName, or endpoint.',
        );
      }
      const baseUrl = this.endpoint ?? `https://${this.accountName}.blob.core.windows.net`;

      if (this.accountName && this.accountKey) {
        const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
        serviceClient = new BlobServiceClient(baseUrl, credential);
      } else if (this.sasToken) {
        const sas = this.sasToken.replace(/^\?+/, '');
        const separator = baseUrl.includes('?') ? '&' : '?';
        serviceClient = new BlobServiceClient(`${baseUrl}${separator}${sas}`);
      } else if (this.useDefaultCredential) {
        // Dynamically import @azure/identity to avoid requiring it when not used.
        // Must use import() (not require()) because this package is ESM-first.
        try {
          const identity = await import('@azure/identity');
          const credential = new identity.DefaultAzureCredential();
          serviceClient = new BlobServiceClient(baseUrl, credential);
        } catch {
          throw new Error(
            'DefaultAzureCredential requires @azure/identity to be installed. ' +
              'Install it with: npm install @azure/identity',
          );
        }
      } else {
        // Anonymous access
        serviceClient = new BlobServiceClient(baseUrl);
      }
    }

    this._containerClient = serviceClient.getContainerClient(this.containerName);
    return this._containerClient;
  }

  private toKey(hash: string): string {
    return this.prefix + hash;
  }

  async init(): Promise<void> {
    // Azure does not require table creation — the container is expected to exist.
  }

  async put(entry: StorageBlobEntry): Promise<void> {
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlockBlobClient(this.toKey(entry.hash));
    const now = entry.createdAt ?? new Date();
    const buffer = Buffer.from(entry.content, 'utf-8');

    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: entry.mimeType ?? 'application/octet-stream',
      },
      metadata: {
        size: String(entry.size),
        createdat: now.toISOString(),
        ...(entry.mimeType ? { mimetype: entry.mimeType } : {}),
      },
    });
  }

  async get(hash: string): Promise<StorageBlobEntry | null> {
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlockBlobClient(this.toKey(hash));

    try {
      const buffer = await blobClient.downloadToBuffer();
      const properties = await blobClient.getProperties();
      const metadata = properties.metadata ?? {};
      const content = buffer.toString('utf-8');

      return {
        hash,
        content,
        size: metadata.size != null ? Number(metadata.size) : Buffer.byteLength(content, 'utf-8'),
        mimeType: metadata.mimetype || properties.contentType || undefined,
        createdAt: metadata.createdat ? new Date(metadata.createdat) : new Date(),
      };
    } catch (error: unknown) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  async has(hash: string): Promise<boolean> {
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlockBlobClient(this.toKey(hash));

    try {
      await blobClient.getProperties();
      return true;
    } catch (error: unknown) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  async delete(hash: string): Promise<boolean> {
    const containerClient = await this.getContainerClient();
    const blobClient = containerClient.getBlockBlobClient(this.toKey(hash));
    const response = await blobClient.deleteIfExists();
    return response.succeeded;
  }

  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    if (entries.length === 0) return;
    // Azure does not have a batch PUT, so we parallelize individual puts.
    // Content-addressable means duplicate writes are idempotent.
    await Promise.all(entries.map(entry => this.put(entry)));
  }

  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    if (hashes.length === 0) return result;

    const entries = await Promise.all(hashes.map(hash => this.get(hash)));
    for (const entry of entries) {
      if (entry) {
        result.set(entry.hash, entry);
      }
    }
    return result;
  }

  async dangerouslyClearAll(): Promise<void> {
    const containerClient = await this.getContainerClient();
    let batch: string[] = [];

    for await (const blob of containerClient.listBlobsFlat({ prefix: this.prefix })) {
      batch.push(blob.name);
      if (batch.length >= BATCH_DELETE_SIZE) {
        await this.deleteBlobBatch(containerClient, batch);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await this.deleteBlobBatch(containerClient, batch);
    }
  }

  private async deleteBlobBatch(containerClient: ContainerClient, blobNames: string[]): Promise<void> {
    const blobClients = blobNames.map(name => containerClient.getBlobClient(name));
    await containerClient.getBlobBatchClient().deleteBlobs(blobClients);
  }
}

/**
 * Azure Blob Storage Filesystem Provider
 *
 * A filesystem implementation backed by Azure Blob Storage.
 */

import { BlobSASPermissions, BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob';
import type { ContainerClient, RestError } from '@azure/storage-blob';

import type {
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  FilesystemInfo,
  FilesystemMountConfig,
  FilesystemIcon,
  ProviderStatus,
  MastraFilesystemOptions,
} from '@mastra/core/workspace';
import { MastraFilesystem, FileNotFoundError, FileExistsError, PermissionError } from '@mastra/core/workspace';

/**
 * Azure Blob mount configuration.
 * Returned by AzureBlobFilesystem.getMountConfig() for FUSE mounting in sandboxes.
 */
export interface AzureBlobMountConfig extends FilesystemMountConfig {
  type: 'azure-blob';
  container: string;
  accountName?: string;
  accountKey?: string;
  sasToken?: string;
  connectionString?: string;
  useDefaultCredential?: boolean;
  endpoint?: string;
  prefix?: string;
  readOnly?: boolean;
}

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.xml': 'text/xml',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.jsx': 'text/javascript',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.py': 'text/x-python',
  '.rb': 'text/x-ruby',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
};

function getMimeType(path: string): string {
  const ext = path.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? (MIME_TYPES[ext] ?? 'application/octet-stream') : 'application/octet-stream';
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const restErr = error as { statusCode?: number };
  return restErr.statusCode === 404;
}

function isAccessDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const restErr = error as { statusCode?: number };
  return restErr.statusCode === 403;
}

/** Trim leading and trailing slashes without regex (avoids polynomial regex on user input). */
function trimSlashes(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === '/') start++;
  while (end > start && s[end - 1] === '/') end--;
  return s.slice(start, end);
}

async function streamToBuffer(stream: NodeJS.ReadableStream | undefined): Promise<Buffer> {
  if (!stream) return Buffer.alloc(0);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function toBuffer(content: FileContent): Buffer {
  if (Buffer.isBuffer(content)) return content;
  return typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
}

export interface AzureBlobFilesystemOptions extends MastraFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** Azure Blob container name */
  container: string;
  /** Human-friendly display name for the UI */
  displayName?: string;
  /** Icon identifier for the UI (defaults to 'azure-blob') */
  icon?: FilesystemIcon;
  /** Description shown in tooltips */
  description?: string;
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
   * Supports Managed Identity, Azure CLI, environment variables, etc.
   * Requires @azure/identity to be installed as a peer dependency.
   */
  useDefaultCredential?: boolean;
  /** Optional prefix for all keys (acts like a subdirectory) */
  prefix?: string;
  /** Mount as read-only (blocks write operations, mounts read-only in sandboxes) */
  readOnly?: boolean;
  /**
   * Custom endpoint URL.
   * Used for local development with Azurite emulator.
   */
  endpoint?: string;
}

export class AzureBlobFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'AzureBlobFilesystem';
  readonly provider = 'azure-blob';
  readonly readOnly?: boolean;

  status: ProviderStatus = 'pending';

  readonly displayName?: string;
  readonly icon: FilesystemIcon = 'azure-blob';
  readonly description?: string;

  private readonly containerName: string;
  private readonly accountName?: string;
  private readonly accountKey?: string;
  private readonly sasToken?: string;
  private readonly connectionString?: string;
  private readonly useDefaultCredential: boolean;
  private readonly prefix: string;
  private readonly endpoint?: string;

  private _containerClient: ContainerClient | null = null;

  constructor(options: AzureBlobFilesystemOptions) {
    super({ ...options, name: 'AzureBlobFilesystem' });
    this.id = options.id ?? `azure-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.containerName = options.container;
    this.accountName = options.accountName;
    this.accountKey = options.accountKey;
    this.sasToken = options.sasToken;
    this.connectionString = options.connectionString;
    this.useDefaultCredential = options.useDefaultCredential ?? false;
    this.prefix = options.prefix ? trimSlashes(options.prefix) + '/' : '';
    this.endpoint = options.endpoint;

    this.displayName = options.displayName ?? 'Azure Blob Storage';
    this.icon = options.icon ?? 'azure-blob';
    this.description = options.description;
    this.readOnly = options.readOnly;
  }

  /**
   * Get the underlying ContainerClient for direct access to Azure Blob APIs.
   *
   * Use this when you need features not exposed through the WorkspaceFilesystem
   * interface (e.g., SAS URL generation, lease management, etc.).
   *
   * This is async because DefaultAzureCredential requires a dynamic import.
   * For non-DefaultAzureCredential auth methods, the promise resolves immediately.
   */
  getContainer(): Promise<ContainerClient> {
    return this.getContainerClient();
  }

  getMountConfig(): AzureBlobMountConfig {
    const config: AzureBlobMountConfig = {
      type: 'azure-blob',
      container: this.containerName,
    };

    if (this.connectionString) {
      config.connectionString = this.connectionString;
    } else {
      if (this.accountName) {
        config.accountName = this.accountName;
      }
      if (this.accountKey) {
        config.accountKey = this.accountKey;
      }
      if (this.sasToken) {
        config.sasToken = this.sasToken;
      }
    }

    if (this.useDefaultCredential) {
      config.useDefaultCredential = true;
    }

    if (this.endpoint) {
      config.endpoint = this.endpoint;
    }

    if (this.prefix) {
      config.prefix = this.prefix;
    }

    if (this.readOnly) {
      config.readOnly = true;
    }

    return config;
  }

  getInfo(): FilesystemInfo<{
    container: string;
    endpoint?: string;
    prefix?: string;
  }> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      error: this.error,
      readOnly: this.readOnly,
      icon: this.icon,
      metadata: {
        container: this.containerName,
        ...(this.endpoint && { endpoint: this.endpoint }),
        ...(this.prefix && { prefix: this.prefix }),
      },
    };
  }

  getInstructions(): string {
    const access = this.readOnly ? 'Read-only' : 'Persistent';
    return `Azure Blob Storage in container "${this.containerName}". ${access} storage - files are retained across sessions.`;
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

  private async getReadyContainer(): Promise<ContainerClient> {
    await this.ensureReady();
    return this.getContainerClient();
  }

  private toKey(path: string): string {
    const cleanPath = path.replace(/^\/+/, '');
    return this.prefix + cleanPath;
  }

  private handleError(error: unknown): unknown {
    if (isAccessDeniedError(error)) {
      this.status = 'error';
      this.error = 'Access denied - check credentials and container permissions';
    }
    return error;
  }

  private assertWritable(path: string, operation: string): void {
    if (this.readOnly) {
      throw new PermissionError(path, `${operation} (filesystem is read-only)`);
    }
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const containerClient = await this.getReadyContainer();
    const blobClient = containerClient.getBlockBlobClient(this.toKey(path));

    try {
      const response = await blobClient.download(0);
      const buffer = await streamToBuffer(response.readableStreamBody);

      if (options?.encoding) {
        return buffer.toString(options.encoding);
      }
      return buffer;
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        throw new FileNotFoundError(path);
      }
      throw this.handleError(error);
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    this.assertWritable(path, 'write');
    const containerClient = await this.getReadyContainer();

    if (options?.overwrite === false && (await this.exists(path))) {
      throw new FileExistsError(path);
    }

    const body = toBuffer(content);
    const contentType = getMimeType(path);
    const blobClient = containerClient.getBlockBlobClient(this.toKey(path));

    await blobClient.upload(body, body.length, {
      blobHTTPHeaders: { blobContentType: contentType },
    });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    this.assertWritable(path, 'append');
    let existing: Buffer = Buffer.alloc(0);
    try {
      const read = await this.readFile(path);
      existing = Buffer.isBuffer(read) ? read : Buffer.from(read);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        // File doesn't exist, start fresh with empty buffer
      } else {
        throw error;
      }
    }

    const appendBuffer = toBuffer(content);
    await this.writeFile(path, Buffer.concat([existing, appendBuffer]));
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable(path, 'delete');
    const isDir = await this.isDirectory(path);
    if (isDir) {
      await this.rmdir(path, { recursive: true, force: options?.force });
      return;
    }

    const containerClient = await this.getReadyContainer();
    const blobClient = containerClient.getBlobClient(this.toKey(path));

    try {
      await blobClient.delete();
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        if (options?.force) return;
        throw new FileNotFoundError(path);
      }
      throw this.handleError(error);
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable(dest, 'copy');
    if (options?.overwrite === false && (await this.exists(dest))) {
      throw new FileExistsError(dest);
    }

    const containerClient = await this.getReadyContainer();
    const srcBlob = containerClient.getBlobClient(this.toKey(src));
    const destBlob = containerClient.getBlobClient(this.toKey(dest));

    try {
      const sasUrl = await srcBlob.generateSasUrl({
        permissions: BlobSASPermissions.parse('r'),
        expiresOn: new Date(Date.now() + 5 * 60 * 1000),
      });

      const properties = await srcBlob.getProperties();

      if (properties.contentLength === 0) {
        // Azure bug: syncCopyFromURL fails on zero-length blobs with CannotVerifyCopySource
        await destBlob.getBlockBlobClient().upload(Buffer.alloc(0), 0);
        return;
      }

      const MAX_SYNC_COPY_SIZE = 256 * 1024 * 1024;
      if ((properties.contentLength ?? 0) <= MAX_SYNC_COPY_SIZE) {
        await destBlob.syncCopyFromURL(sasUrl);
      } else {
        const poller = await destBlob.beginCopyFromURL(sasUrl);
        await poller.pollUntilDone();
      }
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        throw new FileNotFoundError(src);
      }

      // SAS generation fails without StorageSharedKeyCredential (e.g. DefaultAzureCredential).
      // Fall back to download+reupload.
      if (
        error instanceof Error &&
        (error.message.includes('generateSasUrl') ||
          (error.message.includes('SAS') && error.message.includes('shared key credential')))
      ) {
        const content = await this.readFile(src);
        await this.writeFile(dest, content);
        return;
      }

      throw this.handleError(error);
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable(dest, 'move');
    await this.copyFile(src, dest, options);
    await this.deleteFile(src, { force: true });
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    // Azure Blob Storage doesn't have real directories - they're just key prefixes.
    // No-op, directories are created implicitly when files are written.
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable(path, 'rmdir');
    const containerClient = await this.getReadyContainer();
    const prefix = this.toKey(path).replace(/\/$/, '') + '/';

    if (!options?.recursive) {
      const iter = containerClient.listBlobsFlat({ prefix });
      const first = await iter.next();
      if (!first.done) {
        throw new Error(`Directory not empty: ${path}`);
      }
      return;
    }

    // Delete all blobs with this prefix in batches
    let blobNames: string[] = [];
    for await (const blob of containerClient.listBlobsFlat({ prefix })) {
      blobNames.push(blob.name);

      if (blobNames.length >= 256) {
        await this.deleteBlobBatch(containerClient, blobNames);
        blobNames = [];
      }
    }

    if (blobNames.length > 0) {
      await this.deleteBlobBatch(containerClient, blobNames);
    }
  }

  private async deleteBlobBatch(containerClient: ContainerClient, blobNames: string[]): Promise<void> {
    const blobClients = blobNames.map(name => containerClient.getBlobClient(name));
    await containerClient.getBlobBatchClient().deleteBlobs(blobClients);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const containerClient = await this.getReadyContainer();

    const prefix = this.toKey(path).replace(/\/$/, '');
    const searchPrefix = prefix ? prefix + '/' : '';

    const entries: FileEntry[] = [];
    const seenDirs = new Set<string>();

    if (options?.recursive) {
      for await (const blob of containerClient.listBlobsFlat({ prefix: searchPrefix })) {
        const key = blob.name;
        if (!key || key === searchPrefix) continue;

        const relativePath = key.slice(searchPrefix.length);
        if (!relativePath) continue;

        if (relativePath.endsWith('/')) {
          const dirName = relativePath.slice(0, -1);
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            entries.push({ name: dirName, type: 'directory' });
          }
          continue;
        }

        if (options?.extension) {
          const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
          if (!extensions.some(ext => relativePath.endsWith(ext))) {
            continue;
          }
        }

        entries.push({
          name: relativePath,
          type: 'file',
          size: blob.properties.contentLength,
        });
      }
    } else {
      for await (const item of containerClient.listBlobsByHierarchy('/', { prefix: searchPrefix })) {
        if (item.kind === 'prefix') {
          const dirName = item.name.slice(searchPrefix.length).replace(/\/$/, '');
          if (dirName && !seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            entries.push({ name: dirName, type: 'directory' });
          }
        } else {
          const key = item.name;
          if (!key || key === searchPrefix) continue;

          const relativePath = key.slice(searchPrefix.length);
          if (!relativePath) continue;

          if (relativePath.endsWith('/')) {
            const dirName = relativePath.slice(0, -1);
            if (!seenDirs.has(dirName)) {
              seenDirs.add(dirName);
              entries.push({ name: dirName, type: 'directory' });
            }
            continue;
          }

          if (options?.extension) {
            const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
            if (!extensions.some(ext => relativePath.endsWith(ext))) {
              continue;
            }
          }

          entries.push({
            name: relativePath,
            type: 'file',
            size: item.properties.contentLength,
          });
        }
      }
    }

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    const key = this.toKey(path);
    if (!key) return true;

    const containerClient = await this.getReadyContainer();
    const blobClient = containerClient.getBlobClient(key);

    const exists = await blobClient.exists();
    if (exists) return true;

    // Check if it's a "directory" (has blobs with this prefix)
    const prefix = key.replace(/\/$/, '') + '/';
    const iter = containerClient.listBlobsFlat({ prefix });
    const first = await iter.next();
    return !first.done;
  }

  async stat(path: string): Promise<FileStat> {
    const key = this.toKey(path);

    if (!key) {
      return {
        name: '',
        path,
        type: 'directory',
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
    }

    const containerClient = await this.getReadyContainer();
    const blobClient = containerClient.getBlobClient(key);

    try {
      const properties = await blobClient.getProperties();
      const name = path.split('/').pop() ?? '';

      return {
        name,
        path,
        type: 'file',
        size: properties.contentLength ?? 0,
        createdAt: properties.createdOn ?? new Date(),
        modifiedAt: properties.lastModified ?? new Date(),
      };
    } catch (error: unknown) {
      if (!isNotFoundError(error)) throw this.handleError(error);

      const isDir = await this.isDirectory(path);
      if (isDir) {
        const name = path.split('/').filter(Boolean).pop() ?? '';
        return {
          name,
          path,
          type: 'directory',
          size: 0,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }

      throw new FileNotFoundError(path);
    }
  }

  async isFile(path: string): Promise<boolean> {
    const key = this.toKey(path);
    if (!key) return false;

    const containerClient = await this.getReadyContainer();
    const blobClient = containerClient.getBlobClient(key);
    return blobClient.exists();
  }

  async isDirectory(path: string): Promise<boolean> {
    const key = this.toKey(path);
    if (!key) return true;

    const containerClient = await this.getReadyContainer();
    const prefix = key.replace(/\/$/, '') + '/';
    const iter = containerClient.listBlobsFlat({ prefix });
    const first = await iter.next();
    return !first.done;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    const containerClient = await this.getContainerClient();
    try {
      if (this.sasToken) {
        const iter = containerClient.listBlobsFlat({ prefix: this.prefix });
        await iter.next();
        return;
      }

      const exists = await containerClient.exists();
      if (!exists) {
        const err = new Error(`Container "${this.containerName}" does not exist`) as Error & { status?: number };
        err.status = 404;
        throw err;
      }
    } catch (error) {
      if ((error as { status?: number }).status) {
        throw error;
      }

      const statusCode = (error as RestError).statusCode;
      if (typeof statusCode === 'number') {
        const message = error instanceof Error ? error.message : String(error);
        const err = new Error(message) as Error & { status?: number };
        err.status = statusCode;
        throw err;
      }
      throw error;
    }
  }

  async destroy(): Promise<void> {
    this._containerClient = null;
  }
}

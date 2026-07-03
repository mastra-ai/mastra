import { Buffer } from 'node:buffer';
import nodePath from 'node:path';
import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FileStat,
  FilesystemIcon,
  FilesystemInfo,
  ListOptions,
  MastraFilesystemOptions,
  ProviderStatus,
  ReadOptions,
  RemoveOptions,
  WriteOptions,
} from '@mastra/core/workspace';
import { FileExistsError, FileNotFoundError, MastraFilesystem, WorkspaceReadOnlyError } from '@mastra/core/workspace';
import type { PlatformClientOptions } from './client.js';
import { PlatformClient } from './client.js';

interface ProxyListResponse {
  contents?: Array<{ key?: string; size?: number; lastModified?: string }>;
  commonPrefixes?: string[];
}

export interface PlatformFilesystemOptions extends PlatformClientOptions, MastraFilesystemOptions {
  id?: string;
  bucketName?: string;
  readOnly?: boolean;
  displayName?: string;
  icon?: FilesystemIcon;
  description?: string;
}

function normalizePath(input: string): string {
  if (!input || input === '.') return '/';
  let normalized = input.startsWith('/') ? input : `/${input}`;
  normalized = nodePath.posix.normalize(normalized);
  return normalized === '.' ? '/' : normalized;
}

function keyFromPath(path: string): string {
  const normalized = normalizePath(path);
  return normalized === '/' ? '' : normalized.slice(1);
}

function nameFromPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '';
  return normalized.slice(normalized.lastIndexOf('/') + 1);
}

function contentToBody(content: FileContent): string | Buffer {
  if (typeof content === 'string') return content;
  return Buffer.from(content);
}

function headerDate(headers: Headers, name: string): Date {
  const value = headers.get(name);
  return value ? new Date(value) : new Date(0);
}

function headerSize(headers: Headers): number {
  const value = headers.get('content-length');
  return value ? Number(value) : 0;
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404;
}

export class PlatformFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'PlatformFilesystem';
  readonly provider = 'platform';
  readonly readOnly?: boolean;
  readonly displayName?: string;
  readonly icon: FilesystemIcon;
  readonly description?: string;
  status: ProviderStatus = 'pending';

  private readonly client: PlatformClient;
  private readonly bucketName: string;

  constructor(options: PlatformFilesystemOptions = {}) {
    super({ ...options, name: 'PlatformFilesystem' });
    this.id = options.id ?? `platform-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.bucketName = options.bucketName ?? process.env.MASTRA_PLATFORM_BUCKET_NAME ?? '';
    if (!this.bucketName) throw new Error('bucketName is required');
    this.readOnly = options.readOnly;
    this.displayName = options.displayName;
    this.icon = options.icon ?? 'cloud';
    this.description = options.description;
    this.client = new PlatformClient(options);
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    await this.ensureReady();
    const response = await this.client.request(`/fs/${encodeURIComponent(this.bucketName)}/${keyFromPath(path)}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    return options?.encoding ? buffer.toString(options.encoding) : buffer;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    await this.ensureReady();
    if (this.readOnly) throw new WorkspaceReadOnlyError('writeFile');
    const headers: Record<string, string> = {};
    if (options?.mimeType) headers['content-type'] = options.mimeType;
    if (options?.overwrite === false) headers['if-none-match'] = '*';
    try {
      await this.client.request(`/fs/${encodeURIComponent(this.bucketName)}/${keyFromPath(path)}`, {
        method: 'PUT',
        headers,
        body: contentToBody(content),
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'status' in error && error.status === 412) {
        throw new FileExistsError(path);
      }
      throw error;
    }
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const existing = (await this.exists(path)) ? await this.readFile(path) : Buffer.alloc(0);
    await this.writeFile(
      path,
      Buffer.concat([Buffer.isBuffer(existing) ? existing : Buffer.from(existing), Buffer.from(content)]),
    );
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    if (this.readOnly) throw new WorkspaceReadOnlyError('deleteFile');
    try {
      await this.client.request(`/fs/${encodeURIComponent(this.bucketName)}/${keyFromPath(path)}`, {
        method: 'DELETE',
        query: { recursive: options?.recursive },
      });
    } catch (error) {
      if (isNotFound(error) && options?.force) return;
      if (isNotFound(error)) throw new FileNotFoundError(path);
      throw error;
    }
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    if (this.readOnly) throw new WorkspaceReadOnlyError('copyFile');
    await this.client.request(`/fs/${encodeURIComponent(this.bucketName)}/${keyFromPath(src)}`, {
      method: 'POST',
      query: { op: 'copy' },
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ destination: keyFromPath(dest) }),
    });
  }

  async moveFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    if (this.readOnly) throw new WorkspaceReadOnlyError('moveFile');
    await this.client.request(`/fs/${encodeURIComponent(this.bucketName)}/${keyFromPath(src)}`, {
      method: 'POST',
      query: { op: 'rename' },
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ destination: keyFromPath(dest) }),
    });
  }

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    if (this.readOnly) throw new WorkspaceReadOnlyError('mkdir');
    await this.client.request(`/fs/${encodeURIComponent(this.bucketName)}/${keyFromPath(path)}`, {
      method: 'POST',
      query: { op: 'mkdir' },
    });
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    await this.deleteFile(path.endsWith('/') ? path : `${path}/`, { recursive: true, force: options?.force });
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    await this.ensureReady();
    const prefix = keyFromPath(path);
    const response = await this.client.request(`/fs/${encodeURIComponent(this.bucketName)}/${prefix}`, {
      query: {
        delimiter: options?.recursive ? undefined : '/',
        prefix: prefix ? `${prefix.replace(/\/$/, '')}/` : undefined,
      },
    });
    const json = (await response.json()) as ProxyListResponse;
    return [
      ...(json.commonPrefixes ?? []).map(prefix => ({
        name: nameFromPath(prefix.replace(/\/$/, '')),
        type: 'directory' as const,
      })),
      ...(json.contents ?? [])
        .filter(object => object.key && !object.key.endsWith('/'))
        .map(object => ({
          name: nameFromPath(object.key!),
          type: 'file' as const,
          size: object.size,
        })),
    ].filter(
      entry => !options?.extension || entry.type === 'directory' || matchesExtension(entry.name, options.extension),
    );
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch (error) {
      if (isNotFound(error) || error instanceof FileNotFoundError) return false;
      throw error;
    }
  }

  async stat(path: string): Promise<FileStat> {
    await this.ensureReady();
    const normalized = normalizePath(path);
    if (normalized === '/') {
      return { name: '', path: '/', type: 'directory', size: 0, createdAt: new Date(0), modifiedAt: new Date(0) };
    }
    const response = await this.client.request(`/fs/${encodeURIComponent(this.bucketName)}/${keyFromPath(path)}`, {
      method: 'HEAD',
    });
    return {
      name: nameFromPath(path),
      path: normalized,
      type: normalized.endsWith('/') ? 'directory' : 'file',
      size: headerSize(response.headers),
      createdAt: headerDate(response.headers, 'last-modified'),
      modifiedAt: headerDate(response.headers, 'last-modified'),
      mimeType: response.headers.get('content-type') ?? undefined,
    };
  }

  getInfo(): FilesystemInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      readOnly: this.readOnly,
      icon: this.icon,
      metadata: {
        bucketName: this.bucketName,
        ...(this.displayName && { displayName: this.displayName }),
        ...(this.description && { description: this.description }),
      },
    };
  }
}

function matchesExtension(name: string, extension: string | string[]): boolean {
  const extensions = Array.isArray(extension) ? extension : [extension];
  return extensions.some(ext => name.endsWith(ext));
}

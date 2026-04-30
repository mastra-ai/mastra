import { createSign } from 'node:crypto';
import type { RequestContext } from '@mastra/core/request-context';
import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  MastraFilesystem,
  NotDirectoryError,
  StaleFileError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FileStat,
  FilesystemInfo,
  InstructionsOption,
  ListOptions,
  MastraFilesystemOptions,
  ProviderStatus,
  ReadOptions,
  RemoveOptions,
  WriteOptions,
} from '@mastra/core/workspace';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
// Use the full `drive` scope by default — `drive.file` only exposes files the app created or
// the user explicitly opened via a picker, so a folder shared with the service account would
// be invisible and return 404 on access.
const DEFAULT_SCOPES = ['https://www.googleapis.com/auth/drive'];

/**
 * Resolve an instructions override against default instructions.
 *
 * - `undefined` → return default
 * - `string` → return the string as-is
 * - `function` → call with { defaultInstructions, requestContext }
 */
function resolveInstructions(
  override: InstructionsOption | undefined,
  getDefault: () => string,
  requestContext?: RequestContext,
): string {
  if (typeof override === 'string') return override;
  const defaultInstructions = getDefault();
  if (override === undefined) return defaultInstructions;
  return override({ defaultInstructions, requestContext });
}

export interface GoogleDriveServiceAccount {
  clientEmail: string;
  privateKey: string;
  privateKeyId?: string;
  scopes?: string[];
  subject?: string;
}

export interface GoogleDriveFilesystemOptions extends MastraFilesystemOptions {
  id?: string;
  folderId: string;
  accessToken?: string;
  getAccessToken?: () => string | Promise<string>;
  serviceAccount?: GoogleDriveServiceAccount;
  readOnly?: boolean;
  instructions?: InstructionsOption;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
}

export class GoogleDriveFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'GoogleDriveFilesystem';
  readonly provider = 'google-drive';
  readonly readOnly?: boolean;
  readonly icon = 'drive';
  readonly displayName = 'Google Drive';

  status: ProviderStatus = 'pending';

  private accessToken?: string;
  private tokenExpiresAt = 0;
  private tokenRefreshPromise?: Promise<string>;
  private readonly folderId: string;
  private readonly getAccessToken?: () => string | Promise<string>;
  private readonly serviceAccount?: GoogleDriveServiceAccount;
  private readonly instructionsOverride?: InstructionsOption;

  constructor(options: GoogleDriveFilesystemOptions) {
    super({ name: 'GoogleDriveFilesystem', ...options });
    this.id = options.id ?? `google-drive:${options.folderId}`;
    this.folderId = options.folderId;
    this.accessToken = options.accessToken;
    this.getAccessToken = options.getAccessToken;
    this.serviceAccount = options.serviceAccount;
    this.readOnly = options.readOnly;
    this.instructionsOverride = options.instructions;
  }

  async init(): Promise<void> {
    const driveFile = await this.request<DriveFile>(`${DRIVE_API}/files/${encodeURIComponent(this.folderId)}`, {
      searchParams: { fields: 'id,name,mimeType,trashed', supportsAllDrives: 'true' },
    });

    if (driveFile.trashed) {
      throw new Error(`Google Drive folder ${this.folderId} is trashed and cannot be used as a filesystem root.`);
    }

    if (driveFile.mimeType !== FOLDER_MIME_TYPE) {
      throw new Error(
        `Google Drive root ${this.folderId} must be a folder, but received mimeType ${driveFile.mimeType ?? 'unknown'}.`,
      );
    }
  }

  async destroy(): Promise<void> {}

  async isReady(): Promise<boolean> {
    return this.status === 'ready';
  }

  getInfo(): FilesystemInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      error: this.error,
      readOnly: this.readOnly,
      icon: this.icon,
      metadata: { folderId: this.folderId },
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    const defaultInstructions = [
      'Google Drive filesystem mounted to a single folder.',
      'Use POSIX-style paths relative to that folder, for example /notes/todo.txt.',
      'Directories are Google Drive folders. File names must be unique within each folder for path-based operations.',
      this.readOnly
        ? 'This Google Drive filesystem is read-only.'
        : 'You can read, create, update, move, copy, and delete files in this folder.',
    ].join('\n');
    return resolveInstructions(this.instructionsOverride, () => defaultInstructions, opts?.requestContext);
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    await this.ensureReady();
    const file = await this.getFile(path);
    if (file.mimeType === FOLDER_MIME_TYPE) throw new IsDirectoryError(path);
    const response = await this.fetch(`${DRIVE_API}/files/${encodeURIComponent(file.id)}`, {
      method: 'GET',
      searchParams: { alt: 'media' },
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    return options?.encoding ? buffer.toString(options.encoding) : buffer;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('writeFile');
    const existing = await this.findFile(path);
    if (existing) {
      if (existing.mimeType === FOLDER_MIME_TYPE) throw new IsDirectoryError(path);
      if (options?.overwrite === false) throw new FileExistsError(path);
      if (options?.expectedMtime) {
        if (!existing.modifiedTime) throw new StaleFileError(path, options.expectedMtime, new Date(0));

        const actual = new Date(existing.modifiedTime);
        if (actual.getTime() !== options.expectedMtime.getTime())
          throw new StaleFileError(path, options.expectedMtime, actual);
      }
      await this.upload(existing.id, content, options?.mimeType, 'PATCH');
      return;
    }

    const { parentId, name } = await this.resolveParent(path, options?.recursive ?? true);
    await this.upload(undefined, content, options?.mimeType, 'POST', { name, parents: [parentId] });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    await this.ensureReady();
    this.assertWritable('appendFile');
    const existing = await this.findFile(path);
    if (existing) {
      if (existing.mimeType === FOLDER_MIME_TYPE) throw new IsDirectoryError(path);
      const current = await this.readFile(path);
      const expectedMtime = existing.modifiedTime ? new Date(existing.modifiedTime) : undefined;
      await this.writeFile(path, Buffer.concat([this.toBuffer(current), this.toBuffer(content)]), {
        expectedMtime,
      });
    } else {
      await this.writeFile(path, content, { recursive: true });
    }
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('deleteFile');
    const file = await this.findFile(path);
    if (!file) {
      if (options?.force) return;
      throw new FileNotFoundError(path);
    }
    if (file.mimeType === FOLDER_MIME_TYPE) throw new IsDirectoryError(path);
    await this.request<void>(`${DRIVE_API}/files/${encodeURIComponent(file.id)}`, { method: 'DELETE' });
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('copyFile');
    const source = await this.getFile(src);
    if (source.mimeType === FOLDER_MIME_TYPE) throw new IsDirectoryError(src);
    const existing = await this.findFile(dest);
    if (existing) {
      if (existing.id === source.id) throw new FileExistsError(dest);
      if (existing.mimeType === FOLDER_MIME_TYPE || options?.overwrite === false) throw new FileExistsError(dest);
      await this.deleteAny(existing, dest, true);
    }
    const { parentId, name } = await this.resolveParent(dest, options?.recursive ?? true);
    await this.request(`${DRIVE_API}/files/${encodeURIComponent(source.id)}/copy`, {
      method: 'POST',
      body: JSON.stringify({ name, parents: [parentId] }),
    });
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('moveFile');
    const source = await this.getFile(src);
    if (options?.overwrite === false && (await this.exists(dest))) throw new FileExistsError(dest);
    const existing = await this.findFile(dest);
    if (existing && existing.id !== source.id) {
      if (existing.mimeType === FOLDER_MIME_TYPE || options?.overwrite === false) throw new FileExistsError(dest);
      await this.deleteAny(existing, dest, true);
    }
    const { parentId, name } = await this.resolveParent(dest, options?.recursive ?? true);
    const searchParams: Record<string, string> = { addParents: parentId, fields: 'id', supportsAllDrives: 'true' };
    const oldParents = source.parents?.join(',');
    if (oldParents) searchParams.removeParents = oldParents;
    await this.request(`${DRIVE_API}/files/${encodeURIComponent(source.id)}`, {
      method: 'PATCH',
      searchParams,
      body: JSON.stringify({ name }),
    });
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    this.assertWritable('mkdir');
    if (this.normalize(path) === '/') return;
    const existing = await this.findFile(path);
    if (existing) {
      if (existing.mimeType !== FOLDER_MIME_TYPE) throw new FileExistsError(path);
      return;
    }
    const { parentId, name } = await this.resolveParent(path, options?.recursive ?? true);
    await this.createFolder(parentId, name);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('rmdir');
    const dir = await this.findFile(path);
    if (!dir) {
      if (options?.force) return;
      throw new DirectoryNotFoundError(path);
    }
    if (dir.mimeType !== FOLDER_MIME_TYPE) throw new NotDirectoryError(path);
    if (!options?.recursive) {
      const children = await this.listChildren(dir.id);
      if (children.length) throw new DirectoryNotEmptyError(path);
    }
    await this.request<void>(`${DRIVE_API}/files/${encodeURIComponent(dir.id)}`, { method: 'DELETE' });
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    await this.ensureReady();
    const dir = await this.getFile(path);
    if (dir.mimeType !== FOLDER_MIME_TYPE) throw new NotDirectoryError(path);
    const entries = await this.readdirRecursive(dir.id, options, 0);
    const extensions = Array.isArray(options?.extension)
      ? options.extension
      : options?.extension
        ? [options.extension]
        : undefined;
    return extensions
      ? entries.filter(entry => entry.type === 'directory' || extensions.some(ext => entry.name.endsWith(ext)))
      : entries;
  }

  async exists(path: string): Promise<boolean> {
    await this.ensureReady();
    return Boolean(await this.findFile(path));
  }

  async stat(path: string): Promise<FileStat> {
    await this.ensureReady();
    const file = await this.getFile(path);
    const isDirectory = file.mimeType === FOLDER_MIME_TYPE;
    return {
      name: file.name,
      path: this.normalize(path),
      type: isDirectory ? 'directory' : 'file',
      size: Number(file.size ?? 0),
      createdAt: file.createdTime ? new Date(file.createdTime) : new Date(0),
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : new Date(0),
      mimeType: isDirectory ? undefined : file.mimeType,
    };
  }

  async realpath(path: string): Promise<string> {
    return this.normalize(path);
  }

  private assertWritable(operation: string): void {
    if (this.readOnly) throw new WorkspaceReadOnlyError(operation);
  }

  private toBuffer(content: FileContent): Buffer {
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    return Buffer.from(content, 'utf-8');
  }

  private normalize(path: string): string {
    const parts = path.split('/').filter(Boolean);
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }
    return `/${stack.join('/')}`;
  }

  private async getFile(path: string): Promise<DriveFile> {
    const file = await this.findFile(path);
    if (!file) throw new FileNotFoundError(path);
    return file;
  }

  private async findFile(path: string): Promise<DriveFile | undefined> {
    const normalized = this.normalize(path);
    if (normalized === '/') return this.rootFile();
    const names = normalized.split('/').filter(Boolean);
    let parentId = this.folderId;
    let file: DriveFile | undefined;
    for (const name of names) {
      file = await this.findChild(parentId, name);
      if (!file) return undefined;
      parentId = file.id;
    }
    return file;
  }

  private async rootFile(): Promise<DriveFile> {
    return this.request<DriveFile>(`${DRIVE_API}/files/${encodeURIComponent(this.folderId)}`, {
      searchParams: { fields: 'id,name,mimeType,size,createdTime,modifiedTime,parents', supportsAllDrives: 'true' },
    });
  }

  private async resolveParent(path: string, recursive: boolean): Promise<{ parentId: string; name: string }> {
    const normalized = this.normalize(path);
    const parts = normalized.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new IsDirectoryError(path);
    const parentPath = `/${parts.join('/')}`;
    const parent = recursive ? await this.resolveDir(parentPath, true) : await this.findFile(parentPath);
    if (!parent) throw new DirectoryNotFoundError(parentPath);
    if (parent.mimeType !== FOLDER_MIME_TYPE) throw new NotDirectoryError(parentPath);
    return { parentId: parent.id, name };
  }

  private async resolveDir(path: string, recursive: boolean): Promise<DriveFile> {
    const normalized = this.normalize(path);
    if (normalized === '/') return this.rootFile();
    const names = normalized.split('/').filter(Boolean);
    let parentId = this.folderId;
    let current: DriveFile | undefined;
    for (const name of names) {
      current = await this.findChild(parentId, name);
      if (current) {
        if (current.mimeType !== FOLDER_MIME_TYPE) throw new NotDirectoryError(name);
        parentId = current.id;
        continue;
      }
      if (!recursive) throw new DirectoryNotFoundError(normalized);
      current = await this.createFolder(parentId, name);
      parentId = current.id;
    }
    return current!;
  }

  private async createFolder(parentId: string, name: string): Promise<DriveFile> {
    return this.request<DriveFile>(`${DRIVE_API}/files`, {
      method: 'POST',
      searchParams: { fields: 'id,name,mimeType,size,createdTime,modifiedTime,parents', supportsAllDrives: 'true' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, parents: [parentId] }),
    });
  }

  private async findChild(parentId: string, name: string): Promise<DriveFile | undefined> {
    const files = await this.listChildren(parentId, `name = '${this.escapeQuery(name)}'`);
    return files[0];
  }

  private async listChildren(parentId: string, extraQuery?: string): Promise<DriveFile[]> {
    const query = [`'${this.escapeQuery(parentId)}' in parents`, 'trashed = false', extraQuery]
      .filter(Boolean)
      .join(' and ');
    const files: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const result = await this.request<{ files: DriveFile[]; nextPageToken?: string }>(`${DRIVE_API}/files`, {
        searchParams: {
          q: query,
          fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,parents)',
          pageSize: '1000',
          supportsAllDrives: 'true',
          includeItemsFromAllDrives: 'true',
          ...(pageToken ? { pageToken } : {}),
        },
      });
      files.push(...(result.files ?? []));
      pageToken = result.nextPageToken;
    } while (pageToken);

    return files;
  }

  private async readdirRecursive(
    parentId: string,
    options: ListOptions | undefined,
    depth: number,
  ): Promise<FileEntry[]> {
    const children = await this.listChildren(parentId);
    const entries: FileEntry[] = [];
    for (const child of children) {
      const isDirectory = child.mimeType === FOLDER_MIME_TYPE;
      entries.push({ name: child.name, type: isDirectory ? 'directory' : 'file', size: Number(child.size ?? 0) });
      const shouldDescend =
        isDirectory && options?.recursive && (options.maxDepth === undefined || depth < options.maxDepth);
      if (shouldDescend) {
        const nested = await this.readdirRecursive(child.id, options, depth + 1);
        entries.push(...nested.map(entry => ({ ...entry, name: `${child.name}/${entry.name}` })));
      }
    }
    return entries;
  }

  private async deleteAny(file: DriveFile, path: string, recursive: boolean): Promise<void> {
    if (file.mimeType === FOLDER_MIME_TYPE) await this.rmdir(path, { recursive, force: true });
    else await this.deleteFile(path, { force: true });
  }

  private async upload(
    fileId: string | undefined,
    content: FileContent,
    mimeType = 'application/octet-stream',
    method: 'POST' | 'PATCH',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const boundary = `mastra-${Date.now()}`;
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata ?? {})}\r\n`,
      ),
      Buffer.from(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      this.toBuffer(content),
      Buffer.from(`\r\n--${boundary}--`),
    ]);
    const url = fileId ? `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}` : `${DRIVE_UPLOAD_API}/files`;
    await this.request(url, {
      method,
      searchParams: { uploadType: 'multipart', fields: 'id', supportsAllDrives: 'true' },
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
  }

  private escapeQuery(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private async request<T>(
    url: string,
    init: RequestInit & { searchParams?: Record<string, string> } = {},
  ): Promise<T> {
    const response = await this.fetch(url, init);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async fetch(
    url: string,
    init: RequestInit & { searchParams?: Record<string, string> } = {},
  ): Promise<Response> {
    const token = await this.getToken();
    const target = new URL(url);
    for (const [key, value] of Object.entries(init.searchParams ?? {})) target.searchParams.set(key, value);
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    // Auto-apply Content-Type for JSON bodies when not explicitly set (e.g. multipart uploads).
    if (init.body && typeof init.body === 'string' && !init.headers) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await globalThis.fetch(target, {
      ...init,
      headers: { ...headers, ...(init.headers as Record<string, string>) },
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`Google Drive API request failed (${response.status}): ${message}`);
    }
    return response;
  }

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60_000) return this.accessToken;
    if (this.getAccessToken) return this.getAccessToken();
    if (this.serviceAccount) {
      // Dedup concurrent refresh attempts — all callers share the same in-flight promise.
      if (!this.tokenRefreshPromise) {
        this.tokenRefreshPromise = this.getServiceAccountToken().finally(() => {
          this.tokenRefreshPromise = undefined;
        });
      }
      return this.tokenRefreshPromise;
    }
    if (this.accessToken) return this.accessToken;
    throw new Error('GoogleDriveFilesystem requires accessToken, getAccessToken, or serviceAccount authentication.');
  }

  private async getServiceAccountToken(): Promise<string> {
    const account = this.serviceAccount!;
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT', ...(account.privateKeyId ? { kid: account.privateKeyId } : {}) };
    const claim = {
      iss: account.clientEmail,
      scope: (account.scopes ?? DEFAULT_SCOPES).join(' '),
      aud: OAUTH_TOKEN_URL,
      exp: now + 3600,
      iat: now,
      ...(account.subject ? { sub: account.subject } : {}),
    };
    const unsigned = `${this.base64Url(JSON.stringify(header))}.${this.base64Url(JSON.stringify(claim))}`;
    const privateKey = this.normalizePrivateKey(account.privateKey);
    let signature: string;
    try {
      signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey, 'base64url');
    } catch (err) {
      const hasBegin = privateKey.includes('-----BEGIN');
      const hasEnd = privateKey.includes('-----END');
      throw new Error(
        `Google service account private key signing failed (${(err as Error).message}). ` +
          `Key has BEGIN marker: ${hasBegin}, END marker: ${hasEnd}. ` +
          `Ensure your .env value contains the raw PEM with \\n for newlines, without extra surrounding quotes or commas.`,
      );
    }
    const response = await globalThis.fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${unsigned}.${signature}`,
      }),
    });
    if (!response.ok)
      throw new Error(`Google service account token request failed (${response.status}): ${await response.text()}`);
    const json = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = json.access_token;
    this.tokenExpiresAt = Date.now() + json.expires_in * 1000;
    return json.access_token;
  }

  private base64Url(value: string): string {
    return Buffer.from(value).toString('base64url');
  }

  private normalizePrivateKey(key: string): string {
    let out = key.trim();
    // Iteratively strip JSON-style wrapping that .env files tend to accumulate:
    // trailing commas, literal backslash-escaped quotes, and plain surrounding quotes.
    // Loop because values can be doubly wrapped (e.g. a JSON-encoded string pasted into
    // a .env file still wrapped in quotes by the dotenv loader).
    for (let i = 0; i < 5; i++) {
      const before = out;
      if (out.endsWith(',')) out = out.slice(0, -1).trim();
      if ((out.startsWith('"') && out.endsWith('"')) || (out.startsWith("'") && out.endsWith("'"))) {
        out = out.slice(1, -1);
      }
      if ((out.startsWith('\\"') && out.endsWith('\\"')) || (out.startsWith("\\'") && out.endsWith("\\'"))) {
        out = out.slice(2, -2);
      }
      if (out === before) break;
    }
    // Replace escaped newlines with real newlines (common when storing the key on one line in .env).
    out = out.replace(/\\n/g, '\n');
    // Unescape any remaining escaped quotes that survived the unwrapping.
    out = out.replace(/\\"/g, '"').replace(/\\'/g, "'");
    // Normalize CRLF / CR to LF — OpenSSL's PEM decoder is strict about line endings.
    out = out.replace(/\r\n?/g, '\n');
    // Ensure PEM ends with a trailing newline — required by some OpenSSL versions.
    if (!out.endsWith('\n')) out += '\n';
    return out;
  }
}

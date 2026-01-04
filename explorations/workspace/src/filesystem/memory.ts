/**
 * MemoryFilesystem - An in-memory filesystem provider.
 *
 * Perfect for testing, ephemeral thread workspaces, and fast operations.
 * Data is lost when the process exits.
 */

import type {
  WorkspaceFilesystem,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  MemoryFSProviderConfig,
} from './types';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
} from './types';

interface MemoryNode {
  type: 'file' | 'directory';
  content?: Buffer;
  mimeType?: string;
  createdAt: Date;
  modifiedAt: Date;
  children?: Map<string, MemoryNode>;
}

export class MemoryFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'MemoryFilesystem';
  readonly provider = 'memory';

  private root: MemoryNode;

  constructor(config: MemoryFSProviderConfig) {
    this.id = config.id;
    this.root = {
      type: 'directory',
      createdAt: new Date(),
      modifiedAt: new Date(),
      children: new Map(),
    };

    // Initialize with initial files if provided
    if (config.initialFiles) {
      for (const [path, content] of Object.entries(config.initialFiles)) {
        this.writeFileSync(path, content);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Path Utilities
  // ---------------------------------------------------------------------------

  private parsePath(inputPath: string): string[] {
    // Normalize path
    const normalized = inputPath.replace(/\\/g, '/').replace(/\/+/g, '/');
    // Remove leading/trailing slashes and split
    const parts = normalized.split('/').filter((p) => p && p !== '.');

    // Handle .. by resolving the path
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }

    return resolved;
  }

  private getNode(path: string): MemoryNode | null {
    const parts = this.parsePath(path);

    let current = this.root;
    for (const part of parts) {
      if (current.type !== 'directory' || !current.children) {
        return null;
      }
      const next = current.children.get(part);
      if (!next) {
        return null;
      }
      current = next;
    }

    return current;
  }

  private getParentNode(path: string): { parent: MemoryNode; name: string } | null {
    const parts = this.parsePath(path);
    if (parts.length === 0) {
      return null; // Root has no parent
    }

    const name = parts.pop()!;
    let current = this.root;

    for (const part of parts) {
      if (current.type !== 'directory' || !current.children) {
        return null;
      }
      const next = current.children.get(part);
      if (!next) {
        return null;
      }
      current = next;
    }

    if (current.type !== 'directory') {
      return null;
    }

    return { parent: current, name };
  }

  private pathToString(parts: string[]): string {
    return '/' + parts.join('/');
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = {
      txt: 'text/plain',
      md: 'text/markdown',
      json: 'application/json',
      js: 'application/javascript',
      ts: 'application/typescript',
      py: 'text/x-python',
      html: 'text/html',
      css: 'text/css',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // Sync write for initialization
  private writeFileSync(path: string, content: FileContent): void {
    const parts = this.parsePath(path);
    if (parts.length === 0) return;

    const filename = parts.pop()!;
    let current = this.root;

    // Create parent directories
    for (const part of parts) {
      if (!current.children) {
        current.children = new Map();
      }
      let next = current.children.get(part);
      if (!next) {
        next = {
          type: 'directory',
          createdAt: new Date(),
          modifiedAt: new Date(),
          children: new Map(),
        };
        current.children.set(part, next);
      }
      current = next;
    }

    // Create file
    if (!current.children) {
      current.children = new Map();
    }

    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);

    current.children.set(filename, {
      type: 'file',
      content: buffer,
      mimeType: this.getMimeType(filename),
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const node = this.getNode(path);

    if (!node) {
      throw new FileNotFoundError(path);
    }

    if (node.type === 'directory') {
      throw new IsDirectoryError(path);
    }

    const content = node.content ?? Buffer.alloc(0);

    if (options?.encoding) {
      return content.toString(options.encoding);
    }

    return content;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const parts = this.parsePath(path);
    if (parts.length === 0) {
      throw new Error('Cannot write to root');
    }

    const filename = parts.pop()!;
    let current = this.root;

    // Create parent directories if recursive (default: true)
    if (options?.recursive !== false) {
      for (const part of parts) {
        if (!current.children) {
          current.children = new Map();
        }
        let next = current.children.get(part);
        if (!next) {
          next = {
            type: 'directory',
            createdAt: new Date(),
            modifiedAt: new Date(),
            children: new Map(),
          };
          current.children.set(part, next);
        } else if (next.type !== 'directory') {
          throw new NotDirectoryError(this.pathToString(parts.slice(0, parts.indexOf(part) + 1)));
        }
        current = next;
      }
    } else {
      // Navigate to parent, fail if not exists
      for (const part of parts) {
        if (!current.children?.has(part)) {
          throw new DirectoryNotFoundError(this.pathToString(parts));
        }
        current = current.children.get(part)!;
      }
    }

    if (!current.children) {
      current.children = new Map();
    }

    // Check if file exists and overwrite is false
    if (options?.overwrite === false && current.children.has(filename)) {
      throw new FileExistsError(path);
    }

    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
    const existing = current.children.get(filename);

    current.children.set(filename, {
      type: 'file',
      content: buffer,
      mimeType: options?.mimeType ?? this.getMimeType(filename),
      createdAt: existing?.createdAt ?? new Date(),
      modifiedAt: new Date(),
    });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const node = this.getNode(path);
    const newContent = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);

    if (!node) {
      // Create new file
      await this.writeFile(path, content);
      return;
    }

    if (node.type === 'directory') {
      throw new IsDirectoryError(path);
    }

    // Append to existing content
    const existingContent = node.content ?? Buffer.alloc(0);
    node.content = Buffer.concat([existingContent, newContent]);
    node.modifiedAt = new Date();
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const result = this.getParentNode(path);

    if (!result) {
      if (!options?.force) {
        throw new FileNotFoundError(path);
      }
      return;
    }

    const { parent, name } = result;
    const node = parent.children?.get(name);

    if (!node) {
      if (!options?.force) {
        throw new FileNotFoundError(path);
      }
      return;
    }

    if (node.type === 'directory') {
      throw new IsDirectoryError(path);
    }

    parent.children!.delete(name);
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcNode = this.getNode(src);

    if (!srcNode) {
      throw new FileNotFoundError(src);
    }

    if (srcNode.type === 'directory') {
      if (!options?.recursive) {
        throw new IsDirectoryError(src);
      }
      await this.copyDirectory(src, dest, options);
      return;
    }

    // Check destination
    if (options?.overwrite === false && this.getNode(dest)) {
      throw new FileExistsError(dest);
    }

    // Copy file
    await this.writeFile(dest, srcNode.content ?? Buffer.alloc(0), {
      mimeType: srcNode.mimeType,
      overwrite: options?.overwrite,
    });
  }

  private async copyDirectory(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.mkdir(dest, { recursive: true });

    const srcNode = this.getNode(src);
    if (!srcNode?.children) return;

    for (const [name, child] of srcNode.children) {
      const srcPath = src === '/' ? `/${name}` : `${src}/${name}`;
      const destPath = dest === '/' ? `/${name}` : `${dest}/${name}`;

      if (child.type === 'directory') {
        await this.copyDirectory(srcPath, destPath, options);
      } else {
        await this.copyFile(srcPath, destPath, options);
      }
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.copyFile(src, dest, { ...options, recursive: true });

    const srcNode = this.getNode(src);
    if (srcNode?.type === 'directory') {
      await this.rmdir(src, { recursive: true });
    } else {
      await this.deleteFile(src);
    }
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const parts = this.parsePath(path);
    if (parts.length === 0) return; // Root always exists

    let current = this.root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (!current.children) {
        current.children = new Map();
      }

      let next = current.children.get(part);

      if (!next) {
        if (!options?.recursive && i < parts.length - 1) {
          throw new DirectoryNotFoundError(this.pathToString(parts.slice(0, i)));
        }

        next = {
          type: 'directory',
          createdAt: new Date(),
          modifiedAt: new Date(),
          children: new Map(),
        };
        current.children.set(part, next);
      } else if (next.type !== 'directory') {
        throw new FileExistsError(this.pathToString(parts.slice(0, i + 1)));
      }

      current = next;
    }
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const result = this.getParentNode(path);

    if (!result) {
      if (path === '/' || path === '') {
        // Clear root
        if (options?.recursive) {
          this.root.children = new Map();
          return;
        }
        if (this.root.children && this.root.children.size > 0) {
          throw new DirectoryNotEmptyError('/');
        }
        return;
      }

      if (!options?.force) {
        throw new DirectoryNotFoundError(path);
      }
      return;
    }

    const { parent, name } = result;
    const node = parent.children?.get(name);

    if (!node) {
      if (!options?.force) {
        throw new DirectoryNotFoundError(path);
      }
      return;
    }

    if (node.type !== 'directory') {
      throw new NotDirectoryError(path);
    }

    if (!options?.recursive && node.children && node.children.size > 0) {
      throw new DirectoryNotEmptyError(path);
    }

    parent.children!.delete(name);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const node = this.getNode(path);

    if (!node) {
      throw new DirectoryNotFoundError(path);
    }

    if (node.type !== 'directory') {
      throw new NotDirectoryError(path);
    }

    const entries: FileEntry[] = [];

    if (!node.children) {
      return entries;
    }

    for (const [name, child] of node.children) {
      // Filter by extension if specified
      if (options?.extension && child.type === 'file') {
        const extensions = Array.isArray(options.extension)
          ? options.extension
          : [options.extension];
        const ext = '.' + name.split('.').pop();
        if (!extensions.some((e) => e === ext || '.' + e === ext)) {
          continue;
        }
      }

      entries.push({
        name,
        type: child.type,
        size: child.content?.length,
      });

      // Recurse if requested
      if (options?.recursive && child.type === 'directory') {
        const depth = options.maxDepth ?? Infinity;
        if (depth > 0) {
          const subPath = path === '/' ? `/${name}` : `${path}/${name}`;
          const subEntries = await this.readdir(subPath, {
            ...options,
            maxDepth: depth - 1,
          });
          entries.push(
            ...subEntries.map((e) => ({
              ...e,
              name: `${name}/${e.name}`,
            })),
          );
        }
      }
    }

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    return this.getNode(path) !== null;
  }

  async stat(path: string): Promise<FileStat> {
    const node = this.getNode(path);

    if (!node) {
      throw new FileNotFoundError(path);
    }

    const parts = this.parsePath(path);
    const name = parts.length > 0 ? parts[parts.length - 1] : '';

    return {
      name,
      path: '/' + parts.join('/'),
      type: node.type,
      size: node.content?.length ?? 0,
      createdAt: node.createdAt,
      modifiedAt: node.modifiedAt,
      mimeType: node.mimeType,
    };
  }

  async isFile(path: string): Promise<boolean> {
    const node = this.getNode(path);
    return node?.type === 'file';
  }

  async isDirectory(path: string): Promise<boolean> {
    const node = this.getNode(path);
    return node?.type === 'directory';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // Nothing to initialize for memory filesystem
  }

  async destroy(): Promise<void> {
    // Clear all data
    this.root = {
      type: 'directory',
      createdAt: new Date(),
      modifiedAt: new Date(),
      children: new Map(),
    };
  }
}

/**
 * Create an in-memory filesystem.
 */
export function createMemoryFilesystem(config: MemoryFSProviderConfig): MemoryFilesystem {
  return new MemoryFilesystem(config);
}

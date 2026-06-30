/**
 * SandboxFilesystem
 *
 * A `WorkspaceFilesystem` that stores files inside a remote `MastraSandbox`
 * (e.g. a Railway VM) rather than on the server host. File operations are
 * implemented by shelling out through the sandbox's `executeCommand`, so the
 * agent's file tools and command tools share one VM and one view of the repo.
 *
 * Paths are workspace-relative (`/src/foo.ts`) and resolve under the sandbox
 * working directory (`basePath`). A traversal guard rejects any path that
 * escapes the workdir, mirroring `LocalFilesystem`'s contained mode.
 *
 * Reads/writes use base64 over the wire so binary content survives the shell.
 */

import { posix as posixPath } from 'node:path';
import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FileStat,
  FilesystemInfo,
  ListOptions,
  ProviderStatus,
  ReadOptions,
  RemoveOptions,
  WorkspaceFilesystem,
  WriteOptions,
} from '@mastra/core/workspace';

/** Minimal command result shape we depend on. */
export interface SandboxCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Minimal sandbox surface the filesystem needs. */
export interface SandboxExec {
  readonly id: string;
  executeCommand(command: string, args?: string[], options?: { timeout?: number }): Promise<SandboxCommandResult>;
}

export interface SandboxFilesystemOptions {
  /** Live sandbox to run commands in. */
  sandbox: SandboxExec;
  /** Absolute path inside the sandbox that is the workspace root. */
  workdir: string;
  /** Optional stable id; defaults to a sandbox-derived id. */
  id?: string;
}

/** Default per-command deadline so a hung sandbox can't block file tools forever. */
const COMMAND_TIMEOUT_MS = 30_000;

/** Single-quote a string for safe POSIX shell interpolation. */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function isFileContentString(content: FileContent): content is string {
  return typeof content === 'string';
}

function toBuffer(content: FileContent): Buffer {
  if (isFileContentString(content)) return Buffer.from(content, 'utf8');
  return Buffer.from(content);
}

export class SandboxFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'SandboxFilesystem';
  readonly provider = 'sandbox';
  readonly basePath: string;
  status: ProviderStatus = 'ready';

  private readonly sandbox: SandboxExec;

  constructor(options: SandboxFilesystemOptions) {
    this.sandbox = options.sandbox;
    this.basePath = options.workdir;
    this.id = options.id ?? `sandbox-fs:${options.sandbox.id}`;
  }

  // ── Path handling ──────────────────────────────────────────────────────

  /**
   * Resolve a workspace path to an absolute path inside the sandbox, enforcing
   * that it stays within the workdir.
   */
  private resolve(inputPath: string): string {
    const rel = inputPath.startsWith('/') ? inputPath.slice(1) : inputPath;
    const resolved = posixPath.normalize(posixPath.join(this.basePath, rel));
    const root = posixPath.normalize(this.basePath);
    if (resolved !== root && !resolved.startsWith(`${root}/`)) {
      throw new Error(`Path escapes workspace root: ${inputPath}`);
    }
    return resolved;
  }

  resolveAbsolutePath(inputPath: string): string | undefined {
    return this.resolve(inputPath);
  }

  // ── Command helper ─────────────────────────────────────────────────────

  private async exec(script: string): Promise<SandboxCommandResult> {
    return this.sandbox.executeCommand('sh', ['-c', script], { timeout: COMMAND_TIMEOUT_MS });
  }

  /**
   * Lexical guard catches `..` traversal, but a symlink inside the workdir can
   * still point outside it. After resolving a path that refers to an existing
   * entry, verify its realpath is still contained in the workdir.
   */
  private async assertContainedRealpath(abs: string, inputPath: string): Promise<void> {
    const result = await this.exec(`readlink -f -- ${shellQuote(abs)} 2>/dev/null`);
    const real = result.stdout.trim();
    // If readlink couldn't resolve (path doesn't exist yet), nothing to check.
    if (result.exitCode !== 0 || !real) return;
    const root = posixPath.normalize(this.basePath);
    if (real !== root && !real.startsWith(`${root}/`)) {
      throw new Error(`Path escapes workspace root (symlink): ${inputPath}`);
    }
  }

  /**
   * Guard for write destinations. The lexical guard catches `..`, but a symlink
   * inside the workdir can redirect a write outside it. For an existing target
   * we check its realpath; for a not-yet-existing target we check the realpath
   * of its nearest existing ancestor directory, since a symlinked parent is the
   * escape vector (e.g. `link -> /etc` then writing `link/passwd`).
   */
  private async assertContainedDest(abs: string, inputPath: string): Promise<void> {
    // First check the target itself (covers overwriting an existing symlink).
    await this.assertContainedRealpath(abs, inputPath);
    // Then check the parent directory's realpath; readlink -f resolves the
    // nearest existing ancestor when the leaf doesn't exist yet.
    const parent = posixPath.dirname(abs);
    if (parent && parent !== abs) {
      await this.assertContainedRealpath(parent, inputPath);
    }
  }

  private async execOk(script: string, context: string): Promise<SandboxCommandResult> {
    const result = await this.exec(script);
    if (result.exitCode !== 0) {
      throw new Error(`${context} failed (exit ${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`);
    }
    return result;
  }

  // ── File operations ────────────────────────────────────────────────────

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const abs = this.resolve(path);
    await this.assertContainedRealpath(abs, path);
    const result = await this.exec(`base64 < ${shellQuote(abs)}`);
    if (result.exitCode !== 0) {
      throw new Error(`File not found: ${path}`);
    }
    const buffer = Buffer.from(result.stdout.replace(/\s/g, ''), 'base64');
    if (options?.encoding) {
      return buffer.toString(options.encoding);
    }
    return buffer;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const abs = this.resolve(path);
    await this.assertContainedDest(abs, path);
    const b64 = toBuffer(content).toString('base64');
    const dir = posixPath.dirname(abs);
    const mkdir = options?.recursive === false ? '' : `mkdir -p ${shellQuote(dir)} && `;
    if (options?.overwrite === false) {
      const exists = await this.exists(path);
      if (exists) throw new Error(`File already exists: ${path}`);
    }
    await this.execOk(`${mkdir}printf %s ${shellQuote(b64)} | base64 -d > ${shellQuote(abs)}`, `writeFile ${path}`);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const abs = this.resolve(path);
    await this.assertContainedDest(abs, path);
    const b64 = toBuffer(content).toString('base64');
    await this.execOk(
      `mkdir -p ${shellQuote(posixPath.dirname(abs))} && printf %s ${shellQuote(b64)} | base64 -d >> ${shellQuote(abs)}`,
      `appendFile ${path}`,
    );
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const abs = this.resolve(path);
    const force = options?.force ? '-f ' : '';
    const result = await this.exec(`rm ${force}${shellQuote(abs)}`);
    if (result.exitCode !== 0 && !options?.force) {
      throw new Error(`File not found: ${path}`);
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcAbs = this.resolve(src);
    const destAbs = this.resolve(dest);
    await this.assertContainedRealpath(srcAbs, src);
    await this.assertContainedDest(destAbs, dest);
    const recursive = options?.recursive ? '-r ' : '';
    if (options?.overwrite === false) {
      const exists = await this.exists(dest);
      if (exists) throw new Error(`Destination exists: ${dest}`);
    }
    await this.execOk(`cp ${recursive}${shellQuote(srcAbs)} ${shellQuote(destAbs)}`, `copyFile ${src} -> ${dest}`);
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcAbs = this.resolve(src);
    const destAbs = this.resolve(dest);
    await this.assertContainedRealpath(srcAbs, src);
    await this.assertContainedDest(destAbs, dest);
    if (options?.overwrite === false) {
      const exists = await this.exists(dest);
      if (exists) throw new Error(`Destination exists: ${dest}`);
    }
    await this.execOk(`mv ${shellQuote(srcAbs)} ${shellQuote(destAbs)}`, `moveFile ${src} -> ${dest}`);
  }

  // ── Directory operations ───────────────────────────────────────────────

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const abs = this.resolve(path);
    await this.assertContainedDest(abs, path);
    const flag = options?.recursive === false ? '' : '-p ';
    await this.execOk(`mkdir ${flag}${shellQuote(abs)}`, `mkdir ${path}`);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const abs = this.resolve(path);
    if (options?.recursive) {
      const force = options?.force ? '-f ' : '';
      await this.execOk(`rm -r ${force}${shellQuote(abs)}`, `rmdir ${path}`);
      return;
    }
    const result = await this.exec(`rmdir ${shellQuote(abs)}`);
    if (result.exitCode !== 0 && !options?.force) {
      throw new Error(`Directory not empty or not found: ${path}`);
    }
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const abs = this.resolve(path);
    await this.assertContainedRealpath(abs, path);
    if (options?.recursive) {
      // Use find for recursive listings; emit "type\tpath".
      const result = await this.exec(
        `find ${shellQuote(abs)} -mindepth 1 ${options.maxDepth ? `-maxdepth ${Number(options.maxDepth)} ` : ''}-printf '%y\\t%p\\n' 2>/dev/null`,
      );
      if (result.exitCode !== 0) throw new Error(`Directory not found: ${path}`);
      return this.parseFindOutput(result.stdout, abs, options);
    }
    // Non-recursive: list with name + type via a portable loop.
    const result = await this.exec(
      `cd ${shellQuote(abs)} 2>/dev/null && for f in * .[!.]*; do [ -e "$f" ] || continue; if [ -d "$f" ]; then echo "d\t$f"; else echo "f\t$f"; fi; done`,
    );
    if (result.exitCode !== 0) throw new Error(`Directory not found: ${path}`);
    return this.parseListOutput(result.stdout, options);
  }

  private parseListOutput(stdout: string, options?: ListOptions): FileEntry[] {
    const entries: FileEntry[] = [];
    for (const line of stdout.split('\n')) {
      if (!line) continue;
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const type = line.slice(0, tab) === 'd' ? 'directory' : 'file';
      const name = line.slice(tab + 1);
      if (!name || name === '.' || name === '..') continue;
      if (type === 'file' && !this.matchesExtension(name, options?.extension)) continue;
      entries.push({ name, type });
    }
    return entries;
  }

  private parseFindOutput(stdout: string, base: string, options?: ListOptions): FileEntry[] {
    const entries: FileEntry[] = [];
    for (const line of stdout.split('\n')) {
      if (!line) continue;
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const type = line.slice(0, tab) === 'd' ? 'directory' : 'file';
      const fullPath = line.slice(tab + 1);
      const name = posixPath.relative(base, fullPath);
      if (!name) continue;
      if (type === 'file' && !this.matchesExtension(name, options?.extension)) continue;
      entries.push({ name, type });
    }
    return entries;
  }

  private matchesExtension(name: string, extension?: string | string[]): boolean {
    if (!extension) return true;
    const exts = Array.isArray(extension) ? extension : [extension];
    return exts.some(ext => name.endsWith(ext));
  }

  // ── Path / metadata ────────────────────────────────────────────────────

  async exists(path: string): Promise<boolean> {
    const abs = this.resolve(path);
    const result = await this.exec(`test -e ${shellQuote(abs)}`);
    return result.exitCode === 0;
  }

  async stat(path: string): Promise<FileStat> {
    const abs = this.resolve(path);
    await this.assertContainedRealpath(abs, path);
    // %F=type, %s=size, %X=atime, %Y=mtime (epoch seconds), %W=birth (or -1).
    const result = await this.exec(`stat -c '%F\\t%s\\t%Y\\t%W' ${shellQuote(abs)}`);
    if (result.exitCode !== 0) {
      throw new Error(`Path not found: ${path}`);
    }
    const [kind, sizeStr, mtimeStr, ctimeStr] = result.stdout.trim().split('\t');
    const type = kind && kind.includes('directory') ? 'directory' : 'file';
    const size = Number(sizeStr) || 0;
    const mtime = Number(mtimeStr) || 0;
    const ctime = Number(ctimeStr);
    return {
      name: posixPath.basename(abs),
      path: `/${posixPath.relative(this.basePath, abs)}`,
      type,
      size: type === 'directory' ? 0 : size,
      modifiedAt: new Date(mtime * 1000),
      createdAt: new Date((ctime > 0 ? ctime : mtime) * 1000),
    };
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async init(): Promise<void> {
    await this.execOk(`mkdir -p ${shellQuote(this.basePath)}`, 'init workdir');
  }

  async destroy(): Promise<void> {
    // The sandbox lifecycle is owned by the caller; nothing to tear down here.
  }

  async isReady(): Promise<boolean> {
    const result = await this.exec(`test -d ${shellQuote(this.basePath)}`);
    return result.exitCode === 0;
  }

  getInfo(): FilesystemInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      metadata: { basePath: this.basePath, sandboxId: this.sandbox.id },
    };
  }

  getInstructions(): string {
    return `Files are stored in a remote sandbox at ${this.basePath}. Use absolute workspace paths like /src/index.ts. All reads, writes and commands run inside the same sandbox.`;
  }
}

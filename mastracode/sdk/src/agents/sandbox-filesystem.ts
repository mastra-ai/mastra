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
import { FileExistsError, FileNotFoundError, IsDirectoryError } from '@mastra/core/workspace';

/**
 * Sentinel exit codes used by guard clauses that run before the real command,
 * so shell failures can be mapped to typed filesystem errors.
 */
const EXIT_NOT_FOUND = 20;
const EXIT_IS_DIRECTORY = 21;
const EXIT_EXISTS = 22;

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
  /**
   * Absolute path inside the sandbox that is the workspace root — or a lazy
   * resolver for it. The resolver form exists for sandboxes whose workspace
   * root is only knowable once the VM is running (e.g. `$HOME/<repo>` under
   * a provider-chosen home dir): it is awaited on the first file operation
   * (which itself may lazily start the VM) and the result is memoized.
   */
  workdir: string | (() => Promise<string> | string);
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
  status: ProviderStatus = 'ready';

  private readonly sandbox: SandboxExec;
  private readonly workdirSource: string | (() => Promise<string> | string);
  private resolvedBase?: string;
  private resolvingBase?: Promise<string>;

  constructor(options: SandboxFilesystemOptions) {
    this.sandbox = options.sandbox;
    this.workdirSource = options.workdir;
    if (typeof options.workdir === 'string') this.resolvedBase = options.workdir;
    // Include the workdir when known: one sandbox can back several
    // filesystems rooted at different checkouts, and each needs a distinct
    // id. Lazy-workdir callers pass an explicit id.
    this.id =
      options.id ??
      (typeof options.workdir === 'string'
        ? `sandbox-fs:${options.sandbox.id}:${options.workdir}`
        : `sandbox-fs:${options.sandbox.id}`);
  }

  /** The resolved workspace root; empty until a lazy workdir first resolves. */
  get basePath(): string {
    return this.resolvedBase ?? '';
  }

  /** Await (and memoize) the workspace root, resolving a lazy workdir once. */
  private async base(): Promise<string> {
    if (this.resolvedBase) return this.resolvedBase;
    const source = this.workdirSource;
    if (typeof source === 'string') return (this.resolvedBase = source);
    this.resolvingBase ??= Promise.resolve()
      .then(source)
      .then(resolved => {
        if (!resolved) throw new Error('Sandbox workspace root resolution returned an empty path');
        return (this.resolvedBase = resolved);
      })
      .finally(() => {
        this.resolvingBase = undefined;
      });
    return this.resolvingBase;
  }

  // ── Path handling ──────────────────────────────────────────────────────

  /**
   * Resolve a workspace path to an absolute path inside the sandbox, enforcing
   * that it stays within the workdir. Awaits the workspace root first, which
   * for a lazy workdir may start the VM.
   */
  private async resolveAsync(inputPath: string): Promise<string> {
    return this.resolveAgainst(await this.base(), inputPath);
  }

  /**
   * Resolve a workspace path against a known base, enforcing that it stays
   * within the workdir.
   *
   * Accepts both workspace-relative paths (`src/foo.ts`, `/src/foo.ts`) and
   * absolute sandbox paths that already live under the workdir — the agent's
   * prompt advertises the workdir as its working directory, so tools are
   * routinely called with fully-qualified paths like `<workdir>/src/foo.ts`.
   */
  private resolveAgainst(basePath: string, inputPath: string): string {
    const base = posixPath.normalize(basePath);
    const normalizedInput = posixPath.normalize(inputPath);
    const rel =
      normalizedInput === base
        ? ''
        : normalizedInput.startsWith(`${base}/`)
          ? normalizedInput.slice(base.length + 1)
          : inputPath.startsWith('/')
            ? inputPath.slice(1)
            : inputPath;
    const resolved = posixPath.normalize(posixPath.join(base, rel));
    if (resolved !== base && !resolved.startsWith(`${base}/`)) {
      throw new Error(`Path escapes workspace root: ${inputPath}`);
    }
    return resolved;
  }

  resolveAbsolutePath(inputPath: string): string | undefined {
    // Sync interface: a lazy workdir that has not resolved yet has no
    // absolute form to offer.
    if (!this.resolvedBase) return undefined;
    return this.resolveAgainst(this.resolvedBase, inputPath);
  }

  // ── Command helper ─────────────────────────────────────────────────────

  private async exec(script: string): Promise<SandboxCommandResult> {
    return this.sandbox.executeCommand('sh', ['-c', script], { timeout: COMMAND_TIMEOUT_MS });
  }

  /**
   * Lexical guard catches `..` traversal, but a symlink inside the workdir can
   * still point outside it. After resolving a path that refers to an existing
   * entry, verify its realpath is still contained in the workdir.
   *
   * Canonicalization tries `realpath`, then `readlink -f` (GNU/busybox), then
   * `cd && pwd -P` for directories — covering GNU hosts, macOS/BSD, and
   * busybox. If the path exists but cannot be canonicalized we fail CLOSED:
   * returning without a check would let a symlink bypass containment.
   */
  private async assertContainedRealpath(abs: string, inputPath: string): Promise<void> {
    const result = await this.exec(
      [
        `p=${shellQuote(abs)}`,
        `if [ ! -e "$p" ] && [ ! -L "$p" ]; then exit ${EXIT_NOT_FOUND}; fi`,
        // The workdir itself may contain symlinked components (/tmp on macOS),
        // so canonicalize it as the comparison root.
        `root=$(cd ${shellQuote(this.basePath)} 2>/dev/null && pwd -P)`,
        `[ -n "$root" ] || exit 1`,
        `rp=$(realpath "$p" 2>/dev/null) || rp=$(readlink -f "$p" 2>/dev/null) || { [ -d "$p" ] && rp=$(cd "$p" 2>/dev/null && pwd -P); }`,
        `[ -n "$rp" ] || exit 1`,
        `printf '%s\\n%s' "$root" "$rp"`,
      ].join('\n'),
    );
    // Path doesn't exist yet: nothing to canonicalize (writes to a fresh leaf
    // are covered by assertContainedDest checking the parent directory).
    if (result.exitCode === EXIT_NOT_FOUND) return;
    const [root, real] = result.stdout.split('\n').map(s => s.trim());
    if (result.exitCode !== 0 || !root || !real) {
      throw new Error(`Unable to verify path stays within workspace root: ${inputPath}`);
    }
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
    const abs = await this.resolveAsync(path);
    await this.assertContainedRealpath(abs, path);
    // Guard clauses first: redirecting from a directory "succeeds" with empty
    // output on some shells, so classify before reading.
    const result = await this.exec(
      `if [ -d ${shellQuote(abs)} ]; then exit ${EXIT_IS_DIRECTORY}; elif [ ! -e ${shellQuote(abs)} ]; then exit ${EXIT_NOT_FOUND}; fi; base64 < ${shellQuote(abs)}`,
    );
    if (result.exitCode === EXIT_IS_DIRECTORY) throw new IsDirectoryError(path);
    if (result.exitCode === EXIT_NOT_FOUND) throw new FileNotFoundError(path);
    if (result.exitCode !== 0) {
      throw new Error(`readFile ${path} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
    }
    const buffer = Buffer.from(result.stdout.replace(/\s/g, ''), 'base64');
    if (options?.encoding) {
      return buffer.toString(options.encoding);
    }
    return buffer;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const abs = await this.resolveAsync(path);
    await this.assertContainedDest(abs, path);
    const b64 = toBuffer(content).toString('base64');
    const dir = posixPath.dirname(abs);
    const mkdir = options?.recursive === false ? '' : `mkdir -p ${shellQuote(dir)} && `;
    if (options?.overwrite === false) {
      // `set -C` (noclobber) makes the redirect itself the exclusivity check —
      // no exists() pre-check that could race with a concurrent writer.
      const result = await this.exec(
        `${mkdir}{ (set -C; printf %s ${shellQuote(b64)} | base64 -d > ${shellQuote(abs)}) 2>/dev/null || { [ -e ${shellQuote(abs)} ] && exit ${EXIT_EXISTS} || exit 1; }; }`,
      );
      if (result.exitCode === EXIT_EXISTS) throw new FileExistsError(path);
      if (result.exitCode !== 0) {
        throw new Error(`writeFile ${path} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
      }
      return;
    }
    await this.execOk(`${mkdir}printf %s ${shellQuote(b64)} | base64 -d > ${shellQuote(abs)}`, `writeFile ${path}`);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const abs = await this.resolveAsync(path);
    await this.assertContainedDest(abs, path);
    const b64 = toBuffer(content).toString('base64');
    await this.execOk(
      `mkdir -p ${shellQuote(posixPath.dirname(abs))} && printf %s ${shellQuote(b64)} | base64 -d >> ${shellQuote(abs)}`,
      `appendFile ${path}`,
    );
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const abs = await this.resolveAsync(path);
    // Contain the parent's realpath: deleting `link/file` where `link` points
    // outside the workdir must fail, while deleting a symlink entry itself
    // (which lives inside the workdir) stays allowed.
    await this.assertContainedRealpath(posixPath.dirname(abs), path);
    if (options?.force) {
      // `rm -f` already succeeds for a missing file, but still fails for
      // directories and permission errors — surface those.
      await this.execOk(`rm -f ${shellQuote(abs)}`, `deleteFile ${path}`);
      return;
    }
    const result = await this.exec(
      `if [ ! -e ${shellQuote(abs)} ]; then exit ${EXIT_NOT_FOUND}; fi; rm ${shellQuote(abs)}`,
    );
    if (result.exitCode === EXIT_NOT_FOUND) throw new FileNotFoundError(path);
    if (result.exitCode !== 0) {
      throw new Error(`deleteFile ${path} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcAbs = await this.resolveAsync(src);
    const destAbs = await this.resolveAsync(dest);
    await this.assertContainedRealpath(srcAbs, src);
    await this.assertContainedDest(destAbs, dest);
    const recursive = options?.recursive ? '-r ' : '';
    if (options?.overwrite === false) {
      // Atomic no-clobber: directories claim the destination with an exclusive
      // mkdir; files copy to a temp name then hardlink into place (link(2)
      // fails if the destination exists). No racy exists() pre-check.
      const result = await this.exec(
        [
          `src=${shellQuote(srcAbs)}`,
          `dest=${shellQuote(destAbs)}`,
          `if [ ! -e "$src" ] && [ ! -L "$src" ]; then exit ${EXIT_NOT_FOUND}; fi`,
          `mkdir -p ${shellQuote(posixPath.dirname(destAbs))} || exit 1`,
          `if [ -d "$src" ]; then`,
          `  mkdir "$dest" 2>/dev/null || exit ${EXIT_EXISTS}`,
          `  cp -R "$src"/. "$dest"/`,
          `else`,
          `  tmp="$dest.__cptmp$$"`,
          `  cp "$src" "$tmp" || exit 1`,
          `  ln "$tmp" "$dest" 2>/dev/null || { rm -f "$tmp"; [ -e "$dest" ] && exit ${EXIT_EXISTS} || exit 1; }`,
          `  rm -f "$tmp"`,
          `fi`,
        ].join('\n'),
      );
      if (result.exitCode === EXIT_NOT_FOUND) throw new FileNotFoundError(src);
      if (result.exitCode === EXIT_EXISTS) throw new FileExistsError(dest);
      if (result.exitCode !== 0) {
        throw new Error(`copyFile ${src} -> ${dest} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
      }
      return;
    }
    const result = await this.exec(
      `if [ ! -e ${shellQuote(srcAbs)} ]; then exit ${EXIT_NOT_FOUND}; fi; mkdir -p ${shellQuote(posixPath.dirname(destAbs))} && cp ${recursive}${shellQuote(srcAbs)} ${shellQuote(destAbs)}`,
    );
    if (result.exitCode === EXIT_NOT_FOUND) throw new FileNotFoundError(src);
    if (result.exitCode !== 0) {
      throw new Error(`copyFile ${src} -> ${dest} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcAbs = await this.resolveAsync(src);
    const destAbs = await this.resolveAsync(dest);
    await this.assertContainedRealpath(srcAbs, src);
    await this.assertContainedDest(destAbs, dest);
    if (options?.overwrite === false) {
      // `mv -n` exits 0 even when it skips, so detect a skipped move by the
      // source surviving. The no-clobber rename itself is atomic; no racy
      // exists() pre-check.
      const result = await this.exec(
        [
          `src=${shellQuote(srcAbs)}`,
          `dest=${shellQuote(destAbs)}`,
          `if [ ! -e "$src" ] && [ ! -L "$src" ]; then exit ${EXIT_NOT_FOUND}; fi`,
          `mkdir -p ${shellQuote(posixPath.dirname(destAbs))} || exit 1`,
          `mv -n "$src" "$dest" 2>/dev/null || exit 1`,
          `if [ -e "$src" ] || [ -L "$src" ]; then exit ${EXIT_EXISTS}; fi`,
        ].join('\n'),
      );
      if (result.exitCode === EXIT_NOT_FOUND) throw new FileNotFoundError(src);
      if (result.exitCode === EXIT_EXISTS) throw new FileExistsError(dest);
      if (result.exitCode !== 0) {
        throw new Error(`moveFile ${src} -> ${dest} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
      }
      return;
    }
    const result = await this.exec(
      `if [ ! -e ${shellQuote(srcAbs)} ]; then exit ${EXIT_NOT_FOUND}; fi; mkdir -p ${shellQuote(posixPath.dirname(destAbs))} && mv ${shellQuote(srcAbs)} ${shellQuote(destAbs)}`,
    );
    if (result.exitCode === EXIT_NOT_FOUND) throw new FileNotFoundError(src);
    if (result.exitCode !== 0) {
      throw new Error(`moveFile ${src} -> ${dest} failed (exit ${result.exitCode}): ${result.stderr.trim()}`);
    }
  }

  // ── Directory operations ───────────────────────────────────────────────

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const abs = await this.resolveAsync(path);
    await this.assertContainedDest(abs, path);
    const flag = options?.recursive === false ? '' : '-p ';
    await this.execOk(`mkdir ${flag}${shellQuote(abs)}`, `mkdir ${path}`);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const abs = await this.resolveAsync(path);
    // Same parent containment as deleteFile — `rm -r` through a symlinked
    // parent would otherwise delete outside the workspace.
    await this.assertContainedRealpath(posixPath.dirname(abs), path);
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
    const abs = await this.resolveAsync(path);
    await this.assertContainedRealpath(abs, path);
    if (options?.recursive) {
      // Recursive listing emitting "type\tpath". `find -printf` is GNU-only
      // (fails on macOS/BSD hosts backing a local sandbox), so classify each
      // entry with a portable shell loop instead.
      const result = await this.exec(
        `test -d ${shellQuote(abs)} && find ${shellQuote(abs)} -mindepth 1 ${options.maxDepth ? `-maxdepth ${Number(options.maxDepth)} ` : ''}2>/dev/null | while IFS= read -r f; do if [ -d "$f" ]; then printf 'd\\t%s\\n' "$f"; else printf 'f\\t%s\\n' "$f"; fi; done`,
      );
      if (result.exitCode !== 0) throw new Error(`Directory not found: ${path}`);
      return this.parseFindOutput(result.stdout, abs, options);
    }
    // Non-recursive: list with name + type via a portable loop. Use printf,
    // not echo — bash-as-/bin/sh (macOS local sandboxes) does not expand \t
    // in echo arguments.
    const result = await this.exec(
      `cd ${shellQuote(abs)} 2>/dev/null && for f in * .[!.]*; do [ -e "$f" ] || continue; if [ -d "$f" ]; then printf 'd\\t%s\\n' "$f"; else printf 'f\\t%s\\n' "$f"; fi; done`,
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
    const abs = await this.resolveAsync(path);
    const result = await this.exec(`test -e ${shellQuote(abs)}`);
    return result.exitCode === 0;
  }

  async stat(path: string): Promise<FileStat> {
    const abs = await this.resolveAsync(path);
    await this.assertContainedRealpath(abs, path);
    // GNU stat: %F=type, %s=size, %Y=mtime (epoch seconds), %W=birth (or -1).
    // BSD/macOS stat (local sandbox hosts) rejects `-c`; fall back to its
    // `-f` format with the same field order (%HT=type, %z=size, %m=mtime,
    // %B=birth). Delimit with `|` — neither stat interprets `\t` escapes in
    // its format string.
    const result = await this.exec(
      `stat -c '%F|%s|%Y|%W' ${shellQuote(abs)} 2>/dev/null || stat -f '%HT|%z|%m|%B' ${shellQuote(abs)}`,
    );
    if (result.exitCode !== 0) {
      throw new FileNotFoundError(path);
    }
    const [kind, sizeStr, mtimeStr, ctimeStr] = result.stdout.trim().split('|');
    const type = kind && kind.toLowerCase().includes('directory') ? 'directory' : 'file';
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
    await this.execOk(`mkdir -p ${shellQuote(await this.base())}`, 'init workdir');
  }

  async destroy(): Promise<void> {
    // The sandbox lifecycle is owned by the caller; nothing to tear down here.
  }

  async isReady(): Promise<boolean> {
    const result = await this.exec(`test -d ${shellQuote(await this.base())}`);
    return result.exitCode === 0;
  }

  getInfo(): FilesystemInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      metadata: { basePath: this.basePath, sandboxId: this.sandbox.id },
    };
  }

  getInstructions(): string {
    return `Files are stored in a remote sandbox at ${this.basePath}. Use absolute workspace paths like /src/index.ts. All reads, writes and commands run inside the same sandbox.`;
  }
}

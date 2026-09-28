/**
 * Modal filesystem provider.
 *
 * A WorkspaceFilesystem backed by a running ModalSandbox. Every operation runs
 * a fixed POSIX shell script inside the sandbox with paths passed as positional
 * arguments (never interpolated), so it works for any path the sandbox can see,
 * including Modal Volume mounts.
 */

import { posix } from 'node:path';

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
import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  FilesystemError,
  IsDirectoryError,
  MastraFilesystem,
  NotDirectoryError,
  PermissionError,
  StaleFileError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';

import type { ModalSandbox } from '../sandbox';

export interface ModalFilesystemOptions extends MastraFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** Sandbox the filesystem operates through. The filesystem does not own its lifecycle. */
  sandbox: ModalSandbox;
  /**
   * Absolute directory inside the sandbox that workspace paths resolve against,
   * typically a Volume mount path (e.g. `/mnt/agent`). Paths cannot escape it.
   */
  basePath: string;
  /** Reject all write operations */
  readOnly?: boolean;
  /** Human-friendly display name for the UI */
  displayName?: string;
  /** Description shown in tooltips */
  description?: string;
}

/** Exit codes used by the in-sandbox scripts. */
const EXIT = { NOT_FOUND: 2, EXISTS: 3, IS_DIR: 4, NOT_DIR: 5, NOT_EMPTY: 6, NO_PARENT: 7, OUTSIDE: 8 } as const;

/**
 * Runs before every script. Receives `basePath` and the number of leading path
 * arguments, then shifts them off. Each path is resolved through symlinks
 * (resolving the deepest existing ancestor for paths that don't exist yet) and
 * rejected when it lands outside `basePath`. Uses only POSIX sh + `readlink -f`,
 * which GNU coreutils and BusyBox both provide.
 */
const CONFINE = `b=$(readlink -f -- "$1") || exit ${EXIT.OUTSIDE}; n=$2; shift 2; canon() { p=$1; rest=; while [ ! -e "$p" ] && [ ! -L "$p" ]; do rest=/$(basename -- "$p")$rest; p=$(dirname -- "$p"); done; r=$(readlink -f -- "$p") || return 1; printf '%s%s' "$r" "$rest"; }; i=0; for a; do [ "$i" -lt "$n" ] || break; r=$(canon "$a") || exit ${EXIT.OUTSIDE}; case "$r" in "$b"|"$b"/*) ;; *) exit ${EXIT.OUTSIDE};; esac; i=$((i+1)); done;`;

// Scripts receive `$0` = script name and positional args; paths are always quoted.
const PARENT_CHECK = `d=$(dirname -- "$1"); if [ ! -d "$d" ]; then if [ "$2" = 1 ]; then mkdir -p -- "$d" || exit 1; else exit ${EXIT.NO_PARENT}; fi; fi; [ -d "$1" ] && exit ${EXIT.IS_DIR};`;

const SCRIPTS = {
  read: `[ -e "$1" ] || exit ${EXIT.NOT_FOUND}; [ -d "$1" ] && exit ${EXIT.IS_DIR}; cat -- "$1"`,
  write: `${PARENT_CHECK} [ "$3" = 0 ] && [ -e "$1" ] && exit ${EXIT.EXISTS}; cat > "$1"`,
  append: `${PARENT_CHECK} cat >> "$1"`,
  deleteFile: `if [ ! -e "$1" ] && [ ! -L "$1" ]; then [ "$2" = 1 ] && exit 0; exit ${EXIT.NOT_FOUND}; fi; [ -d "$1" ] && exit ${EXIT.IS_DIR}; rm -f -- "$1"`,
  // $1 src, $2 dest, $3 recursive, $4 overwrite, $5 op (cp|mv)
  transfer: `[ -e "$1" ] || exit ${EXIT.NOT_FOUND}; if [ -d "$1" ] && [ "$5" = cp ] && [ "$3" != 1 ]; then exit ${EXIT.IS_DIR}; fi; if [ -e "$2" ]; then [ "$4" = 0 ] && exit ${EXIT.EXISTS}; rm -rf -- "$2"; fi; mkdir -p -- "$(dirname -- "$2")" || exit 1; if [ "$5" = mv ]; then mv -- "$1" "$2"; else cp -R -- "$1" "$2"; fi`,
  mkdir: `if [ "$2" = 1 ]; then [ -e "$1" ] && [ ! -d "$1" ] && exit ${EXIT.EXISTS}; mkdir -p -- "$1"; else [ -e "$1" ] && exit ${EXIT.EXISTS}; [ -d "$(dirname -- "$1")" ] || exit ${EXIT.NO_PARENT}; mkdir -- "$1"; fi`,
  rmdir: `if [ ! -e "$1" ]; then [ "$3" = 1 ] && exit 0; exit ${EXIT.NOT_FOUND}; fi; [ -d "$1" ] || exit ${EXIT.NOT_DIR}; if [ "$2" = 1 ]; then rm -rf -- "$1"; else [ -z "$(ls -A -- "$1")" ] || exit ${EXIT.NOT_EMPTY}; rmdir -- "$1"; fi`,
  // Emits NUL-separated records: target type, own type, size, relative path, link target.
  readdir: `[ -e "$1" ] || exit ${EXIT.NOT_FOUND}; [ -d "$1" ] || exit ${EXIT.NOT_DIR}; find "$1" -mindepth 1 -maxdepth "$2" -exec sh -c 'b=$1; shift; for p; do if [ -d "$p" ]; then t=d; else t=f; fi; o=$t; l=; if [ -L "$p" ]; then o=l; l=$(readlink -- "$p"); fi; s=0; if [ "$o" = f ]; then s=$(($(wc -c < "$p"))); fi; printf "%s\\0%s\\0%s\\0%s\\0%s\\0" "$t" "$o" "$s" "\${p#"$b"/}" "$l"; done' sh "$1" {} +`,
  exists: `[ -e "$1" ]`,
  // Emits: type, size, birth time, modification time (epoch seconds).
  stat: `[ -e "$1" ] || exit ${EXIT.NOT_FOUND}; stat -L -c '%F|%s|%W|%Y' -- "$1"`,
} as const;

const DEFAULT_MAX_DEPTH = 100;

interface ExecResult {
  exitCode: number;
  stdout: Uint8Array;
  stderr: string;
}

function toBytes(content: FileContent): Uint8Array {
  return typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
}

function flag(value: boolean): string {
  return value ? '1' : '0';
}

function matchesExtension(name: string, extension: string | string[]): boolean {
  const ext = posix.extname(name);
  const extensions = Array.isArray(extension) ? extension : [extension];
  return extensions.some(e => e === ext || e === ext.slice(1));
}

/**
 * Workspace filesystem that reads and writes files inside a Modal Sandbox.
 *
 * Mount a Modal Volume on the sandbox and point `basePath` at the mount to give
 * agents persistent files that survive sandbox restarts.
 *
 * @example
 * ```typescript
 * import { Volume } from 'modal';
 * import { Workspace } from '@mastra/core/workspace';
 * import { ModalSandbox, ModalFilesystem } from '@mastra/modal';
 *
 * const volume = await modal.volumes.fromName('agent-files', { createIfMissing: true });
 * const sandbox = new ModalSandbox({ volumes: { '/mnt/agent': volume }, workingDirectory: '/workspace' });
 * const filesystem = new ModalFilesystem({ sandbox, basePath: '/mnt/agent' });
 *
 * const workspace = new Workspace({ sandbox, filesystem });
 * ```
 */
export class ModalFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'ModalFilesystem';
  readonly provider = 'modal';
  readonly readOnly?: boolean;
  readonly displayName?: string;
  readonly description?: string;
  readonly icon: FilesystemIcon = 'folder';
  readonly basePath: string;

  status: ProviderStatus = 'pending';

  private readonly sandbox: ModalSandbox;
  /** Serializes stdin-streaming execs; concurrent stdin writes can wedge a Modal exec. */
  private _writeQueue: Promise<unknown> = Promise.resolve();

  constructor(options: ModalFilesystemOptions) {
    super({ ...options, name: 'ModalFilesystem' });
    if (!posix.isAbsolute(options.basePath)) {
      throw new Error(`[ModalFilesystem] basePath must be absolute, got "${options.basePath}"`);
    }
    this.id = options.id ?? `modal-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.sandbox = options.sandbox;
    this.basePath = posix.normalize(options.basePath).replace(/(.)\/$/, '$1');
    this.readOnly = options.readOnly;
    this.displayName = options.displayName;
    this.description = options.description;
  }

  async init(): Promise<void> {
    await this.sandbox.ensureRunning();
  }

  getInfo(): FilesystemInfo<{ basePath: string }> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      readOnly: this.readOnly,
      icon: this.icon,
      metadata: { basePath: this.basePath },
    };
  }

  getInstructions(): string {
    const access = this.readOnly ? 'Read-only' : 'Persistent';
    return `${access} files stored at ${this.basePath} inside the Modal sandbox.`;
  }

  /**
   * Resolve a workspace path to an absolute sandbox path under `basePath`.
   * Rejects paths that would escape the base directory.
   */
  resolvePath(path: string): string {
    const relative = posix.normalize(`./${path.replace(/^\/+/, '')}`).replace(/\/$/, '') || '.';
    if (relative === '..' || relative.startsWith('../')) {
      throw new PermissionError(path, 'access outside filesystem base path');
    }
    return relative === '.' ? this.basePath : posix.join(this.basePath, relative);
  }

  // ---------------------------------------------------------------------------
  // File operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const { stdout } = await this.run('read', [this.resolvePath(path)], path);
    const buffer = Buffer.from(stdout);
    return options?.encoding ? buffer.toString(options.encoding) : buffer;
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    this.assertWritable('writeFile');
    if (options?.expectedMtime) {
      const current = await this.stat(path).catch(error => {
        if (error instanceof FileNotFoundError) return undefined;
        throw error;
      });
      if (current && current.modifiedAt.getTime() !== options.expectedMtime.getTime()) {
        throw new StaleFileError(path, options.expectedMtime, current.modifiedAt);
      }
    }
    const args = [this.resolvePath(path), flag(options?.recursive !== false), flag(options?.overwrite !== false)];
    await this.run('write', args, path, toBytes(content));
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    this.assertWritable('appendFile');
    await this.run('append', [this.resolvePath(path), '1'], path, toBytes(content));
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable('deleteFile');
    await this.run('deleteFile', [this.resolvePath(path), flag(!!options?.force)], path);
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable('copyFile');
    await this.transfer('cp', src, dest, options);
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable('moveFile');
    await this.transfer('mv', src, dest, options);
  }

  // ---------------------------------------------------------------------------
  // Directory operations
  // ---------------------------------------------------------------------------

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    this.assertWritable('mkdir');
    await this.run('mkdir', [this.resolvePath(path), flag(options?.recursive !== false)], path, undefined, true);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable('rmdir');
    const resolved = this.resolvePath(path);
    if (resolved === this.basePath) {
      throw new PermissionError(path, 'remove filesystem base path');
    }
    await this.run('rmdir', [resolved, flag(!!options?.recursive), flag(!!options?.force)], path, undefined, true);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const depth = options?.recursive ? (options.maxDepth ?? DEFAULT_MAX_DEPTH) + 1 : 1;
    const { stdout } = await this.run('readdir', [this.resolvePath(path), String(depth)], path, undefined, true);

    const fields = new TextDecoder().decode(stdout).split('\0');
    const entries: FileEntry[] = [];
    for (let i = 0; i + 4 < fields.length; i += 5) {
      const [targetType, ownType, size, name, linkTarget] = fields.slice(i, i + 5) as [
        string,
        string,
        string,
        string,
        string,
      ];
      const type = targetType === 'd' ? 'directory' : 'file';
      const isSymlink = ownType === 'l';
      if (options?.extension && type === 'file' && !matchesExtension(name, options.extension)) continue;

      const entry: FileEntry = { name, type };
      if (isSymlink) {
        entry.isSymlink = true;
        entry.symlinkTarget = linkTarget;
      } else if (type === 'file') {
        entry.size = Number(size);
      }
      entries.push(entry);
    }
    return entries;
  }

  // ---------------------------------------------------------------------------
  // Path operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    const { exitCode } = await this.exec('exists', [this.resolvePath(path)]);
    return exitCode === 0;
  }

  async stat(path: string): Promise<FileStat> {
    const resolved = this.resolvePath(path);
    const { stdout } = await this.run('stat', [resolved], path);
    const [kind = '', size = '0', birth = '0', mtime = '0'] = new TextDecoder().decode(stdout).trim().split('|');
    const type = kind === 'directory' ? 'directory' : 'file';
    const modifiedAt = new Date(Number(mtime) * 1000);
    const birthSeconds = Number(birth);
    return {
      name: posix.basename(resolved),
      path: resolved,
      type,
      size: type === 'directory' ? 0 : Number(size),
      createdAt: birthSeconds > 0 ? new Date(birthSeconds * 1000) : modifiedAt,
      modifiedAt,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private assertWritable(operation: string): void {
    if (this.readOnly) throw new WorkspaceReadOnlyError(operation);
  }

  private async transfer(op: 'cp' | 'mv', src: string, dest: string, options?: CopyOptions): Promise<void> {
    const args = [
      this.resolvePath(src),
      this.resolvePath(dest),
      flag(!!options?.recursive),
      flag(options?.overwrite !== false),
      op,
    ];
    await this.run('transfer', args, src);
  }

  /** Run a script and translate non-zero exit codes into filesystem errors. */
  private async run(
    script: keyof typeof SCRIPTS,
    args: string[],
    path: string,
    stdin?: Uint8Array,
    directoryOp = false,
  ): Promise<ExecResult> {
    const result = await this.exec(script, args, stdin);
    switch (result.exitCode) {
      case 0:
        return result;
      case EXIT.NOT_FOUND:
        throw directoryOp ? new DirectoryNotFoundError(path) : new FileNotFoundError(path);
      case EXIT.NO_PARENT:
        throw new DirectoryNotFoundError(posix.dirname(path));
      case EXIT.EXISTS:
        throw new FileExistsError(path);
      case EXIT.IS_DIR:
        throw new IsDirectoryError(path);
      case EXIT.NOT_DIR:
        throw new NotDirectoryError(path);
      case EXIT.NOT_EMPTY:
        throw new DirectoryNotEmptyError(path);
      case EXIT.OUTSIDE:
        throw new PermissionError(path, 'access outside filesystem base path');
      default: {
        const message = result.stderr.trim();
        if (/permission denied|read-only file system/i.test(message)) {
          throw new PermissionError(path, script);
        }
        throw new FilesystemError(
          `[ModalFilesystem] ${script} failed for ${path} (exit ${result.exitCode})${message ? `: ${message}` : ''}`,
          'EIO',
          path,
        );
      }
    }
  }

  private async exec(script: keyof typeof SCRIPTS, args: string[], stdin?: Uint8Array): Promise<ExecResult> {
    await this.ensureReady();
    const execute = async (): Promise<ExecResult> => {
      const pathCount = script === 'transfer' ? '2' : '1';
      const command = ['sh', '-c', `${CONFINE} ${SCRIPTS[script]}`, script, this.basePath, pathCount, ...args];
      const proc = await this.sandbox.modal.exec(command, {
        mode: 'binary',
      });
      if (stdin) {
        await proc.stdin.writeBytes(stdin);
      }
      await proc.stdin.close();
      const [stdout, stderr, exitCode] = await Promise.all([
        proc.stdout.readBytes(),
        proc.stderr.readBytes(),
        proc.wait(),
      ]);
      return { exitCode, stdout, stderr: new TextDecoder().decode(stderr) };
    };
    // Append isn't idempotent: the bytes may already be applied when the process dies, so never replay it.
    const runOnce = () => (script === 'append' ? execute() : this.sandbox.retryOnDead(execute));

    if (!stdin) return runOnce();

    const next = this._writeQueue.then(runOnce, runOnce);
    this._writeQueue = next.catch(() => {});
    return next;
  }
}

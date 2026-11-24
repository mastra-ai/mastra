import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export const SOCKET_ROOT_ENV = 'MASTRACODE_SIGNALS_SOCKET_ROOT';

/** Kept short: macOS limits Unix socket paths to 104 bytes and `$TMPDIR` alone takes about 49. */
const SOCKET_ROOT_NAME = 'mc';

export type SocketRootContext = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  uid?: number;
  /** macOS per-user temporary directory, for when `$TMPDIR` is unset. */
  darwinUserTempDir?: () => string | undefined;
  /** Linux runtime directory for when `$XDG_RUNTIME_DIR` is unset. Defaults to `/run/user/<uid>`. */
  runtimeDir?: string;
  /** Parent of the last-resort `mc-<uid>` directory. */
  fallbackParent?: string;
};

function getconfDarwinUserTempDir(): string | undefined {
  try {
    return execFileSync('/usr/bin/getconf', ['DARWIN_USER_TEMP_DIR'], { encoding: 'utf8', timeout: 2000 }).trim();
  } catch {
    return undefined;
  }
}

/**
 * Why `path` is not a directory only `uid` can use, or undefined if it is.
 * Uses lstat, so a symlink is refused rather than followed.
 */
function privateDirProblem(path: string, uid: number): string | undefined {
  let stats;
  try {
    stats = lstatSync(path);
  } catch (error) {
    return `cannot be read (${(error as NodeJS.ErrnoException).code ?? String(error)})`;
  }
  if (stats.isSymbolicLink()) return 'is a symbolic link';
  if (!stats.isDirectory()) return 'is not a directory';
  if (stats.uid !== uid) return `is owned by uid ${stats.uid}, not ${uid}`;
  if ((stats.mode & 0o077) !== 0) return `has mode ${(stats.mode & 0o777).toString(8)}, which other users can access`;
  return undefined;
}

function isPrivateDir(path: string | undefined, uid: number): path is string {
  return Boolean(path && isAbsolute(path) && privateDirProblem(path, uid) === undefined);
}

/** A directory only this user can use, which every instance of this user resolves the same way. */
function perUserBase(ctx: Required<Omit<SocketRootContext, 'fallbackParent'>>): string | undefined {
  const { env, platform, uid, runtimeDir } = ctx;
  if (platform === 'darwin') {
    if (isPrivateDir(env.TMPDIR, uid)) return env.TMPDIR;
    const userTemp = ctx.darwinUserTempDir();
    return isPrivateDir(userTemp, uid) ? userTemp : undefined;
  }
  if (isPrivateDir(env.XDG_RUNTIME_DIR, uid)) return env.XDG_RUNTIME_DIR;
  // A shell without a login session (ssh, cron, a container exec) often has no
  // XDG_RUNTIME_DIR, while the user's runtime directory still exists.
  return isPrivateDir(runtimeDir, uid) ? runtimeDir : undefined;
}

/** Creates `path` with mode 0700 unless it exists, then refuses it unless only `uid` can use it. */
function ensurePrivateDir(path: string, uid: number): string {
  try {
    mkdirSync(path, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  const problem = privateDirProblem(path, uid);
  if (problem) {
    throw new Error(
      `Refusing to use ${path} for Mastra Code signal sockets: it ${problem}. Remove it, or set ${SOCKET_ROOT_ENV} to an absolute path of a directory only you can access.`,
    );
  }
  return path;
}

/**
 * The directory that holds every resource's signal socket directory.
 *
 * `MASTRACODE_SIGNALS_SOCKET_ROOT` (absolute) wins. Otherwise it is `mc` in a
 * directory only this user can write to: `$TMPDIR` on macOS, `$XDG_RUNTIME_DIR`
 * (or `/run/user/<uid>`) elsewhere, falling back to `<tmp>/mc-<uid>`. The
 * directory is created with mode 0700 and refused, with an error, if it is a
 * symlink, belongs to another user or is accessible to other users.
 */
export function resolveSignalsSocketRoot(context: SocketRootContext = {}): string {
  const env = context.env ?? process.env;
  const override = env[SOCKET_ROOT_ENV];
  if (override && isAbsolute(override)) return override;

  const platform = context.platform ?? process.platform;
  const uid = context.uid ?? process.getuid?.();
  // Windows has no uid and no Unix socket signals; nothing to protect.
  if (uid === undefined) return join(tmpdir(), SOCKET_ROOT_NAME);

  const base = perUserBase({
    env,
    platform,
    uid,
    darwinUserTempDir: context.darwinUserTempDir ?? getconfDarwinUserTempDir,
    runtimeDir: context.runtimeDir ?? `/run/user/${uid}`,
  });
  if (base) return ensurePrivateDir(join(base, SOCKET_ROOT_NAME), uid);
  return ensurePrivateDir(join(context.fallbackParent ?? '/tmp', `${SOCKET_ROOT_NAME}-${uid}`), uid);
}

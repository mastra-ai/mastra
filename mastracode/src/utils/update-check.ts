/**
 * Check for newer versions of mastracode on npm.
 */

import { execFile } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

declare const MASTRACODE_VERSION: string | undefined;

const PACKAGE_NAME = 'mastracode';
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

/** Timeout for the npm registry fetch (ms). */
const FETCH_TIMEOUT_MS = 5_000;

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

function matchPM(str: string): PackageManager | null {
  // Order matters: check pnpm before npm since "npm" is a substring of some paths
  if (/pnpm/i.test(str)) return 'pnpm';
  if (/\byarn\b/i.test(str)) return 'yarn';
  if (/\bbun\b/i.test(str)) return 'bun';
  if (/\bnpm\b/i.test(str)) return 'npm';
  return null;
}

/**
 * Detect which package manager was used to install mastracode globally.
 *
 * Uses a multi-tier approach:
 * 1. npm_config_user_agent env var (set when run via `pnpm run`, `npm run`, etc.)
 * 2. npm_execpath env var (fallback for script-based invocation)
 * 3. NODE_PATH env var (set by pnpm global bin stubs)
 * 4. Resolved path of the running script (process.argv[1])
 * 5. Shell-out to `pnpm list -g` to check if pnpm manages the package
 * 6. Falls back to 'npm'
 */
export async function detectPackageManager(): Promise<PackageManager> {
  // Tier 1: npm_config_user_agent (most reliable when available)
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    const pm = matchPM(userAgent);
    if (pm) return pm;
  }

  // Tier 2: npm_execpath
  const execPath = process.env.npm_execpath;
  if (execPath) {
    const pm = matchPM(execPath);
    if (pm) return pm;
  }

  // Tier 3: NODE_PATH (pnpm global stubs set this to paths containing .pnpm)
  const nodePath = process.env.NODE_PATH;
  if (nodePath) {
    if (/[/\\]\.pnpm[/\\]/.test(nodePath) || /[/\\]pnpm[/\\]/.test(nodePath)) return 'pnpm';
    if (/[/\\]\.yarn[/\\]/.test(nodePath)) return 'yarn';
    if (/[/\\]\.bun[/\\]/.test(nodePath)) return 'bun';
  }

  // Tier 4: Resolved script path
  try {
    const scriptPath = realpathSync(process.argv[1] ?? '');
    if (/[/\\]\.?pnpm[/\\]/.test(scriptPath)) return 'pnpm';
    if (/[/\\]\.?yarn[/\\]/.test(scriptPath)) return 'yarn';
    if (/[/\\]\.?bun[/\\]/.test(scriptPath)) return 'bun';
  } catch {
    // realpathSync can fail if argv[1] is missing/broken — fall through
  }

  // Tier 5: Check if the package is in pnpm's global store (non-blocking)
  const pnpmResult = await new Promise<boolean>(resolve => {
    execFile('pnpm', ['list', '-g', '--depth=0', PACKAGE_NAME], { timeout: 3_000 }, (error, stdout) => {
      resolve(!error && stdout.includes(PACKAGE_NAME));
    });
  });
  if (pnpmResult) return 'pnpm';

  return 'npm';
}

/**
 * Build the shell command string a user would run to install/update globally.
 */
export function getInstallCommand(pm: PackageManager, version?: string): string {
  const pkg = version ? `${PACKAGE_NAME}@${version}` : `${PACKAGE_NAME}@latest`;
  switch (pm) {
    case 'pnpm':
      return `pnpm add -g ${pkg}`;
    case 'yarn':
      return `yarn global add ${pkg}`;
    case 'bun':
      return `bun add -g ${pkg}`;
    default:
      return `npm install -g ${pkg}`;
  }
}

/**
 * Read the current version, injected at build time by tsup's `define` option.
 * Falls back to reading package.json at runtime (e.g. when running from source with tsx).
 */
export function getCurrentVersion(): string {
  if (typeof MASTRACODE_VERSION !== 'undefined') {
    return MASTRACODE_VERSION;
  }
  // Fallback for running from source (e.g. pnpx tsx mastracode/src/main.ts)
  const dir = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(dir, '../../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

/**
 * Fetch the latest published version from npm.
 * Returns null if the fetch fails (network error, timeout, etc.).
 */
export async function fetchLatestVersion(): Promise<string | null> {
  if (process.env.MASTRACODE_UPDATE_LATEST_VERSION) return process.env.MASTRACODE_UPDATE_LATEST_VERSION;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(NPM_REGISTRY_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Simple semver comparison: returns true if `latest` is newer than `current`.
 * Handles standard x.y.z versions. Ignores pre-release tags.
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/, '')
      .split('-')[0]!
      .split('.')
      .map(s => {
        const n = Number(s);
        return Number.isFinite(n) ? n : 0;
      });
  const [cMajor = 0, cMinor = 0, cPatch = 0] = parse(current);
  const [lMajor = 0, lMinor = 0, lPatch = 0] = parse(latest);
  if (lMajor !== cMajor) return lMajor > cMajor;
  if (lMinor !== cMinor) return lMinor > cMinor;
  return lPatch > cPatch;
}

/** Max entries to show in the changelog summary. */
const MAX_CHANGELOG_ENTRIES = 20;

/**
 * Fetch the CHANGELOG.md for a specific published version from the npm CDN
 * and extract a human-readable summary of changes.
 * Returns null if the fetch fails or the changelog can't be parsed.
 */
export async function fetchChangelog(version: string): Promise<string | null> {
  if (process.env.MASTRACODE_UPDATE_CHANGELOG) return process.env.MASTRACODE_UPDATE_CHANGELOG;

  try {
    const url = `https://unpkg.com/${PACKAGE_NAME}@${version}/CHANGELOG.md`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const text = await res.text();
    return parseChangelog(text, version);
  } catch {
    return null;
  }
}

/**
 * Extract the changelog section for a specific version and format it
 * as a concise bullet list suitable for terminal display.
 */
export function parseChangelog(markdown: string, version: string): string | null {
  const versionHeader = `## ${version}`;
  const startIdx = markdown.indexOf(versionHeader);
  if (startIdx === -1) return null;

  const afterHeader = startIdx + versionHeader.length;
  const nextHeaderIdx = markdown.indexOf('\n## ', afterHeader);
  const section = nextHeaderIdx === -1 ? markdown.slice(afterHeader) : markdown.slice(afterHeader, nextHeaderIdx);

  const lines = section.split('\n');
  const entries: string[] = [];
  let skipIndented = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const trimmed = raw.trim();

    // Only match top-level entries (no leading whitespace before "- ")
    const isTopLevel = raw === trimmed && trimmed.startsWith('- ');
    if (!isTopLevel) {
      // Skip indented sub-items (e.g. dependency list entries)
      if (skipIndented && /^\s+-\s/.test(raw)) continue;
      skipIndented = false;
      continue;
    }

    // Skip dependency update entries and their sub-items
    if (/^- Updated dependenc/i.test(trimmed)) {
      skipIndented = true;
      continue;
    }
    skipIndented = false;

    let entry = trimmed.slice(2);
    // Strip markdown links: [text](url) → text
    entry = entry.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    // Strip PR references like (#15760)
    entry = entry.replace(/\s*\(#\d+\)\s*/g, ' ');
    // Strip commit SHA references like (`abc123`)
    entry = entry.replace(/\s*\(`[a-f0-9]+`\)\s*/g, ' ');
    // Trim trailing periods for cleaner bullet display
    entry = entry.replace(/\.\s*$/, '');
    entry = entry.trim();
    if (entry) entries.push(entry);
    if (entries.length >= MAX_CHANGELOG_ENTRIES) break;
  }

  if (entries.length === 0) return null;
  return entries.map(e => `  • ${e}`).join('\n');
}

/** Result of attempting an auto-update. */
export interface UpdateResult {
  /** true when the package manager exited with code 0. */
  ok: boolean;
  /**
   * Captured stderr from the package manager (and, for spawn failures such as
   * the binary being missing, the underlying error message). Undefined when
   * there was nothing to report.
   */
  stderr?: string;
}

/**
 * Run the appropriate global install command to update mastracode.
 *
 * Note: exit code 0 only means the package manager was happy — it does NOT
 * prove the running binary was updated (e.g. when mastracode is managed by a
 * different tool and npm installs into a location that isn't on the PATH).
 * Callers should confirm the result with {@link getOwnInstalledVersion}.
 */
export function runUpdate(pm: PackageManager, targetVersion: string): Promise<UpdateResult> {
  const args = buildInstallArgs(pm, targetVersion);
  return new Promise(resolve => {
    execFile(pm, args, { timeout: 60_000 }, (error, _stdout, stderr) => {
      const captured = (stderr ?? '').trim();
      if (error) {
        resolve({ ok: false, stderr: captured || error.message });
      } else {
        resolve({ ok: true, stderr: captured || undefined });
      }
    });
  });
}

function buildInstallArgs(pm: PackageManager, version: string): string[] {
  const pkg = `${PACKAGE_NAME}@${version}`;
  switch (pm) {
    case 'pnpm':
      return ['add', '-g', pkg];
    case 'yarn':
      return ['global', 'add', pkg];
    case 'bun':
      return ['add', '-g', pkg];
    default:
      return ['install', '-g', pkg];
  }
}

/** Max stderr lines to surface when an update fails. */
const MAX_UPDATE_ERROR_LINES = 5;

/**
 * Pick the last few meaningful (non-empty) lines of a package manager's stderr
 * so the user sees the real cause of a failed update instead of nothing.
 * Returns null when there is nothing useful to show.
 */
export function formatUpdaterError(stderr: string | undefined): string | null {
  if (!stderr) return null;
  const lines = stderr
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim().length > 0);
  if (lines.length === 0) return null;
  return lines.slice(-MAX_UPDATE_ERROR_LINES).join('\n');
}

/**
 * Locate the mastracode package that the *running* binary belongs to and read
 * its version straight from disk (no cache), so a post-update check reflects
 * what is actually installed. Walks up from the real path of
 * `process.argv[1]` until it finds a `package.json` whose `name` is
 * `"mastracode"`.
 *
 * Returns null when it can't be determined — e.g. when running from source, or
 * the package directory can't be located. Callers should treat null as
 * "unknown", not as a failure.
 */
export function locateOwnInstall(): { dir: string; version: string | null } | null {
  const entry = process.argv[1];
  if (!entry) return null;

  let dir: string;
  try {
    dir = dirname(realpathSync(entry));
  } catch {
    return null;
  }

  // Walk up toward the filesystem root looking for the package's own manifest.
  let previous = '';
  while (dir && dir !== previous) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8')) as {
        name?: string;
        version?: string;
      };
      if (pkg.name === PACKAGE_NAME) {
        return { dir, version: typeof pkg.version === 'string' ? pkg.version : null };
      }
    } catch {
      // No readable/parseable package.json here — keep walking up.
    }
    previous = dir;
    dir = dirname(dir);
  }

  return null;
}

/**
 * Version reported by the mastracode installation that the running binary
 * belongs to, read fresh from disk. Returns null when it can't be determined.
 * See {@link locateOwnInstall}.
 */
export function getOwnInstalledVersion(): string | null {
  return locateOwnInstall()?.version ?? null;
}

/** Outcome of an auto-update, once the on-disk result has been verified. */
export type UpdateOutcome =
  | { status: 'updated'; message: string }
  | { status: 'unchanged'; message: string }
  | { status: 'failed'; message: string };

/**
 * Decide what to tell the user after {@link runUpdate}, given the version the
 * running binary now reports on disk. Pure — all IO is done by the caller.
 *
 * - `failed`:    the package manager errored; the message surfaces its output
 *                plus a manual command to run.
 * - `unchanged`: the package manager exited 0, but the running binary is still
 *                on the old version — it is managed by another tool and the
 *                update landed in a copy that isn't on the PATH. The message is
 *                honest instead of a false "Updated".
 * - `updated`:   confirmed applied, or indeterminable (installed version is
 *                null); the caller should restart.
 */
export function resolveUpdateOutcome(opts: {
  pm: PackageManager;
  targetVersion: string;
  result: UpdateResult;
  installedVersion: string | null;
  installedPackageDir?: string | null;
}): UpdateOutcome {
  const { pm, targetVersion, result, installedVersion, installedPackageDir } = opts;

  if (!result.ok) {
    const cmd = getInstallCommand(pm, targetVersion);
    let message = `Auto-update failed. Run \`${cmd}\` manually.`;
    const details = formatUpdaterError(result.stderr);
    if (details) message += `\n\n${details}`;
    return { status: 'failed', message };
  }

  if (installedVersion !== null && installedVersion !== targetVersion) {
    const cmd = getInstallCommand(pm, targetVersion);
    const location = installedPackageDir ? ` (at ${installedPackageDir})` : '';
    const message =
      `The package manager reported success, but the Mastra Code you are running${location} is still ` +
      `v${installedVersion}. Your installation appears to be managed by another tool — update it with the tool you ` +
      `installed Mastra Code with (e.g. the command that put it on your PATH). If you use a standard package manager, ` +
      `try \`${cmd}\`.`;
    return { status: 'unchanged', message };
  }

  return { status: 'updated', message: `Updated to v${targetVersion}. Please restart Mastra Code.` };
}

import { execFile, execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

export interface CommonBinary {
  name: string;
  path: string | null;
}

const COMMON_BINARIES = [
  'python',
  'python3',
  'node',
  'npm',
  'pnpm',
  'yarn',
  'bun',
  'git',
  'rg',
  'fd',
  'fdfind',
  'curl',
  'wget',
  'docker',
  'make',
  'gcc',
  'g++',
  'go',
  'rustc',
  'cargo',
] as const;

/**
 * The installation itself, not the shell shim in front of it. Version managers put a per-shell directory
 * first on PATH (`fnm` multishells, `nvm` versions, `asdf` shims), and the name of that directory changes on
 * every launch, while these paths are part of the system prompt: an unstable path here costs the whole
 * cached prompt at the start of every run after a restart.
 */
function stablePath(path: string | null): string | null {
  if (!path) return path;
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * Some version managers point every tool at one dispatcher binary (`mise` does: its shims are symlinks to
 * `mise` itself), and resolving would then name that binary for every tool, no longer saying where each one
 * is. When more than one name resolves to the same path, those names keep what `which` reported; the rest
 * are resolved as usual.
 *
 * Every name is looked at first: a directory that gives `node` and `npm` the same path is not a dispatcher,
 * since one installation legitimately answers both.
 */
function withoutDispatcherCollapse(found: { name: string; reported: string | null }[]): CommonBinary[] {
  const entries = found.map(entry => ({ ...entry, stable: stablePath(entry.reported) }));
  const claimed = new Map<string, number>();
  for (const entry of entries) {
    if (entry.stable) claimed.set(entry.stable, (claimed.get(entry.stable) ?? 0) + 1);
  }
  return entries.map(entry => ({
    name: entry.name,
    path: entry.stable && (claimed.get(entry.stable) ?? 0) > 1 ? entry.reported : entry.stable,
  }));
}

let cachedBinaries: CommonBinary[] | null = null;
let inFlightPromise: Promise<CommonBinary[]> | null = null;

function whichCommand(): string {
  return process.platform === 'win32' ? 'where' : 'which';
}

function reportedBinary(name: string): string | null {
  try {
    const output = execFileSync(whichCommand(), [name], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return output.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function reportedBinaryAsync(name: string): Promise<string | null> {
  return new Promise(resolve => {
    execFile(whichCommand(), [name], { encoding: 'utf-8' }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(stdout.trim().split(/\r?\n/)[0] || null);
    });
  });
}

export function detectCommonBinaries(): CommonBinary[] {
  cachedBinaries ??= withoutDispatcherCollapse(COMMON_BINARIES.map(name => ({ name, reported: reportedBinary(name) })));

  return cachedBinaries;
}

export async function detectCommonBinariesAsync(): Promise<CommonBinary[]> {
  if (cachedBinaries) return cachedBinaries;
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = Promise.all(
    COMMON_BINARIES.map(async name => ({ name, reported: await reportedBinaryAsync(name) })),
  ).then(withoutDispatcherCollapse);

  try {
    cachedBinaries = await inFlightPromise;
    return cachedBinaries;
  } finally {
    inFlightPromise = null;
  }
}

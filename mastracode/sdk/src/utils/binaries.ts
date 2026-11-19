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

let cachedBinaries: CommonBinary[] | null = null;
let inFlightPromise: Promise<CommonBinary[]> | null = null;

function resolveBinary(name: string): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which';
  try {
    const output = execFileSync(command, [name], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return stablePath(output.split(/\r?\n/)[0] || null);
  } catch {
    return null;
  }
}

function resolveBinaryAsync(name: string): Promise<string | null> {
  const command = process.platform === 'win32' ? 'where' : 'which';
  return new Promise(resolve => {
    execFile(command, [name], { encoding: 'utf-8' }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve(stablePath(stdout.trim().split(/\r?\n/)[0] || null));
    });
  });
}

export function detectCommonBinaries(): CommonBinary[] {
  cachedBinaries ??= COMMON_BINARIES.map(name => ({
    name,
    path: resolveBinary(name),
  }));

  return cachedBinaries;
}

export async function detectCommonBinariesAsync(): Promise<CommonBinary[]> {
  if (cachedBinaries) return cachedBinaries;
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = Promise.all(
    COMMON_BINARIES.map(async name => ({
      name,
      path: await resolveBinaryAsync(name),
    })),
  );

  try {
    cachedBinaries = await inFlightPromise;
    return cachedBinaries;
  } finally {
    inFlightPromise = null;
  }
}

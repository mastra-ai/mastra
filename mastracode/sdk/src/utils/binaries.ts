import { execFile, execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

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
 * The directory the tool lives in, with the name `which` reported still on the end.
 *
 * Version managers put a per-shell directory first on PATH (`fnm` multishells, `asdf` shims), and that
 * directory's name changes on every launch, while these paths are part of the system prompt: an unstable
 * path here costs the whole cached prompt at the start of every run after a restart. Resolving the whole
 * file instead would name the program behind a shim - `mise` points every tool at itself, BusyBox and
 * OrbStack do the same for some tools, and a Homebrew link names `Cellar/<version>` - which either does not
 * run the tool or changes on every upgrade. Resolving only the directory gives the stable installation and
 * keeps a name that runs the tool.
 */
function stablePath(path: string | null): string | null {
  if (!path) return path;
  try {
    return join(realpathSync(dirname(path)), basename(path));
  } catch {
    return path;
  }
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
  cachedBinaries ??= COMMON_BINARIES.map(name => ({ name, path: stablePath(reportedBinary(name)) }));

  return cachedBinaries;
}

export async function detectCommonBinariesAsync(): Promise<CommonBinary[]> {
  if (cachedBinaries) return cachedBinaries;
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = Promise.all(
    COMMON_BINARIES.map(async name => ({ name, path: stablePath(await reportedBinaryAsync(name)) })),
  );

  try {
    cachedBinaries = await inFlightPromise;
    return cachedBinaries;
  } finally {
    inFlightPromise = null;
  }
}

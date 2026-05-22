import { execFileSync } from 'node:child_process';

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

let cachedBinaries: CommonBinary[] | null = null;

function resolveBinary(name: string): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which';
  try {
    const output = execFileSync(command, [name], { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    return output.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

export function detectCommonBinaries(): CommonBinary[] {
  cachedBinaries ??= COMMON_BINARIES.map(name => ({
    name,
    path: resolveBinary(name),
  }));

  return cachedBinaries;
}

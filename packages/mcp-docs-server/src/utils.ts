import path from 'path';

export function fromRepoRoot(relative: string) {
  return path.resolve(import.meta.dirname, `../../../`, relative);
}
export function fromPackageRoot(relative: string) {
  return path.resolve(import.meta.dirname, `../`, relative);
}

// can't use console.log() because it writes to stdout which will interfere with the MCP Stdio protocol
export const log = console.error;

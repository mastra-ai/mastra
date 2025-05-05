import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function fromRepoRoot(relative: string) {
  return path.resolve(__dirname, `../../../`, relative);
}
export function fromPackageRoot(relative: string) {
  return path.resolve(__dirname, `../`, relative);
}

// can't use console.log() because it writes to stdout which will interfere with the MCP Stdio protocol
export const log = console.error;

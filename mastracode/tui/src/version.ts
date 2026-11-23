import { readFileSync } from 'node:fs';

declare const MASTRACODE_VERSION: string | undefined;

export function getCurrentVersion(): string {
  if (typeof MASTRACODE_VERSION !== 'undefined') {
    return MASTRACODE_VERSION;
  }

  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
  return pkg.version;
}

/** Whether the invocation is `mastracode --version` or `mastracode -v`. */
export function isVersionCommand(argv: string[]): boolean {
  return argv[2] === '--version' || argv[2] === '-v';
}

import { existsSync } from 'node:fs';
import { chmod, lstat, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { IntakeError } from '../domain/operation-errors.js';

export async function ensurePrivateDirectory(path: string) {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const entry = await lstat(path);
  if (!entry.isDirectory() || entry.isSymbolicLink() || (process.getuid && entry.uid !== process.getuid()))
    throw new IntakeError(
      'PRIVATE_STORAGE_REQUIRED',
      'The configured runtime directory is not an owned private directory.',
      'Choose an ordinary directory owned by the local operator.',
    );
  await chmod(path, 0o700);
}

export function projectRoot() {
  // Installed CLI dev runs under src/mastra/public and exposes .mastra as its project root.
  // Start/build variants can expose the original root instead. Verify the maintained worker.
  const configured = process.env.MASTRA_PROJECT_ROOT;
  const candidates = configured ? [configured, dirname(configured)] : [process.cwd()];
  const root = candidates.find(candidate => existsSync(resolve(candidate, 'scripts/pdf-worker.mjs')));
  if (!root)
    throw new IntakeError(
      'PARSER_CONFIGURATION',
      'The maintained local PDF worker is unavailable.',
      'Run Studio from the complete template project with scripts/pdf-worker.mjs present.',
    );
  return resolve(root);
}

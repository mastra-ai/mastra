import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, open, realpath, rename, unlink } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import { hashBytes } from '../domain/case-contracts.js';
import { IntakeError } from '../domain/operation-errors.js';

async function syncDirectory(root: string) {
  const directory = await open(root, 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
export async function artifactBytes(rootDirectory: string, artifactId: string, hash: string) {
  try {
    const root = await realpath(rootDirectory);
    const path = resolve(root, artifactId + '-' + hash);
    if (!z.uuid().safeParse(artifactId).success || !/^[a-f0-9]{64}$/.test(hash) || !path.startsWith(root + sep))
      throw Error('Invalid location');
    const entry = await lstat(path);
    if (!entry.isFile() || entry.isSymbolicLink() || (await realpath(path)) !== path) throw Error('Invalid file');
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const bytes = await file.readFile();
      if (!bytes.length || hashBytes(bytes) !== hash) throw Error('Invalid checksum');
      return bytes;
    } finally {
      await file.close();
    }
  } catch {
    throw new IntakeError(
      'ARTIFACT_UNAVAILABLE',
      'The saved artifact is missing, incomplete or no longer matches its checksum.',
      'Check private storage and restore the paired database and files before retrying.',
      409,
    );
  }
}
// Call while holding the publication database write transaction. The immutable
// identity is reserved before rendering; only complete synced files acquire it.
export async function stageArtifact(root: string, artifactId: string, hash: string, bytes: Uint8Array) {
  if (!bytes.length || hashBytes(bytes) !== hash)
    throw new IntakeError(
      'ARTIFACT_INTEGRITY',
      'Output bytes do not match their checksum.',
      'Correct the selected provider and retry the saved publication.',
      409,
    );
  const path = resolve(root, artifactId + '-' + hash);
  const temporary = path + '.staging-' + randomUUID();
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(bytes);
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    try {
      await link(temporary, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        await artifactBytes(root, artifactId, hash);
      } catch {
        await rename(path, path + '.interrupted-' + randomUUID());
        await link(temporary, path);
      }
    }
    await syncDirectory(root);
  } finally {
    await unlink(temporary);
    await syncDirectory(root);
  }
}

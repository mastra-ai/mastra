import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PlatformSession } from './platform';

interface StoredSession {
  encoding: 'plain' | 'safe-storage';
  data: string;
}

export interface PlatformSessionCodec {
  isEncryptionAvailable: () => boolean;
  encryptString: (value: string) => Buffer;
  decryptString: (value: Buffer) => string;
}

export function serializePlatformSession(session: PlatformSession, codec?: PlatformSessionCodec): StoredSession {
  const raw = JSON.stringify(session);
  if (codec?.isEncryptionAvailable()) {
    return {
      encoding: 'safe-storage',
      data: codec.encryptString(raw).toString('base64'),
    };
  }

  return {
    encoding: 'plain',
    data: raw,
  };
}

export function deserializePlatformSession(stored: StoredSession, codec?: PlatformSessionCodec): PlatformSession {
  const raw =
    stored.encoding === 'safe-storage'
      ? codec?.decryptString(Buffer.from(stored.data, 'base64'))
      : stored.data;

  if (!raw) {
    throw new Error('Platform session is encrypted but safeStorage is unavailable');
  }

  return JSON.parse(raw) as PlatformSession;
}

export async function readPlatformSession(path: string, codec?: PlatformSessionCodec) {
  try {
    const stored = JSON.parse(await readFile(path, 'utf8')) as StoredSession;
    return deserializePlatformSession(stored, codec);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function writePlatformSession(path: string, session: PlatformSession, codec?: PlatformSessionCodec) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(serializePlatformSession(session, codec), null, 2)}\n`, 'utf8');
}

export async function deletePlatformSession(path: string) {
  await rm(path, { force: true });
}

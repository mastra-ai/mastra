import { constants } from 'node:fs';
import type { BigIntStats } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { ExtractionError, extractRecord, MAX_RECORD_BYTES } from './extractors.js';

export const LOCAL_EXTRACTION_VERSION = 'local-extraction-v1';
export type LocalValidator = {
  device: string;
  inode: string;
  size: string;
  modifiedNs: string;
  changedNs: string;
};

function validator(stat: BigIntStats): LocalValidator {
  if (!stat.isFile() || stat.size > BigInt(MAX_RECORD_BYTES))
    throw new ExtractionError('Binary input exceeds 20 MiB or is not a regular file.');
  return {
    device: String(stat.dev),
    inode: String(stat.ino),
    size: String(stat.size),
    modifiedNs: String(stat.mtimeNs),
    changedNs: String(stat.ctimeNs),
  };
}

async function openLocalFile(root: string, path: string) {
  const canonicalRoot = await realpath(root);
  const target = await realpath(resolve(canonicalRoot, path));
  const containment = relative(canonicalRoot, target);
  if (containment === '..' || containment.startsWith('../') || isAbsolute(containment))
    throw new ExtractionError('Record escapes its configured root.');
  return open(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
}

export async function localValidator(root: string, path: string): Promise<LocalValidator> {
  const file = await openLocalFile(root, path);
  try {
    return validator(await file.stat({ bigint: true }));
  } finally {
    await file.close();
  }
}

export async function extractLocalRecord(root: string, path: string, expected: LocalValidator) {
  const file = await openLocalFile(root, path);
  const assertUnchanged = async () => {
    if (JSON.stringify(validator(await file.stat({ bigint: true }))) !== JSON.stringify(expected))
      throw new ExtractionError('Local file changed during synchronization; retry on the next refresh.');
  };
  try {
    await assertUnchanged();
    const buffers: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of file.createReadStream({ autoClose: false, highWaterMark: 64 * 1024 })) {
      bytes += chunk.length;
      if (bytes > MAX_RECORD_BYTES) throw new ExtractionError('Binary input exceeds 20 MiB.');
      buffers.push(chunk);
    }
    await assertUnchanged();
    return await extractRecord(path, Buffer.concat(buffers));
  } finally {
    await file.close();
  }
}

import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keeps *.d.ts: the watch never re-emits them, so emptying dist would strip consumers of types.
const dist = join(dirname(fileURLToPath(import.meta.url)), '../dist');

const clean = async directory => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await clean(path);
    else if (!entry.name.endsWith('.d.ts')) await rm(path);
  }
};

if (existsSync(dist)) await clean(dist);

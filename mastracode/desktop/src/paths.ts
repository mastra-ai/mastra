import { resolve } from 'node:path';

export function resolvePreloadPath(): string {
  return resolve(import.meta.dirname, '../preload/preload.cjs');
}

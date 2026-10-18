import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const fileUrlToPath = (url: string): string => resolve(url.slice('file:'.length));

export const ensureParentDirectory = async (path: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
};

export const ensureDirectory = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true });
};

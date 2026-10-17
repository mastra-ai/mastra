import { copyFile, mkdir } from 'node:fs/promises';
import { constants } from 'node:fs';

await mkdir('data', { recursive: true });
try {
  await copyFile('.env.example', '.env', constants.COPYFILE_EXCL);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}

import { copyFile } from 'node:fs/promises';
import { constants } from 'node:fs';

try {
  await copyFile(
    new URL('../.env.example', import.meta.url),
    new URL('../.env', import.meta.url),
    constants.COPYFILE_EXCL,
  );
  console.log('Created .env. Set OPENAI_API_KEY, then run npm run dev.');
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
    console.log('Preserved existing .env. Set OPENAI_API_KEY, then run npm run dev.');
  } else {
    throw new Error('Could not create .env. Check the template directory permissions.');
  }
}

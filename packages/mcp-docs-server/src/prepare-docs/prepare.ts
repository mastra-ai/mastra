import { log } from '../utils.js';
import { copyRaw } from './copy-raw.js';

export async function prepare() {
  log('Preparing documentation...');
  await copyRaw();
  log('Documentation preparation complete!');
}

if (process.env.PREPARE === `true`) {
  try {
    await prepare();
  } catch (error) {
    console.error('Error preparing documentation:', error);
    process.exit(1);
  }
}

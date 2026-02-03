import { log } from '../../src/utils';
import { copyRaw } from './copy-raw';

export async function prepare() {
  log('Preparing documentation...');
  await copyRaw();
  log('Documentation preparation complete!');
}

try {
  await prepare();
} catch (error) {
  console.error('Error preparing documentation:', error);
  process.exit(1);
}

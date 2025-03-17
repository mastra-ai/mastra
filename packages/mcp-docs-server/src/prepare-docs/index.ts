import { prepare } from './prepare.js';

try {
  await prepare();
} catch (error) {
  console.error('Error preparing documentation:', error);
  process.exit(1);
}

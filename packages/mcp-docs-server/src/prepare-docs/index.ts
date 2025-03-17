import { prepare } from './prepare';

try {
  await prepare();
} catch (error) {
  console.error('Error preparing documentation:', error);
  process.exit(1);
}

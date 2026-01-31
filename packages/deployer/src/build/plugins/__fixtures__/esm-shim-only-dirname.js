// Fixture: User declares only __dirname (issue #10054 scenario 3)
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getDir() {
  return __dirname;
}

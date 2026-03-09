// Fixture: User declares their own __filename and __dirname (like in issue #10054)
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getDir() {
  return __dirname;
}

export function getFile() {
  return __filename;
}

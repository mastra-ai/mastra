// Fixture: User declares their own __filename and __dirname (like in issue #10054)
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getDir() {
  return __dirname;
}

export function getFile() {
  return __filename;
}

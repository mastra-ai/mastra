// Fixture: User declares only __filename (issue #10054 scenario 2)
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

export function getFile() {
  return __filename;
}

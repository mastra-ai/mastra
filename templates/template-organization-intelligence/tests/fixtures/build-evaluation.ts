import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

/** Build shared CLI modules before integration workers can import them. */
export async function setup() {
  await promisify(execFile)('npm', ['exec', '--', 'tsc', '-p', 'tsconfig.eval.json'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)),
  });
}

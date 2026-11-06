import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

const root = fileURLToPath(new URL('..', import.meta.url));
try {
  loadEnvFile(resolve(root, '.env'));
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
    throw new Error('Could not load .env. Check the template configuration file.');
  }
}
const command = process.argv[2];
if (!['dev', 'build', 'start'].includes(command ?? '')) {
  throw new Error('Expected dev, build, or start.');
}

// The CLI changes its execution directory in built output. Resolve state before starting it.
const child = spawn(
  process.execPath,
  [resolve(root, 'node_modules/mastra/dist/index.js'), command, ...process.argv.slice(3)],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ASSISTANT_DATA_DIR: resolve(root, process.env.ASSISTANT_DATA_DIR || '.data'),
    },
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(/** @type {NodeJS.Signals} */ (signal)));
}
child.on('error', () => {
  console.error('Could not start Mastra. Install the template dependencies first.');
  process.exitCode = 1;
});
child.on('exit', code => {
  process.exitCode = code ?? 1;
});

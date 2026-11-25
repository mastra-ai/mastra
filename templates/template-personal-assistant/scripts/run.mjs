import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
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

const dataDir = resolve(root, process.env.ASSISTANT_DATA_DIR || '.data');
if (command !== 'build' && process.env.ASSISTANT_RUNTIME !== 'hosted' && !process.env.ASSISTANT_API_TOKEN) {
  const tokenFile = resolve(dataDir, 'owner-token');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  try {
    await writeFile(tokenFile, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw new Error('Could not prepare the local owner token. Check ASSISTANT_DATA_DIR permissions.');
  }
  process.env.ASSISTANT_API_TOKEN = (await readFile(tokenFile, 'utf8')).trim();
  console.log(`Local Studio: sign in with any email and the token in ${tokenFile} as the password.`);
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
      ASSISTANT_DATA_DIR: dataDir,
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

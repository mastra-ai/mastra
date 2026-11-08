import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (existsSync('.env')) process.loadEnvFile('.env');
const [action, ...args] = process.argv.slice(2);
if (!['dev', 'build', 'start'].includes(action)) throw new Error('Unknown server action.');
const child = spawn(
  process.execPath,
  [fileURLToPath(new URL('../node_modules/mastra/dist/index.js', import.meta.url)), action, ...args],
  { cwd: root, env: { ...process.env, BILLING_PROJECT_ROOT: root }, stdio: 'inherit' },
);
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => child.kill(signal));
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (existsSync('.env')) process.loadEnvFile('.env');
const [action, ...args] = process.argv.slice(2);
if (!['dev', 'build', 'start'].includes(action)) throw new Error('Unknown server action.');
if (action === 'build' && process.env.BILLING_STUDIO_ENABLED === 'true' && !args.includes('--studio'))
  args.push('--studio');
if (action === 'start' && process.env.BILLING_STUDIO_ENABLED === 'true')
  process.env.MASTRA_STUDIO_PATH = fileURLToPath(new URL('../.mastra/output/studio', import.meta.url));
const require = createRequire(import.meta.url);
const packageFile = require.resolve('mastra/package.json');
const manifest = JSON.parse(await readFile(packageFile, 'utf8'));
const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.mastra;
if (typeof bin !== 'string' || !bin) throw new Error('The installed mastra package does not declare its CLI entry.');
const cli = resolve(dirname(packageFile), bin);
const child = spawn(process.execPath, [cli, action, ...args], {
  cwd: root,
  env: { ...process.env, BILLING_PROJECT_ROOT: root },
  stdio: 'inherit',
});
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => child.kill(signal));
child.once('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../node_modules/mastra/dist/index.js', import.meta.url));
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, DO_NOT_TRACK: '1', MASTRA_TELEMETRY_DISABLED: 'true' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', () => {
  console.error('The installed Mastra CLI could not start. Run npm install and try again.');
  process.exitCode = 1;
});
child.on('exit', code => {
  process.exitCode = code ?? 1;
});

import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const { values } = parseArgs({
  args,
  options: { 'state-dir': { type: 'string' } },
  strict: true,
  allowPositionals: false,
});
if (!values['state-dir'] || values['state-dir'].startsWith('-'))
  throw new Error('Pass --state-dir <isolated experiment directory>.');

const child = spawn('npm', ['exec', '--', 'mastra', 'dev', '--dir', 'src/mastra/evaluation/studio'], {
  env: { ...process.env, ORGANIZATION_EVALUATION_STATE_DIR: resolve(values['state-dir']) },
  stdio: 'inherit',
});
let stopping = false;
const stop = signal => {
  if (stopping) return;
  stopping = true;
  child.kill(signal);
};
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(signal));
child.on('error', error => {
  console.error(`Unable to start local experiment Studio: ${error.message}`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

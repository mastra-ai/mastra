import { spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertNoDistributedWhitespace, createDistributableSnapshot } from './distributable-snapshot.mjs';

const source = resolve(process.cwd());
const gates = [
  ['npm', ['run', 'format:check']],
  ['npm', ['run', 'lint']],
  ['npm', ['run', 'typecheck']],
  ['npm', ['run', 'test:unit']],
  ['npm', ['run', 'test:integration']],
  ['npm', ['run', 'test:contract']],
  ['npm', ['run', 'test:eval']],
  ['npm', ['run', 'build']],
  ['npm', ['run', '--workspace', 'support-demo-ui', 'format:check']],
  ['npm', ['run', '--workspace', 'support-demo-ui', 'lint']],
  ['npm', ['run', '--workspace', 'support-demo-ui', 'typecheck']],
  ['npm', ['run', '--workspace', 'support-demo-ui', 'test:unit']],
  ['npm', ['run', '--workspace', 'support-demo-ui', 'test:integration']],
  ['npm', ['run', '--workspace', 'support-demo-ui', 'test:contract']],
  ['npm', ['run', '--workspace', 'support-demo-ui', 'test:eval']],
  ['npm', ['run', '--workspace', 'support-demo-ui', 'build']],
  ['npm', ['run', 'check:runtime']],
  ['npm', ['ci', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund']],
  ['npm', ['run', 'test:e2e']],
  ['npm', ['run', '--workspace', 'client-demo-ui', 'format:check']],
  ['npm', ['run', '--workspace', 'client-demo-ui', 'lint']],
  ['npm', ['run', '--workspace', 'client-demo-ui', 'typecheck']],
  ['npm', ['run', '--workspace', 'client-demo-ui', 'test:unit']],
  ['npm', ['run', '--workspace', 'client-demo-ui', 'test:integration']],
  ['npm', ['run', '--workspace', 'client-demo-ui', 'build']],
];

function sanitizedEnvironment() {
  const allowed = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'npm_config_cache', 'PLAYWRIGHT_BROWSERS_PATH'];
  return Object.fromEntries(allowed.flatMap(key => (process.env[key] === undefined ? [] : [[key, process.env[key]]])));
}

function run(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    timeout: 900_000,
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed in clean snapshot.`);
}

const { destination, fingerprint } = await createDistributableSnapshot(source);
try {
  await assertNoDistributedWhitespace(destination);
  const env = sanitizedEnvironment();
  env.LOCAL_AUTH_SIGNING_KEY = 'pre-push-synthetic-signing-key-at-least-32-characters';
  env.SUPPORT_SOURCE = 'mock';
  env.COMMERCE_SOURCE = 'mock';
  env.MASTRA_TELEMETRY_DISABLED = '1';
  env.NO_COLOR = '1';
  run('npm', ['ci', '--no-audit', '--no-fund'], destination, env);
  run('npm', ['run', 'check:env', '--', '--profile=local', '--mode=deterministic'], destination, env);
  run('npm', ['run', 'check:docs'], destination, env);
  for (const [command, args] of gates) run(command, args, destination, env);
  run('npm', ['run', 'smoke:clean'], destination, env);
  console.log(`Pre-push verification passed for snapshot ${fingerprint}.`);
} finally {
  await rm(destination, { recursive: true, force: true });
}

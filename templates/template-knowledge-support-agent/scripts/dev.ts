import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, open, chmod, rm } from 'node:fs/promises';
import { resolve, dirname, delimiter } from 'node:path';
import { runtimeExample } from '../src/examples/runtime.ts';
import { resolveStoreConfiguration } from '../src/mastra/database/store.ts';

const { profiles: exampleProfiles, reviewers: exampleReviewers, role: exampleStudioRole } = runtimeExample;
const database = resolveStoreConfiguration();
if (database.backend !== 'libsql' || database.lockFile)
  throw new Error('Use the built bundle for hosted mode. npm run dev launches local Studio.');

const studioRole = process.env.SUPPORT_STUDIO_ROLE ?? exampleStudioRole;
const configuredFile = process.env.SUPPORT_CREDENTIALS_FILE || undefined;
const file = configuredFile ?? resolve('.local', `access-${randomBytes(12).toString('hex')}.json`);
let child: ChildProcess | undefined;
let interrupted: NodeJS.Signals | undefined;
let generated = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    interrupted ??= signal;
    child?.kill(signal);
  });
}

async function finish(code: number) {
  if (generated) await rm(file, { force: true });
  process.exit(code);
}

async function createCredentials() {
  await mkdir(resolve('.local'), { recursive: true, mode: 0o700 });
  await chmod(resolve('.local'), 0o700);
  if (interrupted) return;
  const handle = await open(file, 'wx', 0o600);
  generated = true;
  try {
    await handle.writeFile(
      JSON.stringify(
        [...exampleProfiles, ...exampleReviewers].map(profile => ({
          profile: { ...profile, role: studioRole, ...(exampleReviewers.includes(profile) ? { review: true } : {}) },
          token: randomBytes(32).toString('base64url'),
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        })),
        null,
        2,
      ),
    );
    await handle.chmod(0o600);
  } finally {
    await handle.close();
  }
}

try {
  if (!configuredFile) await createCredentials();
  if (interrupted) await finish(interrupted === 'SIGINT' ? 130 : 143);
  console.log(
    `Local Studio credentials are available privately in ${file}. Open this file locally to copy a profile token.`,
  );
  if (!configuredFile) console.log('Generated tokens expire after eight hours.');
  child = spawn(process.execPath, ['node_modules/mastra/dist/index.js', 'dev'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH}`,
      MASTRA_AGENT_SIGNALS: 'false',
      SUPPORT_CREDENTIALS_FILE: file,
      SUPPORT_STUDIO_ROLE: studioRole,
      SUPPORT_DATABASE_URL: database.url,
    },
  });
} catch (error) {
  if (generated) await rm(file, { force: true });
  throw error;
}
child!.once('error', () => {
  void finish(1);
});
child!.once('exit', code => {
  void finish(code ?? 1);
});

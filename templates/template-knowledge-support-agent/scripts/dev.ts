import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, chmod, rm } from 'node:fs/promises';
import { resolve, dirname, delimiter } from 'node:path';
import { runtimeExample } from '../src/examples/runtime.ts';

const { profiles: exampleProfiles, reviewers: exampleReviewers, role: exampleStudioRole } = runtimeExample;
import { hostedMode, localDatabaseUrl } from '../src/mastra/database.ts';

if (hostedMode()) throw new Error('Use the built bundle for hosted mode; npm run dev is the local Studio launcher');

const studioRole = process.env.SUPPORT_STUDIO_ROLE ?? exampleStudioRole;
const databaseUrl = localDatabaseUrl();
const generated = !process.env.SUPPORT_CREDENTIALS_FILE;
const file =
  process.env.SUPPORT_CREDENTIALS_FILE ?? resolve('.local', `access-${randomBytes(12).toString('hex')}.json`);
if (generated) {
  await mkdir(resolve('.local'), { recursive: true, mode: 0o700 });
  await chmod(resolve('.local'), 0o700);
  await writeFile(
    file,
    JSON.stringify(
      [...exampleProfiles, ...exampleReviewers].map(profile => ({
        profile: { ...profile, role: studioRole, ...(exampleReviewers.includes(profile) ? { review: true } : {}) },
        token: randomBytes(32).toString('base64url'),
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      })),
      null,
      2,
    ),
    { mode: 0o600, flag: 'wx' },
  );
  await chmod(file, 0o600);
}
console.log(
  `Local Studio credentials are available privately in ${file}. Open this file locally to copy a profile token. Tokens expire after eight hours.`,
);
const child = spawn(process.execPath, ['node_modules/mastra/dist/index.js', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH}`,
    MASTRA_AGENT_SIGNALS: 'false',
    SUPPORT_CREDENTIALS_FILE: file,
    SUPPORT_STUDIO_ROLE: studioRole,
    SUPPORT_DATABASE_URL: databaseUrl,
  },
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
async function finish(code: number) {
  if (generated) await rm(file, { force: true });
  process.exit(code);
}
child.once('error', () => {
  void finish(1);
});
child.once('exit', code => {
  void finish(code ?? 1);
});

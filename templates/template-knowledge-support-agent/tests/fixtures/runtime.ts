import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { exampleProfiles, exampleStudioRole } from '../../src/examples/retail-pos/profiles.ts';
import { principals, resourceId } from '../../src/mastra/identity.ts';
import type { KnowledgePage } from '@mastra/core/knowledge';
import { startModelServer } from './model-server.ts';

export async function runtimeFixture(options: { generatedCredentials?: boolean; studioRole?: string } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-support-'));
  const model = await startModelServer();
  const studioRole = options.studioRole ?? exampleStudioRole;
  const credentials = [
    ...exampleProfiles,
    { ...exampleProfiles[0]!, id: 'literal', customerId: 'store:1' },
    { ...exampleProfiles[0]!, id: 'encoded', customerId: 'store%3A1' },
  ].map(profile => ({
    profile: { ...profile, role: studioRole },
    token: randomBytes(32).toString('base64url'),
    expiresAt: Date.now() + 60 * 60 * 1000,
  }));
  const expired = { ...credentials[0]!, token: randomBytes(32).toString('base64url'), expiresAt: Date.now() - 1 };
  const file = join(directory, 'access.json');
  await writeFile(file, JSON.stringify([...credentials, expired]), { mode: 0o600 });
  process.env.SUPPORT_DATABASE_URL = `file:${join(directory, 'support.db')}`;
  process.env.SUPPORT_CREDENTIALS_FILE = file;
  process.env.SUPPORT_STUDIO_ROLE = studioRole;
  process.env.SUPPORT_MODEL_BASE_URL = model.url;
  process.env.OPENAI_API_KEY = 'synthetic-model-key';
  const port = 43000 + Math.floor(Math.random() * 10000);
  const base = `http://127.0.0.1:${port}`;
  const runtime = (await import(
    `../../src/mastra/index.ts?fixture=${randomBytes(6).toString('hex')}`
  )) as typeof import('../../src/mastra/index.ts');
  const pages: KnowledgePage[] = [];
  for (const [index, credential] of credentials.entries()) {
    if (index === 3) {
      pages.push(pages[0]!);
      continue;
    }
    const scope = principals(credential.profile)[1]!;
    const { page } = await runtime.supportKnowledge.upsertPage({
      scope,
      path: 'cases/synthetic',
      name: `SYNTHETIC case ${index}`,
      body: `SYNTHETIC_PRIVATE_${index}`,
      author: 'synthetic-fixture',
    });
    await runtime.supportKnowledge.addNote({
      scope,
      path: 'cases/synthetic',
      text: `SYNTHETIC_NOTE_${index}`,
      author: 'synthetic-fixture',
    });
    await runtime.supportKnowledge.upsertPage({
      scope: `docs:${credential.profile.tenantId}`,
      path: 'manual',
      name: 'SYNTHETIC documentation',
      body: `SYNTHETIC_DOC_${credential.profile.tenantId}`,
      author: 'synthetic-fixture',
    });
    pages.push(page);
  }
  await runtime.supportKnowledge.addNote({
    scope: 'docs:north',
    path: 'manual',
    text: 'SYNTHETIC_FOREIGN_STAMP_1',
    stamps: ['customer:north:store-2'],
    author: 'synthetic-fixture',
  });
  let child: ReturnType<typeof spawn> | undefined;
  let output = '';
  let activeCredentialFile: string | undefined;
  function launchEnvironment(generated: boolean) {
    const environment: NodeJS.ProcessEnv = { ...process.env, PORT: String(port) };
    if (generated) delete environment.SUPPORT_CREDENTIALS_FILE;
    if (generated && options.studioRole === undefined) delete environment.SUPPORT_STUDIO_ROLE;
    return environment;
  }
  async function request(path: string, owner = 0, options: RequestInit = {}) {
    return fetch(`${base}/api${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${credentials[owner]!.token}`,
        'content-type': 'application/json',
        ...options.headers,
      },
    });
  }
  async function start() {
    output = '';
    activeCredentialFile = undefined;
    child = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      detached: true,
      env: launchEnvironment(!!options.generatedCredentials),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', chunk => {
      output = (output + chunk).slice(-10000);
    });
    child.stderr?.on('data', chunk => {
      output = (output + chunk).slice(-10000);
    });
    for (let index = 0; index < 150; index++) {
      if (options.generatedCredentials && !activeCredentialFile) {
        const match = /Local Studio credentials are available privately in (.+?)\. Open/u.exec(output);
        if (match) {
          activeCredentialFile = match[1]!;
          const generated = JSON.parse(await readFile(activeCredentialFile, 'utf8'));
          for (const credential of credentials) {
            const entry = generated.find(
              (entry: { profile: { id: string } }) => entry.profile.id === credential.profile.id,
            );
            if (entry) credential.token = entry.token;
          }
        }
      }
      try {
        const response = await request('/knowledge');
        if (response.status === 200) return;
        if (response.status !== 503)
          throw new Error(`Startup HTTP ${response.status}: ${await response.text()}\n${output}`);
      } catch (error) {
        if (!(error instanceof TypeError)) throw error;
      }
      if (child.exitCode !== null) throw new Error(`Dev exited: ${output}`);
      await setTimeout(200);
    }
    throw new Error(`Dev did not boot: ${output}`);
  }
  async function duplicateStart() {
    let duplicateOutput = '';
    const duplicate = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      detached: true,
      env: launchEnvironment(true),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    duplicate.stdout?.on('data', chunk => {
      duplicateOutput = (duplicateOutput + chunk).slice(-10000);
    });
    duplicate.stderr?.on('data', chunk => {
      duplicateOutput = (duplicateOutput + chunk).slice(-10000);
    });
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timer = globalThis.setTimeout(() => {
        if (duplicate.pid) {
          try {
            process.kill(-duplicate.pid, 'SIGKILL');
          } catch {}
        }
        reject(new Error('Duplicate dev launch did not exit'));
      }, 15000);
      duplicate.once('exit', code => {
        clearTimeout(timer);
        resolve(code);
      });
      duplicate.once('error', error => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const match = /Local Studio credentials are available privately in (.+?)\. Open/u.exec(duplicateOutput);
    assert.ok(match, 'Duplicate launcher must identify its own private credential file');
    return { exitCode, file: match[1]!, output: duplicateOutput };
  }
  async function stop() {
    if (!child?.pid) return;
    const pid = child.pid;
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {}
    for (let index = 0; index < 50 && child.exitCode === null; index++) await setTimeout(100);
    if (child.exitCode === null) {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {}
    }
    child = undefined;
  }
  return {
    ...runtime,
    model,
    credentials,
    expired,
    pages,
    base,
    request,
    start,
    stop,
    duplicateStart,
    credentialFile: () => activeCredentialFile,
    injectedCredentialFile: file,
    output: () => output,
    async close() {
      await stop();
      await model.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

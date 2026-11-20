import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { exampleProfiles, exampleStudioRole } from '../../src/examples/retail-pos/profiles.ts';
import type { Profile } from '../../src/mastra/identity.ts';
import { principals, resourceId } from '../../src/mastra/identity.ts';
import type { KnowledgePage } from '@mastra/core/knowledge';
import { startModelServer, type ModelScript } from './model-server.ts';

interface RuntimeOptions {
  generatedCredentials?: boolean;
  studioRole?: string;
  modelScript?: ModelScript;
  profiles?: (Profile & { review?: boolean })[];
  syntheticKnowledge?: boolean;
  example?: 'retail-pos' | 'software-integration';
}
interface RuntimeProcess {
  launcher: ReturnType<typeof spawn>;
  closed: boolean;
  error?: Error;
}

export async function runtimeFixture(options: RuntimeOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-support-'));
  let model: Awaited<ReturnType<typeof startModelServer>> | undefined;
  try {
    model = await startModelServer(options.modelScript);
    return await configureRuntime(directory, model, options);
  } catch (error) {
    await Promise.allSettled([model?.close(), rm(directory, { recursive: true, force: true })]);
    throw error;
  }
}

async function configureRuntime(
  directory: string,
  model: Awaited<ReturnType<typeof startModelServer>>,
  options: RuntimeOptions,
) {
  const studioRole = options.studioRole ?? exampleStudioRole;
  const credentials = (
    options.profiles ?? [
      ...exampleProfiles,
      { ...exampleProfiles[0]!, id: 'literal', customerId: 'store:1' },
      { ...exampleProfiles[0]!, id: 'encoded', customerId: 'store%3A1' },
    ]
  ).map(profile => ({
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
  try {
    if (options.syntheticKnowledge !== false) {
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
      for (const tenant of ['north', 'south']) {
        await runtime.supportKnowledge.upsertPage({
          scope: `tenant:${tenant}`,
          path: 'policies/safe-changes',
          name: 'Synthetic safety policy',
          body: 'Preserve pending work. Obtain authorization before any disruptive change. Do not reset while offline payments are pending.',
          author: 'synthetic-fixture',
        });
      }
    }
  } catch (error) {
    await runtime.storage.close().catch(() => undefined);
    throw error;
  }
  let child: RuntimeProcess | undefined;
  let output = '';
  let activeCredentialFile: string | undefined;
  function launchEnvironment(generated: boolean) {
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(port),
      ...(options.example ? { SUPPORT_EXAMPLE: options.example } : {}),
    };
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
    assert.equal(child, undefined, 'Stop the existing runtime before starting it again');
    const launcher = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      detached: true,
      env: launchEnvironment(!!options.generatedCredentials),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const running: RuntimeProcess = { launcher, closed: false };
    child = running;
    launcher.once('close', () => {
      running.closed = true;
    });
    launcher.once('error', error => {
      running.error = error;
    });
    launcher.stdout?.on('data', chunk => {
      output = (output + chunk).slice(-10000);
    });
    launcher.stderr?.on('data', chunk => {
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
      if (running.error) throw running.error;
      if (launcher.exitCode !== null || launcher.signalCode !== null) throw new Error(`Dev exited: ${output}`);
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
      duplicate.once('close', code => {
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
    const running = child;
    if (!running) return;
    const pid = running.launcher.pid;
    const signalGroup = (signal: NodeJS.Signals) => {
      if (!pid) return;
      try {
        process.kill(-pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    };
    const portReleased = () =>
      new Promise<boolean>(resolve => {
        const socket = createConnection({ port, host: '127.0.0.1', timeout: 100 });
        socket.once('connect', () => {
          socket.destroy();
          resolve(false);
        });
        socket.once('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.once('error', (error: NodeJS.ErrnoException) => resolve(error.code === 'ECONNREFUSED'));
      });
    const waitForShutdown = async () => {
      const deadline = Date.now() + 5000;
      do {
        if (running.closed && (!pid || (await portReleased()))) return true;
        await setTimeout(100);
      } while (Date.now() < deadline);
      return false;
    };
    signalGroup('SIGTERM');
    if (!(await waitForShutdown())) {
      signalGroup('SIGKILL');
      if (!(await waitForShutdown())) throw new Error(`Dev did not release port ${port}: ${output}`);
    }
    child = undefined;
  }
  return {
    ...runtime,
    directory,
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
      try {
        await runtime.storage.close();
      } finally {
        try {
          await model.close();
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      }
    },
  };
}

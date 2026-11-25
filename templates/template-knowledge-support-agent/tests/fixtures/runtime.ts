import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm, readFile, realpath } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { after, before } from 'node:test';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { exampleProfiles, exampleStudioRole } from '../../src/examples/retail-pos/profiles.ts';
import type { Profile } from '../../src/mastra/identity.ts';
import { principals, resourceId } from '../../src/mastra/identity.ts';
import type { KnowledgePage } from '@mastra/core/knowledge';
import { Memory } from '@mastra/memory';
import { startModelServer, type ModelScript } from './model-server.ts';

const template = fileURLToPath(new URL('../..', import.meta.url));

export const localTestDatabaseEnvironment = {
  DATABASE_PROVIDER: 'local',
  SUPPORT_MODE: 'local',
  MASTRA_ENVIRONMENT_ID: '',
} as const;

export function useLocalTestDatabase() {
  const original = { ...process.env };
  before(() => Object.assign(process.env, localTestDatabaseEnvironment));
  after(() => {
    for (const key of Object.keys(localTestDatabaseEnvironment)) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
}

export function fixtureFetch(url: string, options: RequestInit = {}) {
  return fetch(url, { ...options, signal: options.signal ?? AbortSignal.timeout(30000) });
}

export const syntheticSafetyPolicy = `## Before changes

Preserve pending work and obtain authorization before disruptive changes.

## Prohibited actions

Do not reset while offline payments are pending.

## When uncertain

Ask the authorized lead to check the recovery plan.`;

const approvalUpdates = new Map<string, Promise<void>>();

export async function approvePolicyRevision(file: string, ref: string, body: string) {
  const path = await realpath(file);
  const previous = approvalUpdates.get(path) ?? Promise.resolve();
  const update = previous
    .catch(() => undefined)
    .then(async () => {
      const revisions = JSON.parse(await readFile(path, 'utf8')) as Record<string, string[]>;
      (revisions[ref] ??= []).push(createHash('sha256').update(body.trim()).digest('hex'));
      await writeFile(path, JSON.stringify(revisions));
    });
  approvalUpdates.set(path, update);
  try {
    await update;
  } finally {
    if (approvalUpdates.get(path) === update) approvalUpdates.delete(path);
  }
}

interface RuntimeOptions {
  generatedCredentials?: boolean | 'empty';
  studioRole?: string;
  modelScript?: ModelScript;
  profiles?: (Profile & { review?: boolean })[];
  syntheticKnowledge?: boolean;
  preload?: URL;
  example?: 'retail-pos' | 'software-integration' | 'it-helpdesk';
}
interface RuntimeProcess {
  launcher: ReturnType<typeof spawn>;
  closed: boolean;
  bound: boolean;
  error?: Error;
}

// Setup temporarily selects the database and model for the in-process Mastra import.
let environmentQueue: Promise<unknown> = Promise.resolve();
function withRuntimeEnvironment<T>(
  overrides: Record<string, string>,
  operation: (original: NodeJS.ProcessEnv) => Promise<T>,
): Promise<T> {
  const result = environmentQueue.then(async () => {
    const original = { ...process.env };
    Object.assign(process.env, overrides);
    try {
      return await operation(original);
    } finally {
      for (const key of Object.keys(overrides)) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    }
  });
  environmentQueue = result.catch(() => undefined);
  return result;
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
  const databaseUrl = pathToFileURL(join(directory, 'support.db')).href;
  const policyApprovalFile = join(directory, 'approved-policies.json');
  await writeFile(policyApprovalFile, '{}');
  const overrides = {
    ...localTestDatabaseEnvironment,
    SUPPORT_DATABASE_URL: databaseUrl,
    SUPPORT_CREDENTIALS_FILE: file,
    SUPPORT_STUDIO_ROLE: studioRole,
    SUPPORT_MODEL_BASE_URL: model.url,
    SUPPORT_POLICY_APPROVAL_FILE: policyApprovalFile,
    OPENAI_API_KEY: 'synthetic-model-key',
  };
  const { mastra, environment } = await withRuntimeEnvironment(overrides, async original => {
    const { mastra } = (await import(
      `../../src/mastra/index.ts?fixture=${randomBytes(6).toString('hex')}`
    )) as typeof import('../../src/mastra/index.ts');
    return { mastra, environment: { ...original, ...overrides } };
  });
  const selectPort = () => 43000 + Math.floor(Math.random() * 10000);
  let port = selectPort();
  const base = () => `http://127.0.0.1:${port}`;
  const store = mastra.getStorage();
  assert.ok(store, 'The Mastra store is configured');
  const supportKnowledge = mastra.getKnowledge('support');
  const pages: KnowledgePage[] = [];
  let memory: Memory;
  try {
    const agentMemory = await mastra.getAgent('support').getMemory();
    assert.ok(agentMemory instanceof Memory, 'The support agent has Memory');
    memory = agentMemory;
    if (options.syntheticKnowledge !== false) {
      const pagesByScope = new Map<string, KnowledgePage>();
      for (const [index, credential] of credentials.entries()) {
        const scope = principals(credential.profile)[1]!;
        const seeded = pagesByScope.get(scope);
        if (seeded) {
          pages.push(seeded);
          continue;
        }
        const { page } = await supportKnowledge.upsertPage({
          scope,
          path: 'cases/synthetic',
          name: `SYNTHETIC case ${index}`,
          body: `SYNTHETIC_PRIVATE_${index}`,
          author: 'synthetic-fixture',
        });
        await supportKnowledge.addNote({
          scope,
          path: 'cases/synthetic',
          text: `SYNTHETIC_NOTE_${index}`,
          author: 'synthetic-fixture',
        });
        await supportKnowledge.upsertPage({
          scope: `docs:${credential.profile.tenantId}`,
          path: 'manual',
          name: 'SYNTHETIC documentation',
          body: `SYNTHETIC_DOC_${credential.profile.tenantId}`,
          author: 'synthetic-fixture',
        });
        pagesByScope.set(scope, page);
        pages.push(page);
      }
      const tenants = new Set(credentials.map(credential => credential.profile.tenantId));
      if (tenants.has('north'))
        await supportKnowledge.addNote({
          scope: 'docs:north',
          path: 'manual',
          text: 'SYNTHETIC_FOREIGN_STAMP_1',
          stamps: ['customer:north:store-2'],
          author: 'synthetic-fixture',
        });
      for (const tenant of tenants) {
        await approvePolicyRevision(
          policyApprovalFile,
          `tenant:${tenant}#policies/safe-changes`,
          syntheticSafetyPolicy,
        );
        await supportKnowledge.upsertPage({
          scope: `tenant:${tenant}`,
          path: 'policies/safe-changes',
          name: 'Synthetic safety policy',
          body: syntheticSafetyPolicy,
          author: 'synthetic-fixture',
        });
      }
    }
  } catch (error) {
    await store.close().catch(() => undefined);
    throw error;
  }
  let child: RuntimeProcess | undefined;
  let output = '';
  let activeCredentialFile: string | undefined;
  function launchEnvironment(generated: boolean | 'empty') {
    const launch: NodeJS.ProcessEnv = {
      ...environment,
      PORT: String(port),
      ...(options.example ? { SUPPORT_EXAMPLE: options.example } : {}),
    };
    if (generated === 'empty') launch.SUPPORT_CREDENTIALS_FILE = '';
    else if (generated) delete launch.SUPPORT_CREDENTIALS_FILE;
    if (generated && options.studioRole === undefined) delete launch.SUPPORT_STUDIO_ROLE;
    if (options.preload)
      launch.NODE_OPTIONS = [launch.NODE_OPTIONS, `--import=${options.preload.href}`].filter(Boolean).join(' ');
    return launch;
  }
  async function request(path: string, owner = 0, options: RequestInit = {}) {
    const headers = new Headers({
      authorization: `Bearer ${credentials[owner]!.token}`,
      'content-type': 'application/json',
    });
    new Headers(options.headers).forEach((value, key) => headers.set(key, value));
    return fixtureFetch(`${base()}/api${path}`, { ...options, headers });
  }
  async function start() {
    assert.equal(child, undefined, 'Stop the existing runtime before starting it again');
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (await launch()) return;
      } catch (error) {
        try {
          await stop();
        } catch (cleanupError) {
          throw new AggregateError([error, cleanupError], 'Dev startup and cleanup failed', { cause: error });
        }
        throw error;
      }
      await stop();
      port = selectPort();
    }
    throw new Error(`Dev could not bind after three port collisions: ${output}`);
  }
  async function launch() {
    output = '';
    activeCredentialFile = undefined;
    const launcher = spawn('npm', ['run', 'dev'], {
      cwd: template,
      detached: true,
      env: launchEnvironment(options.generatedCredentials ?? false),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const running: RuntimeProcess = { launcher, closed: false, bound: false };
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
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const exited = launcher.exitCode !== null || launcher.signalCode !== null;
      if (!running.bound) {
        const plain = output.replace(/\x1b\[[0-9;]*m/gu, '');
        running.bound = plain
          .split('\n')
          .some(line => line.includes('API:') && line.split('API:').at(-1)?.trim() === `${base()}/api`);
        if (!running.bound && (!exited || running.closed) && /\bEADDRINUSE\b/u.test(plain)) return false;
      }
      if (running.error) throw running.error;
      if (running.closed) throw new Error(`Dev exited: ${output}`);
      if (exited) {
        // The launcher may exit before its output pipes close.
        await setTimeout(Math.max(0, Math.min(200, deadline - Date.now())));
        continue;
      }
      if (options.generatedCredentials && !activeCredentialFile) {
        const match = /Local Studio credentials are available privately in (.+?)\. Open/u.exec(output);
        if (match) {
          const generated = JSON.parse(await readFile(match[1]!, 'utf8'));
          for (const credential of credentials) {
            const entry = generated.find(
              (entry: { profile: { id: string } }) => entry.profile.id === credential.profile.id,
            );
            if (entry) credential.token = entry.token;
            else if (credential === credentials[0]) throw new Error('Generated readiness credential is missing');
          }
          activeCredentialFile = match[1]!;
        }
      }
      if (running.bound && (!options.generatedCredentials || activeCredentialFile)) {
        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        const signal = AbortSignal.timeout(Math.min(1000, remaining));
        const response = await request('/knowledge', 0, { signal }).catch(error => {
          if (!(error instanceof TypeError) && !signal.aborted) throw error;
          return undefined;
        });
        if (response?.status === 200) {
          await response.body?.cancel();
          return true;
        }
        if (response && response.status !== 503) {
          const diagnostic = await response.text().catch(() => 'Unable to read readiness response');
          throw new Error(`Startup HTTP ${response.status}: ${diagnostic}\n${output}`);
        }
        await response?.body?.cancel().catch(() => undefined);
      }
      await setTimeout(Math.max(0, Math.min(200, deadline - Date.now())));
    }
    throw new Error(`Dev did not boot: ${output}`);
  }
  async function duplicateStart() {
    let duplicateOutput = '';
    const duplicate = spawn('npm', ['run', 'dev'], {
      cwd: template,
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
        if (running.closed && (!running.bound || (await portReleased()))) return true;
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
    mastra,
    storage: store,
    memory,
    supportKnowledge,
    directory,
    model,
    credentials,
    expired,
    pages,
    get base() {
      return base();
    },
    databaseUrl,
    policyApprovalFile,
    approvePolicy: (ref: string, body: string) => approvePolicyRevision(policyApprovalFile, ref, body),
    withEnvironment: <T>(operation: () => Promise<T>) => withRuntimeEnvironment(overrides, operation),
    request,
    start,
    stop,
    duplicateStart,
    credentialFile: () => activeCredentialFile,
    injectedCredentialFile: file,
    output: () => output,
    async close() {
      const errors: unknown[] = [];
      for (const cleanup of [
        stop,
        () => store.close(),
        () => model.close(),
        () => rm(directory, { recursive: true, force: true }),
      ]) {
        try {
          await cleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length) throw new AggregateError(errors, 'Runtime fixture cleanup failed', { cause: errors[0] });
    },
  };
}

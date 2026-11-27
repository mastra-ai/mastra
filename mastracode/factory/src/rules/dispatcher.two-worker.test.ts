import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { autoStartingBoards, commitDecisions, createLifecycleTestRegistry } from '../boards/test-utils.js';
import { observeSessionRunEnd, waitForSessionRunAudit } from '../session/run-audit.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDecisionDispatcher } from './dispatcher.js';
import { FactoryTransitionService } from './transition-service.js';
import { createFileSession, readThread, TWO_WORKER_DIR_ENV, TWO_WORKER_PROJECT_ID } from './two-worker.fixture.js';

const FACTORY_DIR = fileURLToPath(new URL('../..', import.meta.url));
const VITEST = join(FACTORY_DIR, 'node_modules', 'vitest', 'vitest.mjs');

async function seedSharedStorage(dir: string) {
  const seed = await createFactoryStorageForTests(
    new LibSQLFactoryStorage({ id: 'factory-two-worker', url: `file:${join(dir, 'factory.db')}` }),
  );
  const storage = seed.workItems;
  const item = (
    await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: TWO_WORKER_PROJECT_ID,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
        title: 'Fix issue',
        stages: ['intake'],
        sessions: {},
        metadata: { authorTrusted: true },
      },
    })
  ).item;
  await commitDecisions(storage, {
    factoryProjectId: TWO_WORKER_PROJECT_ID,
    workItemId: item.id,
    stage: 'execute',
    decisions: [{ type: 'invokeSkill', role: 'work', skillName: 'understand-issue', idempotencyKey: 'build' }],
  });
  // A person started the card, so its run needs no approval.
  const moved = (await storage.get({ orgId: 'org-1', id: item.id }))!;
  await storage.commitTransition({
    orgId: 'org-1',
    factoryProjectId: TWO_WORKER_PROJECT_ID,
    workItemId: item.id,
    expectedRevision: moved.revision,
    destinationStage: moved.stages[0]!,
    actorId: 'user-1',
    ingress: { identity: 'arm', transitionId: 'arm' },
    causalChain: [],
    evaluation: { outcome: 'accepted', decisions: [] },
    autonomy: 'arm',
  });
  const prepared = await storage.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: TWO_WORKER_PROJECT_ID,
    workItem: {
      id: item.id,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
        title: 'Fix issue',
        stages: ['execute'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId: 'session-1', branch: 'factory/issue-1', threadId: 'thread-1' },
    resourceId: TWO_WORKER_PROJECT_ID,
    kickoffKey: `kickoff-${item.id}`,
    kickoffMessage: null,
  });
  await storage.markPendingStart(prepared.binding.id, 'sent');

  // The session's source-control record, which holds the sandbox handle.
  const sourceControl = seed.sourceControl.forIntegration('github');
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '123',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '456', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const link = await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
  });
  await sourceControl.sessions.create({
    sessionId: 'session-1',
    projectRepositoryId: link.id,
    factoryProjectId: project.id,
    orgId: 'org-1',
    userId: 'user-1',
    branch: 'factory/issue-1',
    baseBranch: 'main',
  });
  return { seed, sourceControl };
}

/** Started worker processes; each is killed after its test, however the test ends. */
const workers = new Set<() => Promise<void>>();

/** Starts worker A in its own process and waits until its phase run is open on the ledger. */
async function startWorkerA(dir: string) {
  const child = spawn(
    process.execPath,
    [VITEST, 'run', '--pool=threads', '--reporter=dot', 'src/rules/two-worker.child.test.ts'],
    { cwd: FACTORY_DIR, env: { ...process.env, [TWO_WORKER_DIR_ENV]: dir }, detached: true, stdio: 'pipe' },
  );
  let output = '';
  child.stdout.on('data', chunk => (output += String(chunk)));
  child.stderr.on('data', chunk => (output += String(chunk)));
  let spawnError: Error | undefined;
  // A process the OS refused to start emits `error` and may never emit `exit`.
  const exited = new Promise<void>(resolve => {
    child.once('exit', () => resolve());
    child.once('error', error => {
      spawnError = error;
      resolve();
    });
  });
  /** SIGKILL: no shutdown hook runs, so the run is left exactly as a crashed worker leaves it. */
  const kill = async () => {
    workers.delete(kill);
    if (spawnError || child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    process.kill(-child.pid!, 'SIGKILL');
    await exited;
  };
  workers.add(kill);
  const deadline = Date.now() + 90_000;
  while (!existsSync(join(dir, 'worker-a.ready'))) {
    if (spawnError) throw new Error(`Worker A could not be started: ${spawnError.message}`);
    if (child.exitCode !== null || Date.now() > deadline) {
      throw new Error(`Worker A never opened its run:\n${output}`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return { kill };
}

describe('two Factory workers sharing storage', () => {
  let dir: string | undefined;
  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all([...workers].map(kill => kill()));
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it(
    'resumes a phase run on the second worker, keeping the sandbox handle, when the first is killed mid-run',
    {
      timeout: 180_000,
    },
    async () => {
      dir = await mkdtemp(join(tmpdir(), 'factory-two-worker-'));
      const { seed, sourceControl } = await seedSharedStorage(dir);

      const workerA = await startWorkerA(dir);
      const [claimed] = await seed.workItems.listDeferredDecisions('org-1', TWO_WORKER_PROJECT_ID);
      expect(claimed).toMatchObject({ status: 'leased', leaseOwner: 'worker-a' });
      expect(readThread(dir).messages.map(message => message.id)).toEqual([claimed!.id]);
      await workerA.kill();

      // Past the decision's lease and the run's heartbeat window: nothing renews either once A is gone.
      vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 120_000 });
      const workerB = createFileSession(dir, { runsFinish: true });
      observeSessionRunEnd(workerB.session as never, { audit: seed.audit, openRuns: seed.openRuns });
      const dispatcher = new FactoryDecisionDispatcher({
        controller: workerB.controller as never,
        boards: autoStartingBoards(),
        transitionService: new FactoryTransitionService({
          storage: seed.workItems,
          configVersion: 'rules-v1',
          boards: createLifecycleTestRegistry(),
        }),
        storage: seed.workItems,
        audit: seed.audit,
        openRuns: seed.openRuns,
        ownerId: 'worker-b',
      });
      await dispatcher.runOnce(new Date());
      await waitForSessionRunAudit(workerB.session);

      // B continues the session A left, instead of restarting the skill or calling the run done.
      expect(workerB.sent).toEqual([
        expect.objectContaining({
          id: expect.stringMatching(new RegExp(`^${claimed!.id}:resume:\\d+$`)),
          contents: expect.stringContaining('Your previous run was interrupted'),
        }),
      ]);
      expect((await seed.workItems.listDeferredDecisions('org-1', TWO_WORKER_PROJECT_ID))[0]).toMatchObject({
        status: 'succeeded',
      });
      const ended = (await seed.audit.list({ orgId: 'org-1' })).events
        .filter(event => event.action === 'factory.run.ended')
        .map(event => [event.metadata?.kickoffId, event.metadata?.reason]);
      expect(ended).toEqual(
        expect.arrayContaining([
          [claimed!.id, 'aborted'],
          [workerB.sent[0]!.id, 'complete'],
        ]),
      );
      await expect(seed.openRuns.listByThread('thread-1')).resolves.toEqual([]);
      // B resumed A's session, and the handle to the VM A started outlived A, so that session
      // reattaches to it rather than starting another. (The file-backed session here does not boot
      // a sandbox; attaching it is the session loader's part, covered by its own tests.)
      await expect(sourceControl.sessions.getBySessionId('session-1')).resolves.toMatchObject({
        sandboxId: 'vm-started-by-worker-a',
      });
    },
  );
});

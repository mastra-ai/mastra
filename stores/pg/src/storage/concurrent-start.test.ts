import { fork } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '.';

const connectionString = process.env.WORKFLOW_START_TEST_DATABASE_URL;
const schemaName = `start_${randomUUID().replaceAll('-', '')}`;
const fixturePath = fileURLToPath(new URL('./__fixtures__/workflow-start-process.mjs', import.meta.url));

// Run against a dedicated PostgreSQL test database. Child processes consume the built public
// packages, so build @mastra/core and @mastra/pg before this integration test.
describe.skipIf(!connectionString).each(['default', 'evented'])(
  'workflow reliability across PostgreSQL processes (%s)',
  engine => {
    let storage: PostgresStore;
    beforeAll(async () => {
      storage = new PostgresStore({ id: 'start-proof', connectionString: connectionString!, schemaName });
      await storage.init();
    }, 60000);
    afterAll(async () => {
      await storage?.close();
    });

    function replica(runId: string, mode = 'start') {
      const child = fork(fixturePath, [runId, mode, engine], {
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        env: {
          ...process.env,
          WORKFLOW_START_TEST_DATABASE_URL: connectionString,
          WORKFLOW_START_TEST_SCHEMA: schemaName,
        },
      });
      const messages: any[] = [];
      let stderr = '';
      child.stderr?.on('data', chunk => {
        stderr += chunk;
      });
      const waiters = new Set<() => void>();
      child.on('message', message => {
        messages.push(message);
        for (const wake of waiters) wake();
      });
      const exit = new Promise<number | null>((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', code => {
          resolve(code);
          for (const wake of waiters) wake();
        });
      });
      function waitFor(predicate: (message: any) => boolean): Promise<any> {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            waiters.delete(check);
            reject(new Error(`Child timed out: ${stderr}`));
          }, 20000);
          const check = () => {
            const match = messages.find(predicate);
            if (match) {
              clearTimeout(timer);
              waiters.delete(check);
              resolve(match);
            } else if (child.exitCode !== null) {
              clearTimeout(timer);
              waiters.delete(check);
              reject(new Error(`Child exited ${child.exitCode}: ${stderr}`));
            }
          };
          waiters.add(check);
          check();
        });
      }
      return { child, messages, waitFor, exit };
    }

    it('executes once when two processes create and start the same run simultaneously', async () => {
      const runId = randomUUID();
      const replicas = [replica(runId), replica(runId)];
      try {
        await Promise.all(replicas.map(p => p.waitFor(m => m.type === 'ready')));
        replicas.forEach(p => p.child.send('start'));
        const decisions = await Promise.all(
          replicas.map(p => p.waitFor(m => m.type === 'entered' || m.type === 'error')),
        );
        replicas.filter(p => p.child.connected).forEach(p => p.child.send('release'));
        const terminal = await Promise.all(
          replicas.map(p => p.waitFor(m => m.type === 'result' || m.type === 'error')),
        );
        expect(decisions.filter(m => m.type === 'entered')).toHaveLength(1);
        expect(terminal.find(m => m.type === 'error')).toMatchObject({ id: 'WORKFLOW_START_ALREADY_CLAIMED' });
        expect(terminal.find(m => m.type === 'result')).toMatchObject({
          result: { status: 'success', result: { item: 'widget', total: 7, tenant: 'one' } },
        });
        const snapshot = await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({
          workflowName: 'process-start',
          runId,
        });
        expect(snapshot?.status).toBe('success');
        await Promise.all(replicas.map(p => p.exit));
      } finally {
        replicas.forEach(p => p.child.kill());
      }
    }, 60000);

    it('restarts in a fresh process after the claiming process exits before executing a step', async () => {
      const runId = randomUUID();
      const crashing = replica(runId, 'crash');
      let recovering: ReturnType<typeof replica> | undefined;
      try {
        await crashing.waitFor(m => m.type === 'ready');
        crashing.child.send('start');
        expect(await crashing.exit).toBe(23);
        expect(crashing.messages.some(m => m.type === 'entered')).toBe(false);
        const snapshot = await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({
          workflowName: 'process-start',
          runId,
        });
        expect(snapshot).toMatchObject({
          status: 'running',
          context: { input: { item: 'widget' } },
          value: { total: 7 },
          requestContext: { tenant: 'one' },
        });
        // A create request that read before the claim may arrive late. Its conditional insert
        // must preserve the running checkpoint, including the original tenant and input.
        const workflowsStore = (await storage.getStore('workflows'))!;
        await workflowsStore.persistWorkflowSnapshot({
          workflowName: 'process-start',
          runId,
          resourceId: 'late-creator',
          snapshot: { ...snapshot!, status: 'pending', context: {} as any },
          createOnly: true,
        });
        expect(await workflowsStore.loadWorkflowSnapshot({ workflowName: 'process-start', runId })).toEqual(snapshot);
        recovering = replica(runId, 'restart');
        await recovering.waitFor(m => m.type === 'ready');
        recovering.child.send('start');
        expect(await recovering.waitFor(m => m.type === 'result' || m.type === 'error')).toMatchObject({
          type: 'result',
          result: { status: 'success', result: { item: 'widget', total: 7, tenant: 'one' } },
        });
        expect(recovering.messages.filter(m => m.type === 'entered')).toHaveLength(1);
        await recovering.exit;
      } finally {
        crashing.child.kill();
        recovering?.child.kill();
      }
    }, 60000);

    it('resumes the outer workflow from a nested tool callback after the first process exits', async () => {
      const runId = randomUUID();
      const starting = replica(runId, 'callback-start');
      let resuming: ReturnType<typeof replica> | undefined;
      try {
        await starting.waitFor(m => m.type === 'ready');
        starting.child.send('start');
        expect(await starting.waitFor(m => m.type === 'result' || m.type === 'error')).toMatchObject({
          type: 'result',
          result: { status: 'suspended' },
        });
        const root = await starting.waitFor(m => m.type === 'root');
        expect(root.rootRun).toEqual({ workflowId: 'callback-root', runId });
        expect(await starting.exit).toBe(0);
        const workflowsStore = (await storage.getStore('workflows'))!;
        expect(
          await workflowsStore.loadWorkflowSnapshot({
            workflowName: root.rootRun.workflowId,
            runId: root.rootRun.runId,
          }),
        ).toMatchObject({ status: 'suspended', rootRun: root.rootRun });
        resuming = replica(root.rootRun.runId, 'callback-resume');
        await resuming.waitFor(m => m.type === 'ready');
        resuming.child.send('start');
        expect(await resuming.waitFor(m => m.type === 'result' || m.type === 'error')).toMatchObject({
          type: 'result',
          result: { status: 'success', result: { item: 'widget:approved' } },
        });
        expect(await resuming.waitFor(m => m.type === 'root')).toMatchObject({ rootRun: root.rootRun });
        expect(await resuming.exit).toBe(0);
        expect(
          await workflowsStore.loadWorkflowSnapshot({ workflowName: root.rootRun.workflowId, runId }),
        ).toMatchObject({ status: 'success', rootRun: root.rootRun });
      } finally {
        starting.child.kill();
        resuming?.child.kill();
      }
    }, 60000);
  },
);

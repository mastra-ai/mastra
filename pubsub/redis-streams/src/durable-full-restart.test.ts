import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PostgresStore } from '@mastra/pg';
import { createClient } from 'redis';
import { describe, expect, it } from 'vitest';
import { agentThreadStreamRuntime } from '../../../packages/core/src/agent/thread-stream-runtime';
import { killProcess, spawnFixture, waitFor, waitForLine } from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

const TOOL_MS = 6_000;
const TOOL_CALLS = 3;
const RESOURCE_ID = 'full-restart-resource';

/**
 * COR-1497: on a split deploy (API with MASTRA_WORKERS=false plus a dedicated
 * worker) with `recovery.durableAgents: 'auto'`, the API and the worker die
 * together mid-tool and both restart. The API's boot recovery must leave the
 * run progressing to a terminal state, never parked `running` behind a lease
 * the API keeps renewing, and must release the thread for the next run.
 */
describe('durable agent run recovered after the API and worker die together (COR-1497)', () => {
  it.each([
    { signal: 'SIGKILL', crashes: 1 },
    { signal: 'SIGTERM', crashes: 1 },
    { signal: 'SIGKILL', crashes: 2 },
  ] as const)(
    '$signal both mid-tool x$crashes, restart both: the recovered run finishes and frees its thread',
    async ({ signal, crashes }) => {
      const suffix = randomUUID().replaceAll('-', '');
      const schemaName = `full_restart_${suffix}`;
      const prefix = `full-restart-${suffix}`;
      const runId = randomUUID();
      const threadId = `thread-${suffix}`;
      const url = process.env.REDIS_URL ?? 'redis://localhost:6381';
      const connectionString =
        process.env.POSTGRES_CONNECTION_STRING ?? 'postgres://postgres:postgres@localhost:5436/postgres';
      const storage = new PostgresStore({ id: suffix, connectionString, schemaName });
      const redis = createClient({ url });
      const observer = new RedisStreamsPubSub({ url, keyPrefix: prefix, blockMs: 100 });
      const processes: ManagedProcess[] = [];
      const launch = (role: 'api' | 'worker' | 'followup', env: Record<string, string> = {}) => {
        const child = spawnFixture({
          entry: resolve(__dirname, '../test-fixtures/durable-full-restart.entry.mjs'),
          label: `${role}${env.RESTART_BOOT ? `-${env.RESTART_BOOT}` : ''}`,
          binary: process.execPath,
          env: {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx`,
            RESTART_ROLE: role,
            RESTART_SCHEMA: schemaName,
            RESTART_PREFIX: prefix,
            RESTART_RUN_ID: runId,
            RESTART_THREAD: threadId,
            RESTART_TOOL_MS: String(TOOL_MS),
            RESTART_TOOL_CALLS: String(TOOL_CALLS),
            POSTGRES_CONNECTION_STRING: connectionString,
            REDIS_URL: url,
            MASTRA_WORKERS: role === 'worker' ? 'orchestration' : 'false',
            ...(process.env.RESTART_LOG_LEVEL ? { RESTART_LOG_LEVEL: process.env.RESTART_LOG_LEVEL } : {}),
            ...env,
          },
        });
        processes.push(child);
        return child;
      };
      const stop = async (child: ManagedProcess) => {
        if (signal === 'SIGKILL') return killProcess(child, 'SIGKILL');
        child.proc.kill('SIGTERM');
        await waitForLine(child, 'shutdown-completed', 60_000);
      };
      await storage.init();
      await redis.connect();
      try {
        await storage.db.none(`CREATE TABLE "${schemaName}".tool_executions (
          id SERIAL PRIMARY KEY, run_id TEXT NOT NULL, tool_call_id TEXT NOT NULL, role TEXT NOT NULL,
          pid INTEGER NOT NULL, completed BOOLEAN NOT NULL DEFAULT false
        )`);
        const workflows = (await storage.getStore('workflows'))!;
        let terminal: { type: string; data: unknown } | undefined;
        await observer.subscribe(
          'workflows-finish',
          async (event, ack) => {
            if (
              event.runId === runId &&
              (event.type === 'workflow.end' || event.type === 'workflow.fail' || event.type === 'workflow.cancel')
            ) {
              terminal = { type: event.type, data: event.data };
            }
            await ack?.();
          },
          { startFrom: 'latest' },
        );

        const worker = launch('worker');
        await waitForLine(worker, 'full-restart-ready');
        const api = launch('api');
        await waitForLine(worker, 'tool-entered:sleep-1', 60_000);
        expect((await workflows.getRunOwnership({ runId }))?.live).toBe(true);

        // Both die together mid-tool, as on a stop-then-up redeploy. With
        // `crashes: 2` the recovered run is killed again mid-tool, so the second
        // boot recovery must still find its snapshot.
        let live = [api, worker];
        for (let crash = 1; crash <= crashes; crash++) {
          await Promise.all(live.map(stop));
          const restartedWorker = launch('worker');
          const restartedApi = launch('api', { RESTART_BOOT: 'recover' });
          await Promise.all([
            waitForLine(restartedWorker, 'full-restart-ready'),
            waitForLine(restartedApi, 'full-restart-ready'),
          ]);
          live = [restartedApi, restartedWorker];
          if (crash < crashes) await waitForLine(restartedWorker, `tool-entered:sleep-${crash + 1}`, 90_000);
        }

        // Allow for an expired lease's takeover plus the remaining tools.
        await waitFor(async () => terminal !== undefined, 150_000).catch(async error => {
          const owner = await workflows.getRunOwnership({ runId });
          const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'durable-agentic-loop', runId });
          throw new Error(
            `run never settled; owner=${JSON.stringify(owner)} snapshotStatus=${snapshot?.status ?? 'missing'}`,
            { cause: error },
          );
        });
        expect(terminal?.type).toBe('workflow.end');
        expect(JSON.stringify(terminal?.data)).toContain('All sleeps completed.');
        await waitFor(async () => !(await workflows.getRunOwnership({ runId }))?.live, 30_000);

        const completed = await storage.db.manyOrNone(
          `SELECT DISTINCT tool_call_id FROM "${schemaName}".tool_executions WHERE run_id = $1 AND completed`,
          [runId],
        );
        expect(completed.map(row => row.tool_call_id).sort()).toEqual(
          Array.from({ length: TOOL_CALLS }, (_, i) => `sleep-${i}`),
        );

        // The settled run releases its thread, not just its run-owner lease.
        await waitFor(
          async () => !(await agentThreadStreamRuntime.isRunHoldingThreadLease(observer, runId, threadId, RESOURCE_ID)),
          30_000,
        );
        // A second run on the same thread (Doctor re-diagnosing a deploy) is admitted.
        const countCompleted = async () =>
          Number((await storage.db.one(`SELECT count(*) FROM "${schemaName}".tool_executions WHERE completed`)).count);
        const completedBefore = await countCompleted();
        const followup = launch('followup', { RESTART_FOLLOWUP_RUN_ID: randomUUID() });
        await waitFor(async () => /followup-(completed|rejected):/.test(followup.stdout), 60_000);
        expect(followup.stdout).not.toContain('AgentThreadLeaseConflictError');
        expect(followup.stdout).toContain('followup-completed:All sleeps completed.');
        // It does its own work rather than answering from the first run's history.
        expect(await countCompleted()).toBeGreaterThan(completedBefore);
      } catch (error) {
        throw new Error(processes.map(child => `[${child.label}]\n${child.stdout}\n${child.stderr}`).join('\n'), {
          cause: error,
        });
      } finally {
        await Promise.all(processes.map(child => killProcess(child, 'SIGKILL')));
        await observer.close();
        await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await storage.close();
        const keys = await redis.keys(`${prefix}:*`);
        if (keys.length) await redis.del(keys);
        await redis.quit();
      }
    },
    300_000,
  );
});

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PostgresStore } from '@mastra/pg';
import { createClient } from 'redis';
import { describe, expect, it } from 'vitest';
import { AGENT_LEASE_TTL_MS } from '../../../packages/core/src/agent/run-ownership';
import { agentThreadStreamRuntime } from '../../../packages/core/src/agent/thread-stream-runtime';
import { killProcess, spawnFixture, waitFor, waitForLine } from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

describe('healthy durable workers survive API loss (COR-1490)', () => {
  it.each([
    { signal: 'SIGTERM', local: false, thread: false, scenario: 'remote workers complete after API SIGTERM' },
    { signal: 'SIGKILL', local: false, thread: false, scenario: 'remote workers complete after API SIGKILL' },
    { signal: 'SIGTERM', local: false, thread: true, scenario: 'thread accepts the next message after API SIGTERM' },
    { signal: 'SIGKILL', local: false, thread: true, scenario: 'thread accepts the next message after API SIGKILL' },
    { signal: 'SIGKILL', local: false, thread: false, scenario: 'remote abort reaches workers after API loss' },
    {
      signal: 'SIGKILL',
      local: false,
      thread: false,
      scenario: 'worker shutdown leaves interrupted deliveries retryable',
    },
    {
      signal: 'SIGTERM',
      local: true,
      thread: false,
      scenario: 'single-process Redis shutdown lets ownership expire without transfer',
    },
  ] as const)(
    '$signal, thread=$thread, local=$local: $scenario',
    async ({ signal, local, thread, scenario }) => {
      const abort = scenario === 'remote abort reaches workers after API loss';
      const workerShutdown = scenario === 'worker shutdown leaves interrupted deliveries retryable';
      const suffix = randomUUID().replaceAll('-', '');
      const schemaName = `api_loss_${suffix}`;
      const prefix = `api-loss-${suffix}`;
      const runId = randomUUID();
      const url = process.env.REDIS_URL ?? 'redis://localhost:6381';
      const connectionString =
        process.env.POSTGRES_CONNECTION_STRING ?? 'postgres://postgres:postgres@localhost:5436/postgres';
      const storage = new PostgresStore({ id: suffix, connectionString, schemaName });
      const redis = createClient({ url });
      const observer = new RedisStreamsPubSub({ url, keyPrefix: prefix, blockMs: 100 });
      const processes: ManagedProcess[] = [];
      const launch = (role: 'api' | 'worker' | 'local' | 'followup' | 'aborter') => {
        const child = spawnFixture({
          entry: resolve(__dirname, '../test-fixtures/durable-api-loss.entry.mjs'),
          label: role,
          binary: process.execPath,
          env: {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx`,
            TAKEOVER_ROLE: role,
            TAKEOVER_SCHEMA: schemaName,
            TAKEOVER_PREFIX: prefix,
            TAKEOVER_RUN_ID: runId,
            ...(thread ? { TAKEOVER_THREAD: `thread-${suffix}` } : {}),
            POSTGRES_CONNECTION_STRING: connectionString,
            REDIS_URL: url,
            MASTRA_WORKERS: role === 'api' ? 'false' : 'orchestration',
          },
        });
        processes.push(child);
        return child;
      };
      await storage.init();
      await redis.connect();
      try {
        await storage.db.none(`CREATE TABLE "${schemaName}".tool_executions (
          id SERIAL PRIMARY KEY, run_id TEXT NOT NULL, tool_call_id TEXT NOT NULL, completed BOOLEAN NOT NULL DEFAULT false
        )`);
        const workflows = await storage.getStore('workflows');
        let terminal: { type: string; data: unknown } | undefined;
        await observer.subscribe(
          'workflows-finish',
          async (event, ack) => {
            if (event.runId === runId) terminal = { type: event.type, data: event.data };
            await ack?.();
          },
          { startFrom: 'latest' },
        );
        const worker = launch(local ? 'local' : 'worker');
        await waitForLine(worker, 'api-loss-ready');
        const api = local ? worker : launch('api');
        await waitForLine(worker, 'tool-entered:operation-3');
        const initial = await workflows!.getRunOwnership({ runId });
        expect(initial?.live).toBe(true);
        expect(initial?.leaseExpiresAt).not.toBeNull();
        if (workerShutdown) {
          const survivor = launch('worker');
          await waitForLine(survivor, 'api-loss-ready');
          worker.proc.kill('SIGTERM');
          await waitForLine(worker, 'tool-aborted:operation-3');
          await waitForLine(worker, 'shutdown-completed');
          // Reclaimed tool deliveries can run serially after the step-fence TTL elapses.
          await waitFor(async () => terminal !== undefined, AGENT_LEASE_TTL_MS * 12);
          expect(terminal?.type).toBe('workflow.end');
          await waitForLine(api, 'caller-completed:All four operations completed.');
          const completed = await storage.db.manyOrNone(
            `SELECT tool_call_id FROM "${schemaName}".tool_executions WHERE run_id = $1 AND completed`,
            [runId],
          );
          expect(completed).toHaveLength(4);
          expect(new Set(completed.map(row => row.tool_call_id)).size).toBe(4);
          return;
        }
        if (signal === 'SIGTERM') {
          api.proc.kill(signal);
          await waitForLine(api, 'shutdown-completed');
        } else {
          await killProcess(api, signal);
        }
        if (local) {
          const detached = await workflows!.getRunOwnership({ runId });
          expect(detached?.ownerId).toBe(initial?.ownerId);
          expect(detached?.generation).toBe(initial?.generation);
          await waitFor(async () => !(await workflows!.getRunOwnership({ runId }))?.live, AGENT_LEASE_TTL_MS * 2);
          return;
        }
        // Sample after the coordinator's old lease has expired, while the worker still runs tools.
        await new Promise(resolve => setTimeout(resolve, AGENT_LEASE_TTL_MS + 1000));
        const during = await workflows!.getRunOwnership({ runId });
        expect(during?.ownerId).toBe(initial?.ownerId);
        expect(during?.generation).toBe(initial?.generation);
        expect(during?.live).toBe(true);
        expect(during!.leaseExpiresAt!.getTime()).toBeGreaterThan(initial!.leaseExpiresAt!.getTime());
        if (thread) {
          expect(
            await agentThreadStreamRuntime.isRunHoldingThreadLease(
              observer,
              runId,
              `thread-${suffix}`,
              'api-loss-resource',
            ),
          ).toBe(true);
        }
        if (abort) {
          const aborter = launch('aborter');
          await waitForLine(aborter, 'abort-requested');
          await waitForLine(worker, 'tool-aborted:operation-3');
          await waitFor(async () => terminal !== undefined, AGENT_LEASE_TTL_MS * 3);
          await waitFor(async () => (await workflows!.getRunOwnership({ runId }))?.leaseExpiresAt === null);
          return;
        }
        await waitFor(async () => terminal !== undefined, AGENT_LEASE_TTL_MS * 3);
        expect(terminal?.type).toBe('workflow.end');
        expect(JSON.stringify(terminal?.data)).toContain('All four operations completed.');
        const rows = await storage.db.manyOrNone(
          `SELECT tool_call_id, completed FROM "${schemaName}".tool_executions WHERE run_id = $1`,
          [runId],
        );
        expect(rows).toHaveLength(4);
        expect(new Set(rows.map(row => row.tool_call_id)).size).toBe(4);
        expect(rows.every(row => row.completed)).toBe(true);
        await waitFor(async () => (await workflows!.getRunOwnership({ runId }))?.leaseExpiresAt === null);
        expect(worker.stderr).not.toMatch(/DurableExecutionFenceError|stopped without writing/);
        if (thread) {
          const followup = launch('followup');
          await waitForLine(followup, 'followup-accepted:wake:');
          expect(followup.stdout).not.toContain(`followup-accepted:wake:${runId}`);
          await waitForLine(followup, 'followup-completed:All four operations completed.');
        }
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
    240_000,
  );
});

describe('durable agent worker takeover with a surviving API (COR-1469)', () => {
  it.each([
    ['SIGTERM', false],
    ['SIGKILL', false],
    ['SIGTERM', true],
    ['SIGKILL', true],
  ] as const)(
    'finishes the original caller after %s, already-running survivor: %s',
    async (signal, warmSurvivor) => {
      const suffix = randomUUID().replaceAll('-', '');
      const schemaName = `takeover_${suffix}`;
      const prefix = `takeover-${suffix}`;
      const url = process.env.REDIS_URL ?? 'redis://localhost:6381';
      const connectionString =
        process.env.POSTGRES_CONNECTION_STRING ?? 'postgres://postgres:postgres@localhost:5436/postgres';
      const storage = new PostgresStore({ id: suffix, connectionString, schemaName });
      const redis = createClient({ url });
      const processes: ManagedProcess[] = [];
      const launch = (role: string) => {
        const child = spawnFixture({
          entry: resolve(__dirname, '../test-fixtures/durable-takeover.entry.mjs'),
          label: role,
          binary: process.execPath,
          env: {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx`,
            TAKEOVER_ROLE: role,
            TAKEOVER_SCHEMA: schemaName,
            TAKEOVER_PREFIX: prefix,
            POSTGRES_CONNECTION_STRING: connectionString,
            REDIS_URL: url,
            MASTRA_WORKERS: role === 'api' ? 'false' : 'orchestration',
          },
        });
        processes.push(child);
        return child;
      };
      await storage.init();
      await redis.connect();
      try {
        const victim = launch('victim');
        await waitForLine(victim, 'takeover-ready');
        const api = launch('api');
        await waitForLine(victim, 'model-entered');
        // Worker-generated nested step deliveries must actually be reclaimable.
        const groups = await redis.xInfoGroups(`${prefix}:workflows`);
        expect(groups.some(group => group.pending > 0)).toBe(true);
        let survivor: ManagedProcess | undefined;
        if (warmSurvivor) {
          survivor = launch('survivor');
          await waitForLine(survivor, 'takeover-ready');
        }
        const killedAt = Date.now();
        await killProcess(victim, signal);
        if (!survivor) survivor = launch('survivor');
        await waitForLine(api, 'caller-completed:Recovered successfully', 120_000);
        expect(Date.now() - killedAt).toBeLessThan(120_000);
        expect(api.proc.exitCode).toBeNull();
        expect(survivor.stdout).toContain('model-entered');
      } catch (error) {
        throw new Error(processes.map(child => `[${child.label}]\n${child.stdout}\n${child.stderr}`).join('\n'), {
          cause: error,
        });
      } finally {
        await Promise.all(processes.map(child => killProcess(child, 'SIGKILL')));
        await storage.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await storage.close();
        const keys = await redis.keys(`${prefix}:*`);
        if (keys.length) await redis.del(keys);
        await redis.quit();
      }
    },
    155_000,
  );
});

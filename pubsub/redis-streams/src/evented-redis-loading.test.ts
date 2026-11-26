import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PostgresStore } from '@mastra/pg';
import { createClient } from 'redis';
import { describe, expect, it } from 'vitest';
import {
  killProcess,
  makeLoadingProxy,
  makeOutageProxy,
  spawnFixture,
  waitFor,
  waitForLine,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

// COR-1502 covers explicit Redis LOADING replies; COR-1655 covers a silent pause past the lease TTL.
describe('evented agent execution during Redis interruptions', () => {
  it.each(['loading', 'paused'] as const)(
    'completes after Redis recovers from %s',
    async fault => {
      const suffix = randomUUID().replaceAll('-', '');
      const schemaName = `redis_loading_${suffix}`;
      const prefix = `redis-loading-${suffix}`;
      const runId = randomUUID();
      const threadId = `thread-${suffix}`;
      const toolMs = 4_000;
      const loadingMs = 20_000;
      const realUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6381');
      const connectionString =
        process.env.POSTGRES_CONNECTION_STRING ?? 'postgres://postgres:postgres@localhost:5436/postgres';
      const secondRunId = fault === 'paused' ? randomUUID() : undefined;
      const runIds = secondRunId ? [runId, secondRunId] : [runId];
      const target = { host: realUrl.hostname, port: Number(realUrl.port || 6379) };
      const proxy = fault === 'loading' ? makeLoadingProxy(target) : makeOutageProxy(target);
      const proxyUrl = `redis://127.0.0.1:${await proxy.listening}`;
      const storage = new PostgresStore({ id: suffix, connectionString, schemaName });
      const redis = createClient({ url: realUrl.toString() });
      // Observes terminal events directly against real Redis, unaffected by the restart.
      const observer = new RedisStreamsPubSub({ url: realUrl.toString(), keyPrefix: prefix, blockMs: 100 });
      const processes: ManagedProcess[] = [];
      const launch = (role: 'api' | 'worker') => {
        const child = spawnFixture({
          entry: resolve(__dirname, '../test-fixtures/evented-redis-loading.entry.mjs'),
          label: role,
          binary: process.execPath,
          env: {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx`,
            LOADING_ROLE: role,
            LOADING_SCHEMA: schemaName,
            LOADING_PREFIX: prefix,
            LOADING_RUN_ID: runId,
            LOADING_THREAD: threadId,
            LOADING_TOOL_MS: String(toolMs),
            ...(secondRunId ? { PAUSED_SECOND_RUN_ID: secondRunId, MASTRA_AGENT_THREAD_LEASE_TTL_MS: '3000' } : {}),
            POSTGRES_CONNECTION_STRING: connectionString,
            REDIS_URL: proxyUrl,
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
        const terminal = new Map<string, { type: string; data: unknown }>();
        await observer.subscribe(
          'workflows-finish',
          async (event, ack) => {
            if (
              event.runId &&
              runIds.includes(event.runId) &&
              (event.type === 'workflow.end' || event.type === 'workflow.fail' || event.type === 'workflow.cancel')
            ) {
              terminal.set(event.runId, { type: event.type, data: event.data });
            }
            await ack?.();
          },
          { startFrom: 'latest' },
        );
        const worker = launch('worker');
        await waitForLine(worker, 'loading-ready');
        const api = launch('api');
        if ('pause' in proxy) {
          await waitFor(async () => {
            const { count } = await storage.db.one(
              `SELECT COUNT(DISTINCT run_id)::int AS count FROM "${schemaName}".tool_executions`,
            );
            return count === runIds.length;
          });
          proxy.pause();
          await new Promise(resolve => setTimeout(resolve, 6_000));
          proxy.unpause();
          for (const id of runIds) {
            await waitForLine(api, `paused-result:${id}:`, 30_000);
            expect(api.stdout).toContain(`paused-result:${id}:stop:Both operations completed.`);
          }
        } else {
          await waitForLine(worker, 'tool-entered:operation-1');
          // The tools are mid-sleep: restart Redis so the tool steps finish, publish
          // their results and renew leases while the server is still loading.
          const restartedAt = Date.now();
          const window = proxy.restart(loadingMs);
          await waitForLine(worker, 'tool-completed:operation-1', toolMs + 5_000);
          expect(Date.now() - restartedAt).toBeLessThan(loadingMs);
          await window;
          expect(proxy.loadingReplies).toBeGreaterThan(0);
          await waitForLine(api, 'caller-completed:Both operations completed.', 30_000);
        }
        await waitFor(async () => terminal.size === runIds.length, 120_000);
        const memory = await storage.getStore('memory');
        const workflows = await storage.getStore('workflows');
        for (const id of runIds) {
          expect(terminal.get(id)?.type).toBe('workflow.end');
          expect(JSON.stringify(terminal.get(id)?.data)).toContain('Both operations completed.');

          const rows = await storage.db.manyOrNone(
            `SELECT tool_call_id, completed FROM "${schemaName}".tool_executions WHERE run_id = $1`,
            [id],
          );
          expect(rows.map(row => row.tool_call_id).sort()).toEqual(['operation-0', 'operation-1']);
          expect(rows.every(row => row.completed)).toBe(true);

          const { messages } = await memory!.listMessages({ threadId: id === runId ? threadId : `${threadId}-second` });
          expect(JSON.stringify(messages)).toContain('Both operations completed.');
          await waitFor(async () => (await workflows!.getRunOwnership({ runId: id }))?.leaseExpiresAt === null);
        }
      } catch (error) {
        throw new Error(processes.map(child => `[${child.label}]\n${child.stdout}\n${child.stderr}`).join('\n'), {
          cause: error,
        });
      } finally {
        await Promise.all(processes.map(child => killProcess(child, 'SIGKILL')));
        await observer.close();
        await proxy.close();
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

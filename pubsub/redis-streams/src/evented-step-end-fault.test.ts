import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PostgresStore } from '@mastra/pg';
import { createClient } from 'redis';
import { describe, expect, it } from 'vitest';
import { killProcess, spawnFixture, waitFor, waitForLine } from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';
import { RedisStreamsPubSub } from './index';

// #29504: a tool step whose `workflow.step.end` publish fails after the tool
// finished must not run the tool again when the step is redelivered.
describe('evented tool step survives a failed step.end publish (#29504)', () => {
  it.each([
    { fault: 'throw', description: 'the publish throws a non-LOADING error' },
    { fault: 'exit', description: 'the worker dies before publishing' },
  ] as const)(
    'runs each tool once and completes when $description',
    async ({ fault }) => {
      const suffix = randomUUID().replaceAll('-', '');
      const schemaName = `step_end_fault_${suffix}`;
      const prefix = `step-end-fault-${suffix}`;
      const runId = randomUUID();
      const threadId = `thread-${suffix}`;
      const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6381';
      const connectionString =
        process.env.POSTGRES_CONNECTION_STRING ?? 'postgres://postgres:postgres@localhost:5436/postgres';
      const storage = new PostgresStore({ id: suffix, connectionString, schemaName });
      const redis = createClient({ url: redisUrl });
      const observer = new RedisStreamsPubSub({ url: redisUrl, keyPrefix: prefix, blockMs: 100 });
      const processes: ManagedProcess[] = [];
      const launch = (role: 'api' | 'worker', label: string, stepEndFault?: string) => {
        const child = spawnFixture({
          entry: resolve(__dirname, '../test-fixtures/evented-redis-loading.entry.mjs'),
          label,
          binary: process.execPath,
          env: {
            NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import tsx`,
            LOADING_ROLE: role,
            LOADING_SCHEMA: schemaName,
            LOADING_PREFIX: prefix,
            LOADING_RUN_ID: runId,
            LOADING_THREAD: threadId,
            LOADING_TOOL_MS: '500',
            ...(stepEndFault ? { LOADING_STEP_END_FAULT: stepEndFault } : {}),
            POSTGRES_CONNECTION_STRING: connectionString,
            REDIS_URL: redisUrl,
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
        const worker = launch('worker', 'worker', fault);
        await waitForLine(worker, 'loading-ready');
        const api = launch('api', 'api');
        await waitForLine(worker, 'step-end-fault', 60_000);
        if (fault === 'exit') {
          // A replacement worker reclaims the dead worker's undelivered step.
          await waitFor(async () => worker.proc.exitCode !== null, 10_000);
          await waitForLine(launch('worker', 'replacement'), 'loading-ready');
        }

        await waitFor(async () => terminal !== undefined, 150_000);
        expect(terminal?.type).toBe('workflow.end');
        expect(JSON.stringify(terminal?.data)).toContain('Both operations completed.');
        await waitForLine(api, 'caller-completed:Both operations completed.', 30_000);

        const rows = await storage.db.manyOrNone(
          `SELECT tool_call_id, completed FROM "${schemaName}".tool_executions WHERE run_id = $1`,
          [runId],
        );
        expect(rows.map(row => row.tool_call_id).sort()).toEqual(['operation-0', 'operation-1']);
        expect(rows.every(row => row.completed)).toBe(true);

        const memory = await storage.getStore('memory');
        const { messages } = await memory!.listMessages({ threadId });
        expect(JSON.stringify(messages)).toContain('Both operations completed.');
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

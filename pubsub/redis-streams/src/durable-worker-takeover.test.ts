import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PostgresStore } from '@mastra/pg';
import { createClient } from 'redis';
import { describe, expect, it } from 'vitest';
import { killProcess, spawnFixture, waitForLine } from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

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

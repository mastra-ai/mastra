import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { PostgresStore } from '@mastra/pg';
import { createClient } from 'redis';
import { describe, expect, it } from 'vitest';
import { killProcess, PACKAGE_DIR, REDIS_URL, spawnFixture, waitForLine } from '../test-fixtures/harness';

const connectionString =
  process.env.POSTGRES_CONNECTION_STRING ?? 'postgresql://postgres:postgres@localhost:5436/mastra';

describe.each(['durable', 'evented'])('%s shared publisher across servers (COR-1560)', engine => {
  for (const scenario of ['abort', 'reuse', 'resume']) {
    // COR-1565: remote evented approval runs the tool but never finishes, even with A alive.
    // Also reproduced on the prerequisite branch, 3a23fe1ac5a; do not fix its resume protocol here.
    const test = engine === 'evented' && scenario === 'resume' ? it.fails : it;
    test(`keeps lifecycle authority across servers during ${scenario}`, async () => {
      const suffix = randomUUID().replaceAll('-', '');
      const prefix = `publisher-${suffix}`;
      const schemaName = `publisher_${suffix}`;
      const runId = randomUUID();
      const llm = new LLMock({ port: 0 });
      await llm.start();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [{ id: 'lookup-0', name: 'lookup', arguments: {} }],
        },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'The answer is 42.' });
      const store = new PostgresStore({ id: 'publisher-test', connectionString, schemaName });
      await store.init();
      const redis = createClient({ url: REDIS_URL });
      await redis.connect();
      const processes: ReturnType<typeof spawnFixture>[] = [];
      try {
        const ports: number[] = [];
        for (let i = 0; i < 2; i++) {
          const child = spawnFixture({
            entry: path.join(PACKAGE_DIR, 'test-fixtures/agent-publisher.entry.ts'),
            env: {
              REDIS_URL,
              POSTGRES_CONNECTION_STRING: connectionString,
              PUBLISHER_SCHEMA: schemaName,
              PUBLISHER_PREFIX: prefix,
              PUBLISHER_RUN_ID: runId,
              PUBLISHER_ENGINE: engine,
              PUBLISHER_APPROVAL: scenario === 'resume' ? '1' : '0',
              PUBLISHER_MODEL_URL: llm.url,
            },
          });
          processes.push(child);
          await waitForLine(child, 'publisher-ready:', 30_000);
          ports.push(Number(child.stdout.match(/publisher-ready:(\d+)/)![1]));
        }
        const request = async (server: number, route: string) => {
          const response = await fetch(`http://127.0.0.1:${ports[server]}${route}`);
          if (!response.ok) throw new Error(await response.text());
          return response.json();
        };
        if (scenario === 'resume') {
          await Promise.all([
            request(0, '/release'),
            request(1, '/release'),
            request(0, '/release-terminal'),
            request(1, '/release-terminal'),
          ]);
          await request(0, '/run');
          let original: { publisherId: string } | undefined;
          await expect
            .poll(
              async () => {
                original = (await request(0, '/state')).record;
                return original;
              },
              { timeout: 30_000 },
            )
            .toMatchObject({ status: 'suspended', publisherId: expect.any(String) });
          const workflows = (await store.getStore('workflows'))!;
          await expect
            .poll(
              async () => {
                const row = await workflows.getWorkflowRunById({ runId, workflowName: 'durable-agentic-loop' });
                const snapshot = typeof row?.snapshot === 'string' ? JSON.parse(row.snapshot) : row?.snapshot;
                return snapshot?.status;
              },
              { timeout: 30_000 },
            )
            .toBe('suspended');
          // Keep the original reader open while another process owns the resumed segment.
          await request(1, '/resume');
          await expect
            .poll(() => processes.some(child => child.stdout.includes('publisher-tool-executed')), { timeout: 10_000 })
            .toBe(true);
          await expect
            .poll(async () => (await request(1, '/state')).result.text, { timeout: 30_000 })
            .toBe('The answer is 42.');
          await expect
            .poll(async () => (await request(0, '/state')).result.text, { timeout: 30_000 })
            .toBe('The answer is 42.');
          const resumed = (await request(1, '/state')).record;
          expect(resumed).toMatchObject({ status: 'finished', publisherId: expect.any(String) });
          expect(resumed.publisherId).not.toBe(original!.publisherId);
          await request(0, '/cleanup');
          expect((await request(1, '/state')).record).toMatchObject({
            publisherId: resumed.publisherId,
            status: 'finished',
          });
          await request(1, '/cleanup');
        } else {
          await request(0, '/run');
          await expect
            .poll(() => processes.some(child => child.stdout.includes('publisher-between-steps')), {
              timeout: 30_000,
            })
            .toBe(true);
          const owner = (await request(1, '/state')).record;
          expect(owner).toMatchObject({ agentId: 'publisher-agent', runId, status: 'running' });
          expect(owner.publisherId).toBeTypeOf('string');
          if (scenario === 'abort') {
            expect(await request(1, '/abort')).toEqual({ acknowledged: true });
          }
          await Promise.all([request(0, '/release'), request(1, '/release')]);
          if (engine === 'evented') {
            await expect
              .poll(() => processes.some(child => child.stdout.includes('publisher-terminal-pending')), {
                timeout: 30_000,
              })
              .toBe(true);
            // The worker is held after delivering its terminal. Only the owning reader
            // may finish the record; releasing the worker must never recreate it after cleanup.
            await expect
              .poll(async () => (await request(1, '/state')).record, { timeout: 30_000 })
              .toMatchObject({ publisherId: owner.publisherId, status: 'finished' });
            if (scenario === 'abort') {
              await request(0, '/cleanup');
              await expect.poll(async () => (await request(1, '/state')).record).toBeUndefined();
            }
            await Promise.all([request(0, '/release-terminal'), request(1, '/release-terminal')]);
          }
          if (engine !== 'evented' || scenario !== 'abort') {
            await expect
              .poll(async () => (await request(1, '/state')).record?.status, { timeout: 30_000 })
              .toBe('finished');
          }
          if (scenario === 'abort') {
            await expect.poll(async () => (await request(0, '/state')).result, { timeout: 10_000 }).not.toEqual({});
            expect((await request(0, '/state')).result).toMatchObject({ finishReason: 'aborted' });
          } else {
            await expect
              .poll(async () => (await request(0, '/state')).result.text, { timeout: 10_000 })
              .toBe('The answer is 42.');
            await request(1, '/run');
            let replacement: { publisherId: string } | undefined;
            await expect
              .poll(
                async () => {
                  replacement = (await request(0, '/state')).record;
                  return replacement && replacement.publisherId !== owner.publisherId;
                },
                { timeout: 30_000 },
              )
              .toBe(true);
            // Explicit cleanup from the previous server must not remove the replacement run's record.
            await request(0, '/cleanup');
            expect((await request(0, '/state')).record).toMatchObject({ publisherId: replacement!.publisherId });
            await Promise.all([request(0, '/release'), request(1, '/release')]);
            await expect.poll(async () => (await request(1, '/state')).result, { timeout: 30_000 }).not.toEqual({});
            expect((await request(1, '/state')).result).toMatchObject({ text: 'The answer is 42.' });
            await request(1, '/cleanup');
          }
          if (scenario === 'abort') await request(0, '/cleanup');
        }
        await expect.poll(async () => (await request(1, '/state')).record, { timeout: 10_000 }).toBeUndefined();
        await expect
          .poll(
            async () => {
              const keys = await redis.keys(`${prefix}*`);
              return keys.filter(
                key =>
                  key.includes(`agent.stream.${runId}`) ||
                  (engine === 'durable' && key.includes(`agent.control.${runId}`)),
              );
            },
            { timeout: 10_000 },
          )
          .toEqual([]);
        if (engine === 'evented') {
          // COR-1571: remote worker listeners live until registry TTL eviction.
          // Redis NOGROUP recovery stamps the default 7-day idle TTL (src/index.ts:15,1406-1419).
          const controls = (await redis.keys(`${prefix}*`)).filter(key => key.includes(`agent.control.${runId}`));
          for (const key of controls) {
            const ttl = await redis.pTTL(key);
            expect(ttl, `remaining control key TTL: ${ttl}ms`).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
            console.info(`${engine} ${scenario}: remaining control key TTL ${ttl}ms`);
          }
        }
      } catch (error) {
        for (const child of processes) console.error(child.stdout, child.stderr);
        throw error;
      } finally {
        await Promise.all(processes.map(child => killProcess(child)));
        await llm.stop();
        const keys = await redis.keys(`${prefix}*`);
        if (keys.length) await redis.del(keys);
        await redis.quit();
        await store.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
        await store.close();
      }
    }, 120_000);
  }
});

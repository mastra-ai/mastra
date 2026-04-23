import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/upstash';
import { $ } from 'execa';
import { describe, beforeAll, afterAll } from 'vitest';

import { getPerformanceTests } from './performance-tests';

const __dirname = fileURLToPath(import.meta.url);
const dockerCwd = join(__dirname, '..', '..');

describe('Memory with UpstashStore Performance', () => {
  let dbPath: string;
  let perfPort = process.env.PERF_SERVERLESS_REDIS_HTTP_PORT ?? '8080';
  let perfUrl = `http://localhost:${perfPort}`;
  let shouldStopDocker = false;

  beforeAll(async () => {
    dbPath = await mkdtemp(join(tmpdir(), `perf-test-`));
    perfPort = process.env.PERF_SERVERLESS_REDIS_HTTP_PORT ?? '8080';
    perfUrl = `http://localhost:${perfPort}`;

    const dockerEnv = {
      ...process.env,
      PERF_SERVERLESS_REDIS_HTTP_PORT: perfPort,
    };

    try {
      await $({
        cwd: dockerCwd,
        env: dockerEnv,
      })`docker compose down --volumes perf-serverless-redis-http perf-redis`;

      await $({
        cwd: dockerCwd,
        stdio: 'inherit',
        detached: true,
        env: dockerEnv,
      })`docker compose up -d --force-recreate perf-serverless-redis-http perf-redis --wait`;
      shouldStopDocker = true;
    } catch {
      const probe = await fetch(`${perfUrl}/get/test`, {
        headers: {
          authorization: 'Bearer test_token',
        },
      }).catch(() => null);

      if (!probe?.ok) {
        throw new Error(
          `Failed to start perf-serverless-redis-http on port ${perfPort}, and no compatible Upstash test server is reachable at ${perfUrl}.`,
        );
      }
    }
  });

  afterAll(async () => {
    // Clean up temp db files
    if (dbPath && fs.existsSync(dbPath)) {
      for (const file of fs.readdirSync(dbPath)) {
        fs.unlinkSync(join(dbPath, file));
      }
      fs.rmdirSync(dbPath);
    }

    if (!shouldStopDocker) {
      return;
    }

    await $({
      cwd: dockerCwd,
      env: {
        ...process.env,
        PERF_SERVERLESS_REDIS_HTTP_PORT: perfPort,
      },
    })`docker compose down --volumes perf-serverless-redis-http perf-redis`;
  });

  getPerformanceTests(() => {
    return new Memory({
      storage: new UpstashStore({
        id: 'perf-upstash-storage',
        url: perfUrl,
        token: 'test_token',
      }),
      vector: new LibSQLVector({
        url: `file:${join(dbPath, 'perf-upstash-vector.db')}`,
        id: randomUUID(),
      }),
      embedder: fastembed.small,
      options: {
        lastMessages: 10,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
        },
      },
    });
  });
});

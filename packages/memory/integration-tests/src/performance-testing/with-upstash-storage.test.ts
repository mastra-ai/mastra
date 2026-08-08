import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { UpstashStore } from '@mastra/upstash';
import { $ } from 'execa';
import { describe, beforeAll, afterAll } from 'vitest';

import { getPerformanceTests } from './performance-tests';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dockerCwd = join(__dirname, '..', '..');

const removePerfRedisContainers = (env: NodeJS.ProcessEnv) => {
  return $({ cwd: dockerCwd, env })`docker compose rm --stop --force --volumes perf-serverless-redis-http perf-redis`;
};

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

describe('Memory with UpstashStore Performance', () => {
  let dbPath: string;
  let perfPort = process.env.PERF_SERVERLESS_REDIS_HTTP_PORT ?? '8080';
  let perfUrl = `http://localhost:${perfPort}`;
  let shouldStopDocker = false;

  beforeAll(async () => {
    dbPath = await mkdtemp(join(tmpdir(), `perf-test-`));
    perfPort = process.env.PERF_SERVERLESS_REDIS_HTTP_PORT ?? String(await getAvailablePort());
    perfUrl = `http://localhost:${perfPort}`;

    const dockerEnv = {
      ...process.env,
      PERF_SERVERLESS_REDIS_HTTP_PORT: perfPort,
    };

    try {
      await removePerfRedisContainers(dockerEnv);

      await $({
        cwd: dockerCwd,
        stdio: 'inherit',
        detached: true,
        env: dockerEnv,
      })`docker compose up -d --force-recreate perf-serverless-redis-http perf-redis --wait`;
      shouldStopDocker = true;
    } catch {
      await removePerfRedisContainers(dockerEnv).catch(() => undefined);

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
        try {
          fs.unlinkSync(join(dbPath, file));
        } catch {}
      }
      try {
        fs.rmdirSync(dbPath);
      } catch {}
    }

    if (!shouldStopDocker) {
      return;
    }

    await removePerfRedisContainers({
      ...process.env,
      PERF_SERVERLESS_REDIS_HTTP_PORT: perfPort,
    });
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

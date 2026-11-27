import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_dev } from 'wrangler';
import { z } from 'zod';

import { CloudflareDeployer } from './index.js';

// workerd's node:http rejects the DNS `lookup` option web_fetch uses to block private addresses, so the
// tool must fall back to fetch. Local workerd has no hostname that reaches a test server without also
// being a private address, so this checks the tool reaches the network and still blocks literal hosts.
const worker = `import { webFetchTool } from '@mastra/core/tools';

export default {
  async fetch(request) {
    const url = new URL(request.url).searchParams.get('url');
    return Response.json(await webFetchTool.execute({ url }, {}));
  },
};
`;

const resultSchema = z.object({ content: z.string(), isError: z.boolean().optional() });

describe('web_fetch in workerd', () => {
  let projectDir: string;
  let mastraDir: string;

  beforeAll(async () => {
    projectDir = await mkdtemp(join(import.meta.dirname, '..', '.workerd-test-'));
    mastraDir = join(projectDir, '.mastra');
    await mkdir(join(mastraDir, 'output'), { recursive: true });
  });

  afterAll(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('falls back to fetch and keeps blocking literal private hosts', { timeout: 120_000 }, async () => {
    await new CloudflareDeployer({ name: 'workerd-web-fetch' }).writeFiles(mastraDir);
    await writeFile(join(mastraDir, 'output', 'index.mjs'), worker);

    const cwd = process.cwd();
    process.chdir(projectDir);
    try {
      const dev = await unstable_dev(join(mastraDir, 'output', 'index.mjs'), {
        config: join(projectDir, 'wrangler.jsonc'),
        ip: '127.0.0.1',
        port: 0,
        logLevel: 'error',
        experimental: { disableExperimentalWarning: true, testMode: true },
      });
      try {
        const run = async (url: string) =>
          resultSchema.parse(await (await dev.fetch(`/?url=${encodeURIComponent(url)}`)).json());

        // .invalid never resolves, so reaching a DNS error proves the request went out through fetch.
        const unresolvable = await run('http://web-fetch.invalid/');
        expect(unresolvable.isError).toBe(true);
        expect(unresolvable.content).not.toMatch(/not implemented/i);

        for (const url of ['http://127.0.0.1/', 'http://[::1]/', 'http://localhost/', 'http://169.254.169.254/']) {
          expect(await run(url)).toEqual({
            content: 'Failed to fetch URL: URL resolves to a private or reserved address.',
            isError: true,
          });
        }
      } finally {
        await dev.stop();
      }
    } finally {
      process.chdir(cwd);
    }
  });
});

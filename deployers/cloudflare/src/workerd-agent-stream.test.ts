/**
 * An app deployed with CloudflareDeployer's default wrangler config can call agent.stream().
 *
 * Runs the worker in real workerd (wrangler's local runtime) with the compatibility date and
 * flags CloudflareDeployer writes, and the model served by aimock. Workers expose WeakRef only
 * from compatibility date 2025-05-05, and the deployer default is earlier, so any unguarded
 * WeakRef on the stream() path fails here.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { unstable_dev } from 'wrangler';
import { z } from 'zod';

import { CloudflareDeployer } from './index.js';

const worker = `import { Agent } from '@mastra/core/agent';
export default {
  async fetch(request, env) {
    try {
      const agent = new Agent({
        id: 'edge',
        name: 'edge',
        instructions: 'Be brief.',
        model: { id: 'openai/gpt-4o-mini', url: env.MODEL_URL, apiKey: 'aimock-test-key' },
      });
      const stream = await agent.stream('Say hi');
      return Response.json({ text: await stream.text });
    } catch (error) {
      return Response.json({ error: String(error) });
    }
  },
};
`;

const responseSchema = z.object({ text: z.string().optional(), error: z.string().optional() });
const configSchema = z.object({ compatibility_date: z.string(), compatibility_flags: z.array(z.string()) });

describe('CloudflareDeployer default config in workerd', () => {
  const llm = new LLMock({ port: 0 });
  // Inside the package so the worker resolves @mastra/core from this package's node_modules.
  const projectDir = join(import.meta.dirname, '..', `.workerd-test-${process.pid}`);
  // Same layout as a real project: <project>/.mastra/output, wrangler.jsonc lands in <project>.
  const mastraDir = join(projectDir, '.mastra');

  beforeAll(async () => {
    await llm.start();
    llm.on({ endpoint: 'chat' }, { content: 'hi from aimock' });
    await mkdir(join(mastraDir, 'output'), { recursive: true });
  });

  afterAll(async () => {
    await llm.stop();
    await rm(projectDir, { recursive: true, force: true });
  });

  it('agent.stream() completes', async () => {
    const deployer = new CloudflareDeployer({ name: 'workerd-agent-stream' });
    vi.spyOn(deployer, 'loadEnvVars').mockResolvedValue(new Map());
    await deployer.writeFiles(mastraDir);

    const outputDir = join(mastraDir, 'output');
    const config = configSchema.parse(JSON.parse(await readFile(join(outputDir, 'wrangler.json'), 'utf8')));
    // The date users get without overriding it: before WeakRef exists in workerd.
    expect(config.compatibility_date < '2025-05-05').toBe(true);

    await writeFile(join(outputDir, 'index.mjs'), worker);
    // wrangler resolves the config's aliases from the working directory; users run it from the project root.
    const cwd = process.cwd();
    process.chdir(projectDir);
    try {
      const dev = await unstable_dev(join(outputDir, 'index.mjs'), {
        // The config users deploy with: <project>/wrangler.jsonc.
        config: join(projectDir, 'wrangler.jsonc'),
        ip: '127.0.0.1',
        port: 0,
        vars: { MODEL_URL: `${llm.url.replace(/\/+$/, '')}/v1` },
        logLevel: 'error',
        experimental: { disableExperimentalWarning: true, testMode: true },
      });
      try {
        const response = await dev.fetch('/');
        expect(responseSchema.parse(await response.json())).toEqual({ text: 'hi from aimock' });
      } finally {
        await dev.stop();
      }
    } finally {
      process.chdir(cwd);
    }
  }, 120_000);
});

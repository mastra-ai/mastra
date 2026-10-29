import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LLMock } from '@copilotkit/aimock';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
      let text = '';
      for await (const delta of stream.textStream) text += delta;
      return Response.json({ text });
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
  let projectDir: string;
  // Same layout as a real project: <project>/.mastra/output, wrangler.jsonc lands in <project>.
  let mastraDir: string;

  beforeAll(async () => {
    projectDir = await mkdtemp(join(import.meta.dirname, '..', '.workerd-test-'));
    mastraDir = join(projectDir, '.mastra');
    await llm.start();
    llm.on({ endpoint: 'chat' }, { content: 'hi from aimock' });
    await mkdir(join(mastraDir, 'output'), { recursive: true });
  });

  afterAll(async () => {
    await llm.stop();
    await rm(projectDir, { recursive: true, force: true });
  });

  // #27899: the default date must expose WeakRef for stream registration.
  it('agent.stream() completes with the generated default configuration', async () => {
    const deployer = new CloudflareDeployer({ name: 'workerd-agent-stream' });
    await deployer.writeFiles(mastraDir);

    const outputDir = join(mastraDir, 'output');

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

  it('preserves a user-specified compatibility date in both generated configurations', async () => {
    const deployer = new CloudflareDeployer({ name: 'custom-date', compatibility_date: '2025-04-01' });
    await deployer.writeFiles(mastraDir);
    for (const configPath of [join(mastraDir, 'output', 'wrangler.json'), join(projectDir, 'wrangler.jsonc')]) {
      const json = (await readFile(configPath, 'utf8')).replace(/\/\*.*?\*\//, '');
      expect(configSchema.parse(JSON.parse(json)).compatibility_date).toBe('2025-04-01');
    }
  });
});

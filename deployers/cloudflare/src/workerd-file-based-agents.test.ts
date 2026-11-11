import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareFsAgentsEntry, writeFsAgentsEntry } from '@mastra/deployer/build';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_dev } from 'wrangler';
import { z } from 'zod';

import { CloudflareDeployer } from './index.js';

const agentsResponseSchema = z.record(z.string(), z.object({ name: z.string() }));

describe('CloudflareDeployer with file-based agents in workerd', () => {
  // Inside the package so the bundle resolves @mastra/core from this package's node_modules.
  let projectDir: string;
  const previousSkipInstall = process.env.MASTRA_BUILD_SKIP_INSTALL;

  beforeAll(async () => {
    process.env.MASTRA_BUILD_SKIP_INSTALL = 'true';
    projectDir = await mkdtemp(join(import.meta.dirname, '..', '.workerd-test-'));
    const mastraDir = join(projectDir, 'src', 'mastra');
    await mkdir(join(mastraDir, 'agents', 'router'), { recursive: true });
    await mkdir(join(projectDir, 'node_modules', '@mastra'), { recursive: true });
    // The user's entry imports the deployer by its package name.
    await symlink(join(import.meta.dirname, '..'), join(projectDir, 'node_modules', '@mastra', 'deployer-cloudflare'));
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: 'fs-agents-worker', type: 'module' }));
    await writeFile(
      join(mastraDir, 'index.ts'),
      `import { Mastra } from '@mastra/core/mastra';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

export const mastra = new Mastra({
  deployer: new CloudflareDeployer({ name: 'fs-agents-worker' }),
});
`,
    );
    await writeFile(
      join(mastraDir, 'agents', 'router', 'config.ts'),
      `import { agentConfig } from '@mastra/core/agent';

export default agentConfig({ model: 'openai/gpt-5-mini' });
`,
    );
    await writeFile(join(mastraDir, 'agents', 'router', 'instructions.md'), 'Answer briefly.\n');
  });

  afterAll(async () => {
    if (previousSkipInstall === undefined) {
      delete process.env.MASTRA_BUILD_SKIP_INSTALL;
    } else {
      process.env.MASTRA_BUILD_SKIP_INSTALL = previousSkipInstall;
    }
    await rm(projectDir, { recursive: true, force: true });
  });

  // #29996: the build pulled the deployer's own dependencies into the Worker, the bundle read
  // an undefined import.meta.url at startup, and requests called the Mastra instance as a function.
  it('serves file-based agents from a Worker built the way `mastra build` builds it', async () => {
    const mastraDir = join(projectDir, 'src', 'mastra');
    const userEntry = join(mastraDir, 'index.ts');
    const outputDirectory = join(projectDir, '.mastra');

    const fsAgents = await prepareFsAgentsEntry(mastraDir, userEntry, outputDirectory);
    const deployer = new CloudflareDeployer({ name: 'fs-agents-worker' });
    deployer.setConfigEntryFile(userEntry);
    const toolsPaths = deployer.getAllToolPaths(mastraDir, fsAgents.toolPaths);
    await deployer.prepare(outputDirectory);
    await writeFsAgentsEntry(fsAgents);
    await deployer.bundle(fsAgents.entryFile, outputDirectory, { toolsPaths, projectRoot: projectDir });

    // wrangler resolves the config's aliases from the working directory; users run it from the project root.
    const cwd = process.cwd();
    process.chdir(projectDir);
    try {
      const dev = await unstable_dev(join(outputDirectory, 'output', 'index.mjs'), {
        config: join(projectDir, 'wrangler.jsonc'),
        ip: '127.0.0.1',
        port: 0,
        logLevel: 'error',
        experimental: { disableExperimentalWarning: true, testMode: true },
      });
      try {
        // A second request runs against the per-request Mastra the deployer builds.
        for (let request = 0; request < 2; request++) {
          const response = await dev.fetch('/api/agents');
          expect(response.status, await response.clone().text()).toBe(200);
          expect(agentsResponseSchema.parse(await response.json()).router?.name).toBe('router');
        }
      } finally {
        await dev.stop();
      }
    } finally {
      process.chdir(cwd);
    }
  }, 120_000);
});

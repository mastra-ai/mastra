import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareFsAgentsEntry, writeFsAgentsEntry } from '@mastra/deployer/build';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_dev } from 'wrangler';
import { z } from 'zod';

import { CloudflareDeployer } from './index.js';

// The @mastra/mcp that @mastra/server (via @mastra/deployer) resolves, i.e. the version this repo builds against.
const requireFromServer = createRequire(
  createRequire(fileURLToPath(import.meta.resolve('@mastra/deployer'))).resolve('@mastra/server/package.json'),
);
const mcpPackageDir = dirname(requireFromServer.resolve('@mastra/mcp/package.json'));

const toolsListSchema = z.object({ result: z.object({ tools: z.array(z.object({ name: z.string() })) }) });

/** Reads the JSON-RPC message from a JSON or single-event SSE response. */
async function readMessage(response: Response): Promise<unknown> {
  const text = await response.text();
  const data = text.match(/^data: (.*)$/m)?.[1];
  return JSON.parse(data ?? text);
}

describe('CloudflareDeployer built-in MCP server in workerd', () => {
  let projectDir: string;
  const previousSkipInstall = process.env.MASTRA_BUILD_SKIP_INSTALL;

  beforeAll(async () => {
    process.env.MASTRA_BUILD_SKIP_INSTALL = 'true';
    projectDir = await mkdtemp(join(import.meta.dirname, '..', '.workerd-test-'));
    const mastraDir = join(projectDir, 'src', 'mastra');
    await mkdir(join(mastraDir, 'agents', 'router'), { recursive: true });
    await mkdir(join(projectDir, 'node_modules', '@mastra'), { recursive: true });
    await symlink(join(import.meta.dirname, '..'), join(projectDir, 'node_modules', '@mastra', 'deployer-cloudflare'));
    // The app installs the optional peer, so the build bundles it into the Worker.
    await symlink(mcpPackageDir, join(projectDir, 'node_modules', '@mastra', 'mcp'));
    await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: 'mcp-worker', type: 'module' }));
    await writeFile(
      join(mastraDir, 'index.ts'),
      `import { Mastra } from '@mastra/core/mastra';
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

export const mastra = new Mastra({
  deployer: new CloudflareDeployer({ name: 'mcp-worker' }),
  server: { mcp: { enabled: true } },
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

  it('serves the built-in MCP endpoint when the app installs @mastra/mcp', async () => {
    const mastraDir = join(projectDir, 'src', 'mastra');
    const userEntry = join(mastraDir, 'index.ts');
    const outputDirectory = join(projectDir, '.mastra');

    // Same steps, in the same order, as the platform deployer branch of packages/cli/src/commands/build/build.ts.
    const fsAgents = await prepareFsAgentsEntry(mastraDir, userEntry, outputDirectory);
    const deployer = new CloudflareDeployer({ name: 'mcp-worker' });
    deployer.setConfigEntryFile(userEntry);
    const toolsPaths = deployer.getAllToolPaths(mastraDir, fsAgents.toolPaths);
    await deployer.prepare(outputDirectory);
    await writeFsAgentsEntry(fsAgents);
    await deployer.bundle(fsAgents.entryFile, outputDirectory, { toolsPaths, projectRoot: projectDir });

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
        const headers = {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-06-18',
        };
        const initialize = await dev.fetch('/api/mcp', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } },
          }),
        });
        expect(initialize.status, await initialize.clone().text()).toBe(200);

        const list = await dev.fetch('/api/mcp', {
          method: 'POST',
          headers,
          body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
        });
        expect(list.status, await list.clone().text()).toBe(200);
        const names = toolsListSchema.parse(await readMessage(list)).result.tools.map(tool => tool.name);
        expect(names).toEqual(expect.arrayContaining(['list_agents', 'call_agent']));
      } finally {
        await dev.stop();
      }
    } finally {
      process.chdir(cwd);
    }
  }, 120_000);
});

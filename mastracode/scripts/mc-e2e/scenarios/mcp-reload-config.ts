import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v3';
import { createGlobalPatchScope } from './global-patches.js';
import { startMcpHttpFixtureServer } from './mcp-http-fixture.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

async function startMcpReloadFixtureServer() {
  return startMcpHttpFixtureServer({
    headerName: 'x-mc-e2e',
    headerValue: 'reload-config',
    name: 'mc-e2e-reload-mcp',
    registerTools: server => {
      server.tool(
        'reload_probe',
        'Return the deterministic MCP reload e2e probe payload.',
        { label: z.string().default('reload') },
        input => ({
          content: [{ type: 'text', text: `MC_MCP_RELOAD_TOOL:${String(input.label)}:ok` }],
        }),
      );
    },
  });
}

export const mcpReloadConfigScenario = {
  name: 'mcp-reload-config',
  description: 'Reloads MCP servers from a changed project mcp.json through the real TUI command.',
  testName: 'reloads MCP config from disk and updates the visible manager status',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    mkdirSync(join(projectDir, '.mastracode'), { recursive: true });
    writeFileSync(
      join(projectDir, '.mastracode', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            reload_before: {
              command: process.execPath,
              args: ['-e', 'process.stderr.write("reload before server failed\\n"); process.exit(1);'],
              env: {},
            },
          },
        },
        null,
        2,
      ),
    );
  },
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    const fixtureServer = await startMcpReloadFixtureServer();
    patches.setEnv('MC_E2E_MCP_RELOAD_URL', fixtureServer.url);

    try {
      const app = await startMastraCodeApp({
        config: {
          disableHooks: true,
          disableMcp: false,
          unixSocketPubSub: false,
        },
      });

      return {
        stop: async () => {
          try {
            await patches.stopApp(app.stop);
          } finally {
            await fixtureServer.close();
          }
        },
      };
    } catch (error) {
      await fixtureServer.close();
      patches.restore();
      throw error;
    }
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/MCP: Failed to connect to "reload_before"/i, terminal, 15_000);
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/reload_before \[stdio\] \(error:/i, terminal, 10_000);
    runtime.printScreen('mcp reload before status', terminal);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const url=process.env.MC_E2E_MCP_RELOAD_URL; if(!url) throw new Error("missing MC_E2E_MCP_RELOAD_URL"); fs.mkdirSync(".mastracode",{recursive:true}); fs.writeFileSync(".mastracode/mcp.json", JSON.stringify({mcpServers:{reload_after:{url,headers:{"x-mc-e2e":"reload-config"}}}}, null, 2)); console.log("MCP_RELOAD_CONFIG_WRITTEN="+url);'`,
    );
    await runtime.waitForScreenText(/MCP_RELOAD_CONFIG_WRITTEN=http:\/\/127\.0\.0\.1:/i, terminal, 10_000);

    terminal.submit('/mcp reload');
    await runtime.waitForScreenText(/MCP: Reloaded\. 1 server\(s\) connected, 1 tool\(s\)\./i, terminal, 15_000);
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/reload_after \[http\] \(connected\)/i, terminal, 15_000);
    await runtime.waitForScreenText(/reload_after_reload_probe/i, terminal, 15_000);
    runtime.printScreen('mcp reload after status', terminal);
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;

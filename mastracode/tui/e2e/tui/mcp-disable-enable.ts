import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v3';
import { createGlobalPatchScope } from './global-patches.js';
import { startMcpHttpFixtureServer } from './mcp-http-fixture.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

async function startMcpDisableFixtureServer() {
  return startMcpHttpFixtureServer({
    headerName: 'x-mc-e2e',
    headerValue: 'disable-enable',
    name: 'mc-e2e-disable-mcp',
    registerTools: server => {
      server.tool(
        'disable_probe',
        'Return the deterministic MCP disable e2e probe payload.',
        { label: z.string().default('disable') },
        input => ({
          content: [{ type: 'text', text: `MC_MCP_DISABLE_TOOL:${String(input.label)}:ok` }],
        }),
      );
    },
  });
}

export const mcpDisableEnableScenario = {
  name: 'mcp-disable-enable',
  description: 'Disables and re-enables an MCP server through the real /mcp command, with persisted state.',
  testName: 'disables an MCP server, persists the state, and re-enables it',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    // Start with a failing stdio server so the MCP manager initializes; the
    // real HTTP fixture URL is only known at runtime and written via /mcp reload.
    mkdirSync(join(projectDir, '.mastracode'), { recursive: true });
    writeFileSync(
      join(projectDir, '.mastracode', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            disable_before: {
              command: process.execPath,
              args: ['-e', 'process.stderr.write("disable before server failed\\n"); process.exit(1);'],
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
    const fixtureServer = await startMcpDisableFixtureServer();
    patches.setEnv('MC_E2E_MCP_DISABLE_URL', fixtureServer.url);

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

    await runtime.waitForScreenText(/MCP: Failed to connect to "disable_before"/i, terminal, 15_000);

    // Point the project config at the live HTTP fixture and reload.
    terminal.submit(
      `!node -e 'const fs=require("fs"); const url=process.env.MC_E2E_MCP_DISABLE_URL; if(!url) throw new Error("missing MC_E2E_MCP_DISABLE_URL"); fs.mkdirSync(".mastracode",{recursive:true}); fs.writeFileSync(".mastracode/mcp.json", JSON.stringify({mcpServers:{disable_target:{url,headers:{"x-mc-e2e":"disable-enable"}}}}, null, 2)); console.log("MCP_DISABLE_CONFIG_WRITTEN="+url);'`,
    );
    await runtime.waitForScreenText(/MCP_DISABLE_CONFIG_WRITTEN=http:\/\/127\.0\.0\.1:/i, terminal, 10_000);

    terminal.submit('/mcp reload');
    await runtime.waitForScreenText(/MCP: Reloaded\. 1 server\(s\) connected, 1 tool\(s\)\./i, terminal, 15_000);

    // Disable the server and confirm the explicit project override persists.
    terminal.submit('/mcp disable disable_target');
    await runtime.waitForScreenText(
      /MCP: "disable_target" disabled in this project\. It will remain disabled if the global default changes\./i,
      terminal,
      15_000,
    );
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(
      /disable_target \[http\] \(disabled in this project; global default: enabled — use \/mcp inherit disable_target\)/i,
      terminal,
      10_000,
    );
    runtime.printScreen('mcp disabled status', terminal);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/mcp-state.json","utf8")); console.log("MCP_PROJECT_OVERRIDE="+s.projects[process.cwd()].serverOverrides.disable_target);'`,
    );
    await runtime.waitForScreenText(/MCP_PROJECT_OVERRIDE=disabled/i, terminal, 10_000);

    // Reload must keep the server disabled without reporting a connect failure.
    terminal.submit('/mcp reload');
    await runtime.waitForScreenText(/MCP: Reloaded\. 0 server\(s\) connected, 0 tool\(s\)\./i, terminal, 15_000);

    // Clear the project override and confirm the inherited global default reconnects it.
    terminal.submit('/mcp inherit disable_target');
    await runtime.waitForScreenText(
      /MCP: Removed this project's setting for "disable_target"\. It is now enabled by the global default — 1 tool\(s\)\./i,
      terminal,
      15_000,
    );
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/disable_target_disable_probe/i, terminal, 15_000);

    // A global per-server disable is a default that this project can override.
    terminal.submit('/mcp disable disable_target --global');
    await runtime.waitForScreenText(/MCP: Global default for "disable_target" set to disabled\./i, terminal, 15_000);
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(
      /disable_target \[http\] \(disabled by global default — override via \/mcp enable disable_target\)/i,
      terminal,
      15_000,
    );
    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/mcp-state.json","utf8")); console.log("MCP_GLOBAL_PERSISTED="+((s.global&&s.global.disabledServers)||[]).join("|"));'`,
    );
    await runtime.waitForScreenText(/MCP_GLOBAL_PERSISTED=disable_target/i, terminal, 10_000);

    terminal.submit('/mcp enable disable_target');
    await runtime.waitForScreenText(
      /MCP: "disable_target" enabled in this project, overriding the disabled global default — 1 tool\(s\)\./i,
      terminal,
      15_000,
    );
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(
      /disable_target \[http\] \(connected; project setting: enabled; global default: disabled\)/i,
      terminal,
      15_000,
    );

    // The selector exposes both settings and omits the no-op global disable action.
    terminal.submit('/mcp');
    await runtime.waitForScreenText(/Manage MCP servers/i, terminal, 10_000);
    await runtime.waitForScreenText(
      /disable_target \[http\] connected · enabled in this project \(global default: disabled\)/i,
      terminal,
      10_000,
    );
    terminal.write('\r');
    await runtime.waitForScreenText(/Use global default \(disabled\)/i, terminal, 10_000);
    await runtime.waitForScreenText(/Enable globally \(all projects\)/i, terminal, 10_000);
    await runtime.waitForScreenTextAbsent(/Disable globally \(all projects\)/i, terminal, 1_000);
    runtime.printScreen('mcp project setting enabled over global default', terminal);
    terminal.write('\x1b');
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Manage MCP servers/i, terminal, 8_000);

    terminal.submit('/mcp inherit disable_target');
    await runtime.waitForScreenText(
      /MCP: Removed this project's setting for "disable_target"\. It is now disabled by the global default\./i,
      terminal,
      15_000,
    );

    terminal.submit('/mcp enable disable_target --global');
    await runtime.waitForScreenText(/MCP: Global default for "disable_target" set to enabled\./i, terminal, 15_000);
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/disable_target \[http\] \(connected\)/i, terminal, 15_000);
    runtime.printScreen('mcp globally re-enabled', terminal);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;

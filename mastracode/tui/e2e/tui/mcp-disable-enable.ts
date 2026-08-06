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

    // Disable the server and confirm status + persisted state.
    terminal.submit('/mcp disable disable_target');
    await runtime.waitForScreenText(
      /MCP: Disabled "disable_target"\. Re-enable with \/mcp enable disable_target\./i,
      terminal,
      15_000,
    );
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(
      /disable_target \[http\] \(disabled — enable via \/mcp enable disable_target\)/i,
      terminal,
      10_000,
    );
    runtime.printScreen('mcp disabled status', terminal);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/mcp-state.json","utf8")); const disabled=Object.values(s.projects||{}).flatMap(p=>p.disabledServers||[]); console.log("MCP_DISABLE_PERSISTED="+disabled.join("|"));'`,
    );
    await runtime.waitForScreenText(/MCP_DISABLE_PERSISTED=disable_target/i, terminal, 10_000);

    // Reload must keep the server disabled without reporting a connect failure.
    terminal.submit('/mcp reload');
    await runtime.waitForScreenText(/MCP: Reloaded\. 0 server\(s\) connected, 0 tool\(s\)\./i, terminal, 15_000);

    // Re-enable and confirm the tool comes back.
    terminal.submit('/mcp enable disable_target');
    await runtime.waitForScreenText(/MCP: Enabled "disable_target" — 1 tool\(s\)/i, terminal, 15_000);
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/disable_target \[http\] \(connected\)/i, terminal, 15_000);
    await runtime.waitForScreenText(/disable_target_disable_probe/i, terminal, 15_000);
    runtime.printScreen('mcp re-enabled status', terminal);

    terminal.submit(
      `!node -e 'const fs=require("fs"); let s={}; try{s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/mcp-state.json","utf8"));}catch{} const disabled=Object.values(s.projects||{}).flatMap(p=>p.disabledServers||[]); console.log("MCP_ENABLE_PERSISTED="+(disabled.length===0?"empty":disabled.join("|")));'`,
    );
    await runtime.waitForScreenText(/MCP_ENABLE_PERSISTED=empty/i, terminal, 10_000);

    // Global scope: disable across all projects, verify project-level enable
    // can't undo it, then re-enable globally.
    terminal.submit('/mcp disable disable_target --global');
    await runtime.waitForScreenText(
      /MCP: Disabled "disable_target" globally \(all projects\)\. Re-enable with \/mcp enable disable_target --global\./i,
      terminal,
      15_000,
    );
    terminal.submit(
      `!node -e 'const fs=require("fs"); const s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/mcp-state.json","utf8")); console.log("MCP_GLOBAL_PERSISTED="+((s.global&&s.global.disabledServers)||[]).join("|"));'`,
    );
    await runtime.waitForScreenText(/MCP_GLOBAL_PERSISTED=disable_target/i, terminal, 10_000);

    terminal.submit('/mcp enable disable_target');
    await runtime.waitForScreenText(
      /MCP: "disable_target" is still disabled globally — re-enable with \/mcp enable disable_target --global\./i,
      terminal,
      15_000,
    );

    terminal.submit('/mcp enable disable_target --global');
    // The "Enabled ... 1 tool(s)" text already appeared for the project-scope
    // enable above, so verify the global re-enable through the persisted
    // state instead of screen text alone.
    terminal.submit(
      `!node -e 'const fs=require("fs"); let s={}; try{s=JSON.parse(fs.readFileSync(process.env.MASTRA_APP_DATA_DIR+"/mcp-state.json","utf8"));}catch{} const g=(s.global&&s.global.disabledServers)||[]; console.log("MCP_GLOBAL_ENABLE_PERSISTED="+(g.length===0?"empty":g.join("|")));'`,
    );
    await runtime.waitForScreenText(/MCP_GLOBAL_ENABLE_PERSISTED=empty/i, terminal, 10_000);
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/disable_target \[http\] \(connected\)/i, terminal, 15_000);
    runtime.printScreen('mcp globally re-enabled', terminal);

    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;

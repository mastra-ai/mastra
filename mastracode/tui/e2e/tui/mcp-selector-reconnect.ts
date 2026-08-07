import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v3';
import { createGlobalPatchScope } from './global-patches.js';
import { startMcpHttpFixtureServer } from './mcp-http-fixture.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

async function startMcpSelectorFixtureServer(readyFile: string) {
  return startMcpHttpFixtureServer({
    beforeRequest: () =>
      existsSync(readyFile)
        ? undefined
        : { status: 503, body: 'selector retry disabled until e2e readiness file exists' },
    headerName: 'x-mc-e2e',
    headerValue: 'selector-reconnect',
    name: 'mc-e2e-selector-mcp',
    registerTools: server => {
      server.tool(
        'selector_probe',
        'Return the deterministic MCP selector e2e probe payload.',
        { label: z.string().default('selector') },
        input => ({
          content: [{ type: 'text', text: `MC_MCP_SELECTOR_TOOL:${String(input.label)}:ok` }],
        }),
      );
    },
  });
}

export const mcpSelectorReconnectScenario = {
  name: 'mcp-selector-reconnect',
  description: 'Uses the interactive MCP selector to inspect a failed server, reconnect it, and reload changed config.',
  testName: 'reconnects and reloads MCP servers from the interactive selector overlay',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    const readyFile = join(projectDir, '.mc-e2e-mcp-selector-ready');
    rmSync(readyFile, { force: true });
    mkdirSync(join(projectDir, '.mastracode'), { recursive: true });
  },
  async inProcessApp({ projectDir, startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const readyFile = join(projectDir, '.mc-e2e-mcp-selector-ready');
    const patches = createGlobalPatchScope();
    const fixtureServer = await startMcpSelectorFixtureServer(readyFile);
    patches.setEnv('MC_E2E_MCP_SELECTOR_URL', fixtureServer.url);
    patches.setEnv('MC_E2E_MCP_SELECTOR_READY_FILE', readyFile);

    writeFileSync(
      join(projectDir, '.mastracode', 'mcp.json'),
      JSON.stringify(
        {
          mcpServers: {
            selector_retry: { url: fixtureServer.url, headers: { 'x-mc-e2e': 'selector-reconnect' } },
          },
        },
        null,
        2,
      ),
    );

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

    await runtime.waitForScreenText(/MCP: Failed to connect to "selector_retry"/i, terminal, 15_000);
    terminal.submit(
      `!node -e 'const fs=require("fs"); const ready=process.env.MC_E2E_MCP_SELECTOR_READY_FILE; if(!ready) throw new Error("missing ready file env"); fs.writeFileSync(ready,"ready"); console.log("MCP_SELECTOR_READY=1");'`,
    );
    await runtime.waitForScreenText(/MCP_SELECTOR_READY=1/i, terminal, 10_000);
    await runtime.waitForScreenText(/MCP_SELECTOR_READY=1[\s\S]*✓/i, terminal, 10_000);

    terminal.write('\x15');
    terminal.submit('/mcp');
    await runtime.waitForScreenText(/Manage MCP servers/i, terminal, 8_000);
    await runtime.waitForScreenText(/selector_retry \[http\] failed/i, terminal, 8_000);
    terminal.write('\r');
    await runtime.waitForScreenText(/Reconnect/i, terminal, 8_000);
    terminal.write('\x1b[B');
    terminal.write('\x1b[B');
    terminal.write('\r');
    await runtime.waitForScreenText(/selector_retry \[http\] connected.*1 tools/i, terminal, 15_000);
    terminal.write('\x1b');
    await runtime.waitForScreenTextAbsent(/Manage MCP servers/i, terminal, 8_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const url=process.env.MC_E2E_MCP_SELECTOR_URL; if(!url) throw new Error("missing selector url"); fs.mkdirSync(".mastracode",{recursive:true}); fs.writeFileSync(".mastracode/mcp.json", JSON.stringify({mcpServers:{selector_retry:{url,headers:{"x-mc-e2e":"selector-reconnect"}},selector_reload:{url,headers:{"x-mc-e2e":"selector-reconnect"}}}}, null, 2)); console.log("MCP_SELECTOR_RELOAD_CONFIG=2");'`,
    );
    await runtime.waitForScreenText(/MCP_SELECTOR_RELOAD_CONFIG=2/i, terminal, 10_000);
    await runtime.waitForScreenText(/MCP_SELECTOR_RELOAD_CONFIG=2[\s\S]*✓/i, terminal, 10_000);

    terminal.submit('/mcp');
    await runtime.waitForScreenText(/selector_retry \[http\] connected/i, terminal, 8_000);
    terminal.write('r');
    await runtime.waitForScreenText(/selector_reload \[http\] connected.*1 tools/i, terminal, 15_000);
    runtime.printScreen('mcp selector reload after status', terminal);
    terminal.keyCtrlC();
  },
} satisfies McE2eScenario;

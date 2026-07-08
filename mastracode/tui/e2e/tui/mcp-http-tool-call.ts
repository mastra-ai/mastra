import { mkdirSync } from 'node:fs';
import { z } from 'zod/v3';
import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import { startMcpHttpFixtureServer } from './mcp-http-fixture.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

async function startMcpHttpToolFixtureServer() {
  return startMcpHttpFixtureServer({
    headerName: 'x-mc-e2e',
    headerValue: 'http-tool-call',
    name: 'mc-e2e-http-mcp',
    registerTools: server => {
      server.tool(
        'lookup_status',
        'Return the deterministic Mastra Code MCP HTTP e2e status payload.',
        { query: z.string().describe('Lookup query') },
        async input => ({
          content: [{ type: 'text', text: `MC_MCP_HTTP_TOOL_RESULT:${String(input.query)}:ok` }],
        }),
      );
    },
  });
}

export const mcpHttpToolCallScenario = {
  name: 'mcp-http-tool-call',
  description: 'Connects to a real HTTP MCP server and calls its namespaced tool through the model.',
  testName: 'calls a configured HTTP MCP tool through the real TUI runtime',
  useOpenAIModel: true,
  aimockFixture: 'mcp-http-tool-call.json',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    mkdirSync(projectDir, { recursive: true });
  },
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    const fixtureServer = await startMcpHttpToolFixtureServer();
    patches.setEnv('MC_E2E_MCP_HTTP_URL', fixtureServer.url);

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

    await runtime.waitForScreenText(/Project:|Resource ID:|>/i, terminal, 10_000);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const url=process.env.MC_E2E_MCP_HTTP_URL; if(!url) throw new Error("missing MC_E2E_MCP_HTTP_URL"); fs.mkdirSync(".mastracode",{recursive:true}); fs.writeFileSync(".mastracode/mcp.json", JSON.stringify({mcpServers:{e2e_http_mcp:{url,headers:{"x-mc-e2e":"http-tool-call"}}}}, null, 2)); console.log("MCP_HTTP_CONFIG_WRITTEN="+url);'`,
    );
    await runtime.waitForScreenText(/MCP_HTTP_CONFIG_WRITTEN=http:\/\/127\.0\.0\.1:/i, terminal, 10_000);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 15_000);

    terminal.submit('/mcp reload');
    await runtime.waitForScreenText(/MCP: Reloaded\. 1 server\(s\) connected, 1 tool\(s\)\./i, terminal, 60_000);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 15_000);
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/e2e_http_mcp \[http\] \(connected\)/i, terminal, 15_000);
    await runtime.waitForScreenText(/e2e_http_mcp_lookup_status/i, terminal, 15_000);
    runtime.printScreen('mcp http status', terminal);

    terminal.submit('Use the MCP HTTP lookup tool for the status payload.');
    await runtime.waitForScreenText(/e2e_http_mcp_lookup_status/i, terminal, 15_000);
    await runtime.waitForScreenText(/MC_MCP_HTTP_TOOL_RESULT:mcp-http-e2e:ok/i, terminal, 15_000);
    await runtime.waitForScreenText(/MCP HTTP lookup completed/i, terminal, 15_000);
    runtime.printScreen('mcp http tool call', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    expect(serialized).toContain('Use the MCP HTTP lookup tool for the status payload.');
    expect(serialized).toContain('e2e_http_mcp_lookup_status');
    expect(serialized).toContain('MC_MCP_HTTP_TOOL_RESULT:mcp-http-e2e:ok');
  },
} satisfies McE2eScenario;

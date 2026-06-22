import { mkdirSync } from 'node:fs';
import { z } from 'zod/v3';
import { expect } from './expect.js';
import { createGlobalPatchScope } from './global-patches.js';
import { startMcpHttpFixtureServer } from './mcp-http-fixture.js';
import type { McE2eInProcessApp, McE2eScenario } from './types.js';

async function startMcpLongRunningFixtureServer() {
  return startMcpHttpFixtureServer({
    headerName: 'x-mc-e2e',
    headerValue: 'long-running-tool',
    name: 'mc-e2e-long-mcp',
    registerTools: server => {
      server.tool(
        'slow_lookup',
        'Return a deterministic payload after a delay that exceeds short MCP result timeouts.',
        { query: z.string().describe('Lookup query') },
        async input => {
          await new Promise(resolve => setTimeout(resolve, 1200));
          return {
            content: [{ type: 'text', text: `MC_MCP_LONG_TOOL_RESULT:${String(input.query)}:complete` }],
          };
        },
      );
    },
  });
}

export const mcpLongRunningToolScenario = {
  name: 'mcp-long-running-tool',
  description: 'Runs an MCP HTTP tool whose result takes longer than a short MCP timeout budget.',
  testName: 'allows a long-running MCP tool call to complete through the real TUI runtime',
  useOpenAIModel: true,
  aimockFixture: 'mcp-long-running-tool.json',
  projectFixture: 'long-branch',
  prepare({ projectDir }) {
    mkdirSync(projectDir, { recursive: true });
  },
  async inProcessApp({ startMastraCodeApp }): Promise<McE2eInProcessApp> {
    const patches = createGlobalPatchScope();
    const fixtureServer = await startMcpLongRunningFixtureServer();
    patches.setEnv('MC_E2E_MCP_LONG_URL', fixtureServer.url);

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
      `!node -e 'const fs=require("fs"); const url=process.env.MC_E2E_MCP_LONG_URL; if(!url) throw new Error("missing MC_E2E_MCP_LONG_URL"); fs.mkdirSync(".mastracode",{recursive:true}); fs.writeFileSync(".mastracode/mcp.json", JSON.stringify({mcpServers:{e2e_long_mcp:{url,headers:{"x-mc-e2e":"long-running-tool"}}}}, null, 2)); console.log("MCP_LONG_CONFIG_WRITTEN="+url);'`,
    );
    await runtime.waitForScreenText(/MCP_LONG_CONFIG_WRITTEN=http:\/\/127\.0\.0\.1:/i, terminal, 10_000);
    await terminal.flushInput?.();
    await runtime.waitForScreenText(/│ ›/i, terminal, 10_000);

    terminal.submit('/mcp reload');
    await runtime.waitForScreenText(/MCP: Reloaded\. 1 server\(s\) connected, 1 tool\(s\)\./i, terminal, 30_000);
    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/e2e_long_mcp \[http\] \(connected\)/i, terminal, 15_000);
    await runtime.waitForScreenText(/e2e_long_mcp_slow_lookup/i, terminal, 15_000);
    runtime.printScreen('mcp long-running status', terminal);

    terminal.submit('Use the long-running MCP lookup tool and report its payload.');
    await runtime.waitForScreenText(/e2e_long_mcp_slow_lookup/i, terminal, 15_000);
    await runtime.waitForScreenText(/MC_MCP_LONG_TOOL_RESULT:timeout-e2e:complete/i, terminal, 20_000);
    await runtime.waitForScreenText(/Long-running MCP lookup completed/i, terminal, 15_000);
    runtime.printScreen('mcp long-running tool call', terminal);
    terminal.keyCtrlC();
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests);
    expect(serialized).toContain('Use the long-running MCP lookup tool and report its payload.');
    expect(serialized).toContain('e2e_long_mcp_slow_lookup');
    expect(serialized).toContain('MC_MCP_LONG_TOOL_RESULT:timeout-e2e:complete');
  },
} satisfies McE2eScenario;

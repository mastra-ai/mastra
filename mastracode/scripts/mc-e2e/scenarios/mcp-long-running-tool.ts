import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const mcpLongRunningToolScenario = {
  name: 'mcp-long-running-tool',
  description: 'Runs an MCP HTTP tool whose result takes longer than a short MCP timeout budget.',
  testName: 'allows a long-running MCP tool call to complete through the real TUI runtime',
  useOpenAIModel: true,
  aimockFixture: 'mcp-long-running-tool.json',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-mcp-long-entrypoint.ts'),
      `import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const requireFromMcpPackage = createRequire(join(mastracodeDir, '../packages/mcp/package.json'));
const { McpServer } = await import(pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/sdk/server/mcp.js')).href);
const { StreamableHTTPServerTransport } = await import(
  pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/sdk/server/streamableHttp.js')).href
);
const { z } = await import(pathToFileURL(requireFromMcpPackage.resolve('zod/v3')).href);
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

const httpServer = createServer();
const activeServers = new Set();

function createLongRunningMcpServer() {
  const server = new McpServer(
    { name: 'mc-e2e-long-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.tool(
    'slow_lookup',
    'Return a deterministic payload after a delay that exceeds short MCP result timeouts.',
    { query: z.string().describe('Lookup query') },
    async ({ query }) => {
      await new Promise(resolve => setTimeout(resolve, 1200));
      return {
        content: [{ type: 'text', text: 'MC_MCP_LONG_TOOL_RESULT:' + query + ':complete' }],
      };
    },
  );

  activeServers.add(server);
  return server;
}

httpServer.on('request', async (req, res) => {
  if (req.headers['x-mc-e2e'] !== 'long-running-tool') {
    res.writeHead(401, { 'content-type': 'text/plain' });
    res.end('missing x-mc-e2e header');
    return;
  }
  const mcpServer = createLongRunningMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);
  res.on('finish', () => {
    activeServers.delete(mcpServer);
    void mcpServer.close().catch(() => undefined);
  });
  await transport.handleRequest(req, res);
});

const mcpUrl = await new Promise(resolve => {
  httpServer.listen(0, '127.0.0.1', () => {
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('MCP long-running e2e server did not bind to a port');
    resolve('http://127.0.0.1:' + address.port + '/mcp');
  });
});

const shutdown = async () => {
  await Promise.all([...activeServers].map(server => server.close().catch(() => undefined)));
  await new Promise(resolve => httpServer.close(() => resolve(undefined))).catch(() => undefined);
};

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});

const result = await createMastraCode({
  cwd: process.cwd(),
  disableHooks: true,
  unixSocketPubSub: false,
  mcpServers: {
    e2e_long_mcp: {
      url: mcpUrl,
      headers: { 'x-mc-e2e': 'long-running-tool' },
    },
  },
});

const tui = new MastraTUI({
  harness: result.harness,
  hookManager: result.hookManager,
  authStorage: result.authStorage,
  mcpManager: result.mcpManager,
  appName: 'Mastra Code',
  version: getCurrentVersion(),
  inlineQuestions: true,
  githubSignals: result.githubSignals,
});

void tui.run().catch(error => {
  process.stderr.write(String(error instanceof Error ? error.stack ?? error.message : error) + '\\n');
  void shutdown().finally(() => process.exit(1));
});
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-mcp-long-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:|Resource ID:|>/i, terminal, 10_000);

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
    const serialized = JSON.stringify(requests.map((request: any) => request.body));
    expect(serialized).toContain('Use the long-running MCP lookup tool and report its payload.');
    expect(serialized).toContain('e2e_long_mcp_slow_lookup');
    expect(serialized).toContain('MC_MCP_LONG_TOOL_RESULT:timeout-e2e:complete');
  },
} satisfies McE2eScenario;

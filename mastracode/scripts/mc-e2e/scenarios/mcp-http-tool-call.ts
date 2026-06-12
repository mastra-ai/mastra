import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const mcpHttpToolCallScenario = {
  name: 'mcp-http-tool-call',
  description: 'Connects to a real HTTP MCP server and calls its namespaced tool through the model.',
  testName: 'calls a configured HTTP MCP tool through the real TUI runtime',
  useOpenAIModel: true,
  aimockFixture: 'mcp-http-tool-call.json',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-mcp-http-entrypoint.ts'),
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
const mcpServer = new McpServer(
  { name: 'mc-e2e-http-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

mcpServer.tool(
  'lookup_status',
  'Return the deterministic Mastra Code MCP HTTP e2e status payload.',
  { query: z.string().describe('Lookup query') },
  async ({ query }) => ({
    content: [{ type: 'text', text: 'MC_MCP_HTTP_TOOL_RESULT:' + query + ':ok' }],
  }),
);

httpServer.on('request', async (req, res) => {
  if (req.headers['x-mc-e2e'] !== 'http-tool-call') {
    res.writeHead(401, { 'content-type': 'text/plain' });
    res.end('missing x-mc-e2e header');
    return;
  }
  await mcpServer.close().catch(() => undefined);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);
  await transport.handleRequest(req, res);
});

const mcpUrl = await new Promise(resolve => {
  httpServer.listen(0, '127.0.0.1', () => {
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('MCP HTTP e2e server did not bind to a port');
    resolve('http://127.0.0.1:' + address.port + '/mcp');
  });
});

const shutdown = async () => {
  await mcpServer.close().catch(() => undefined);
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
    e2e_http_mcp: {
      url: mcpUrl,
      headers: { 'x-mc-e2e': 'http-tool-call' },
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
    return join(projectDir, '.mc-e2e-mcp-http-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Project:|Resource ID:|>/i, terminal, 10_000);

    terminal.submit('/mcp status');
    await runtime.waitForScreenText(/e2e_http_mcp \[http\] \(connected\)/i, terminal, 15_000);
    await runtime.waitForScreenText(/e2e_http_mcp_lookup_status/i, terminal, 15_000);
    runtime.printScreen('mcp http status', terminal);

    terminal.submit('Use the MCP HTTP lookup tool for the status payload.');
    await runtime.waitForScreenText(/e2e_http_mcp_lookup_status/i, terminal, 15_000);
    await runtime.waitForScreenText(/MC_MCP_HTTP_TOOL_RESULT:mcp-http-e2e:ok/i, terminal, 15_000);
    await runtime.waitForScreenText(/MCP HTTP lookup completed/i, terminal, 15_000);
    runtime.printScreen('mcp http tool call', terminal);

    await runtime.sleep(500);
    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
  verifyAimockRequests(requests) {
    const serialized = JSON.stringify(requests.map((request: any) => request.body));
    expect(serialized).toContain('Use the MCP HTTP lookup tool for the status payload.');
    expect(serialized).toContain('e2e_http_mcp_lookup_status');
    expect(serialized).toContain('MC_MCP_HTTP_TOOL_RESULT:mcp-http-e2e:ok');
  },
} satisfies McE2eScenario;

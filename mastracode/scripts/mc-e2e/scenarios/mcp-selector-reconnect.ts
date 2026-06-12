import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const mcpSelectorReconnectScenario = {
  name: 'mcp-selector-reconnect',
  description: 'Uses the interactive MCP selector to inspect a failed server, reconnect it, and reload changed config.',
  testName: 'reconnects and reloads MCP servers from the interactive selector overlay',
  projectFixture: 'long-branch',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-mcp-selector-entrypoint.ts'),
      `import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const projectDir = process.cwd();
const readyFile = join(projectDir, '.mc-e2e-mcp-selector-ready');
const configPath = join(projectDir, '.mastracode', 'mcp.json');
const requireFromMcpPackage = createRequire(join(mastracodeDir, '../packages/mcp/package.json'));
const { McpServer } = await import(pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/sdk/server/mcp.js')).href);
const { StreamableHTTPServerTransport } = await import(
  pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/sdk/server/streamableHttp.js')).href
);
const { z } = await import(pathToFileURL(requireFromMcpPackage.resolve('zod/v3')).href);
const { createMastraCode } = await import(pathToFileURL(join(mastracodeDir, 'src/index.ts')).href);
const { MastraTUI } = await import(pathToFileURL(join(mastracodeDir, 'src/tui/index.ts')).href);
const { getCurrentVersion } = await import(pathToFileURL(join(mastracodeDir, 'src/utils/update-check.ts')).href);

rmSync(readyFile, { force: true });
const httpServer = createServer();
const mcpServer = new McpServer(
  { name: 'mc-e2e-selector-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

mcpServer.tool(
  'selector_probe',
  'Return the deterministic MCP selector e2e probe payload.',
  { label: z.string().default('selector') },
  async ({ label }) => ({
    content: [{ type: 'text', text: 'MC_MCP_SELECTOR_TOOL:' + label + ':ok' }],
  }),
);

httpServer.on('request', async (req, res) => {
  if (req.headers['x-mc-e2e'] !== 'selector-reconnect') {
    res.writeHead(401, { 'content-type': 'text/plain' });
    res.end('missing x-mc-e2e selector header');
    return;
  }
  if (!existsSync(readyFile)) {
    res.writeHead(503, { 'content-type': 'text/plain' });
    res.end('selector retry disabled until e2e readiness file exists');
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
    if (!address || typeof address === 'string') throw new Error('MCP selector e2e server did not bind to a port');
    resolve('http://127.0.0.1:' + address.port + '/mcp');
  });
});
process.env.MC_E2E_MCP_SELECTOR_URL = mcpUrl;
process.env.MC_E2E_MCP_SELECTOR_READY_FILE = readyFile;
mkdirSync(join(projectDir, '.mastracode'), { recursive: true });
writeFileSync(
  configPath,
  JSON.stringify({
    mcpServers: {
      selector_retry: { url: mcpUrl, headers: { 'x-mc-e2e': 'selector-reconnect' } },
    },
  }, null, 2),
);

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
  cwd: projectDir,
  disableHooks: true,
  unixSocketPubSub: false,
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
    return join(projectDir, '.mc-e2e-mcp-selector-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/MCP: Failed to connect to "selector_retry"/i, terminal, 15_000);
    terminal.submit(
      `!node -e 'const fs=require("fs"); const ready=process.env.MC_E2E_MCP_SELECTOR_READY_FILE; if(!ready) throw new Error("missing ready file env"); fs.writeFileSync(ready,"ready"); console.log("MCP_SELECTOR_READY=1");'`,
    );
    await runtime.waitForScreenText(/MCP_SELECTOR_READY=1/i, terminal, 10_000);
    await runtime.sleep(300);

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
    await runtime.sleep(300);

    terminal.submit(
      `!node -e 'const fs=require("fs"); const url=process.env.MC_E2E_MCP_SELECTOR_URL; if(!url) throw new Error("missing selector url"); fs.mkdirSync(".mastracode",{recursive:true}); fs.writeFileSync(".mastracode/mcp.json", JSON.stringify({mcpServers:{selector_retry:{url,headers:{"x-mc-e2e":"selector-reconnect"}},selector_reload:{url,headers:{"x-mc-e2e":"selector-reconnect"}}}}, null, 2)); console.log("MCP_SELECTOR_RELOAD_CONFIG=2");'`,
    );
    await runtime.waitForScreenText(/MCP_SELECTOR_RELOAD_CONFIG=2/i, terminal, 10_000);

    terminal.submit('/mcp');
    await runtime.waitForScreenText(/selector_retry \[http\] connected/i, terminal, 8_000);
    terminal.write('r');
    await runtime.waitForScreenText(/selector_reload \[http\] connected.*1 tools/i, terminal, 15_000);
    runtime.printScreen('mcp selector reload after status', terminal);

    await runtime.sleep(500);
    terminal.keyCtrlC();
    await runtime.sleep(300);
  },
} satisfies McE2eScenario;

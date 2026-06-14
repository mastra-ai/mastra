import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { McE2eScenario } from './types.js';

export const mcpReloadConfigScenario = {
  name: 'mcp-reload-config',
  description: 'Reloads MCP servers from a changed project mcp.json through the real TUI command.',
  testName: 'reloads MCP config from disk and updates the visible manager status',
  projectFixture: 'long-branch',
  prepare({ mastracodeDir, projectDir }) {
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

    writeFileSync(
      join(projectDir, '.mc-e2e-mcp-reload-entrypoint.ts'),
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
  { name: 'mc-e2e-reload-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

mcpServer.tool(
  'reload_probe',
  'Return the deterministic MCP reload e2e probe payload.',
  { label: z.string().default('reload') },
  async ({ label }) => ({
    content: [{ type: 'text', text: 'MC_MCP_RELOAD_TOOL:' + label + ':ok' }],
  }),
);

httpServer.on('request', async (req, res) => {
  if (req.headers['x-mc-e2e'] !== 'reload-config') {
    res.writeHead(401, { 'content-type': 'text/plain' });
    res.end('missing x-mc-e2e reload header');
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
    if (!address || typeof address === 'string') throw new Error('MCP reload e2e server did not bind to a port');
    resolve('http://127.0.0.1:' + address.port + '/mcp');
  });
});
process.env.MC_E2E_MCP_RELOAD_URL = mcpUrl;

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
    return join(projectDir, '.mc-e2e-mcp-reload-entrypoint.ts');
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

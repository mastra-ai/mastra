import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@microsoft/tui-test';
import type { McE2eScenario } from './types.js';

export const headlessMcpToolAvailabilityScenario = {
  name: 'headless-mcp-tool-availability',
  description: 'Verifies headless mode waits for MCP tools before sending the first model request.',
  testName: 'makes MCP tools available to the first headless model turn',
  useOpenAIModel: true,
  aimockFixture: 'headless-mcp-tool-availability.json',
  prepare({ mastracodeDir, projectDir }) {
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, '.mc-e2e-headless-mcp-entrypoint.ts'),
      `import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const mastracodeDir = ${JSON.stringify(mastracodeDir)};
const projectDir = ${JSON.stringify(projectDir)};
const requireFromMcpPackage = createRequire(join(mastracodeDir, '../packages/mcp/package.json'));
const { McpServer } = await import(pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/sdk/server/mcp.js')).href);
const { StreamableHTTPServerTransport } = await import(
  pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/sdk/server/streamableHttp.js')).href
);
const { z } = await import(pathToFileURL(requireFromMcpPackage.resolve('zod/v3')).href);
const { headlessMain } = await import(pathToFileURL(join(mastracodeDir, 'src/headless.ts')).href);

const httpServer = createServer();
const activeServers = new Set();
let delayedInitialConnection = false;

function createHeadlessMcpServer() {
  const server = new McpServer(
    { name: 'mc-e2e-headless-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.tool(
    'delayed_lookup',
    'Return a deterministic payload from a headless MCP tool.',
    { query: z.string().describe('Lookup query') },
    async ({ query }) => ({
      content: [{ type: 'text', text: 'MC_HEADLESS_MCP_RESULT:' + query + ':ok' }],
    }),
  );

  activeServers.add(server);
  return server;
}

httpServer.on('request', async (req, res) => {
  if (req.headers['x-mc-e2e'] !== 'headless-mcp') {
    res.writeHead(401, { 'content-type': 'text/plain' });
    res.end('missing x-mc-e2e header');
    return;
  }
  if (!delayedInitialConnection) {
    delayedInitialConnection = true;
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  const mcpServer = createHeadlessMcpServer();
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
    if (!address || typeof address === 'string') throw new Error('Headless MCP e2e server did not bind to a port');
    resolve('http://127.0.0.1:' + address.port + '/mcp');
  });
});

const mcpConfigDir = join(process.env.HOME, '.mastracode');
mkdirSync(mcpConfigDir, { recursive: true });
writeFileSync(
  join(mcpConfigDir, 'mcp.json'),
  JSON.stringify({
    mcpServers: {
      e2e_headless_mcp: {
        url: mcpUrl,
        headers: { 'x-mc-e2e': 'headless-mcp' },
      },
    },
  }),
);

process.chdir(projectDir);
process.argv = [
  process.argv[0],
  'headless-mcp-e2e',
  '--prompt',
  'Use the delayed headless MCP lookup tool and report its payload.',
  '--output-format',
  'text',
  '--timeout',
  '30',
];

await headlessMain();
`,
    );
  },
  entrypoint({ projectDir }) {
    return join(projectDir, '.mc-e2e-headless-mcp-entrypoint.ts');
  },
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);

    await runtime.waitForScreenText(/Headless MCP lookup completed with payload MC_HEADLESS_MCP_RESULT:headless-e2e:ok/i, terminal, 35_000);
    runtime.printScreen('headless mcp tool availability', terminal);
  },
  verifyAimockRequests(requests) {
    const bodies = (requests as any[]).map(request => request.body);
    const serialized = JSON.stringify(bodies);
    expect(serialized).toContain('Use the delayed headless MCP lookup tool and report its payload.');
    expect(serialized).toContain('e2e_headless_mcp_delayed_lookup');
    expect(serialized).toContain('MC_HEADLESS_MCP_RESULT:headless-e2e:ok');
  },
} satisfies McE2eScenario;

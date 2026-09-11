import { spawn } from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, ProtocolError } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createConformanceServer } from './fixture';

const require = createRequire(import.meta.url);

async function startHttpServer() {
  const mcpServer = createConformanceServer();
  const httpServer = http.createServer(async (req, res) => {
    try {
      await mcpServer.startHTTP({
        url: new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`),
        httpPath: '/mcp',
        req,
        res,
      });
    } catch (error) {
      console.error('Conformance server request failed', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'text/plain' });
      }
      res.end('Internal server error');
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Conformance HTTP server did not bind to a TCP port');
  }

  return {
    url: new URL(`http://127.0.0.1:${address.port}/mcp`),
    close: async () => {
      await mcpServer.close();
      httpServer.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        httpServer.close(error => (error ? reject(error) : resolve()));
      });
    },
  };
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: path.resolve(fileURLToPath(new URL('../..', import.meta.url))),
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
      }
    });
  });
}

function stdioTransport() {
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  const fixturePath = fileURLToPath(new URL('./stdio-server.ts', import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, fixturePath],
    stderr: 'pipe',
  });
  transport.stderr?.on('data', chunk => process.stderr.write(chunk));
  return transport;
}

async function assertModernStdio() {
  const client = new Client(
    { name: 'mastra-conformance-2026-07-28', version: '1.0.0' },
    { versionNegotiation: { mode: { pin: '2026-07-28' } } },
  );
  await client.connect(stdioTransport());
  try {
    const result = await client.listTools();
    if (!result.tools.some(tool => tool.name === 'conformanceEcho')) {
      throw new Error('stdio 2026-07-28 tools/list omitted conformanceEcho');
    }
  } finally {
    await client.close();
  }
}

async function assertLegacyStdioRejected() {
  const client = new Client(
    { name: 'mastra-conformance-legacy', version: '1.0.0' },
    { versionNegotiation: { mode: 'legacy' } },
  );
  const transport = stdioTransport();
  try {
    await client.connect(transport);
    throw new Error('legacy stdio client connected; the server must reject pre-2026-07-28 openings');
  } catch (error) {
    if (!(error instanceof ProtocolError)) throw error;
  } finally {
    await transport.close().catch(() => {});
  }
}

const server = await startHttpServer();
try {
  await runCommand('pnpm', [
    'exec',
    'conformance',
    'server',
    '--url',
    server.url.href,
    '--scenario',
    'tools-list',
    '--spec-version',
    '2026-07-28',
  ]);
} finally {
  await server.close();
}
await assertModernStdio();
await assertLegacyStdioRejected();
console.log('MCP conformance smoke passed: official 2026-07-28 HTTP scenario, modern stdio, legacy stdio rejected');

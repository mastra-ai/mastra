import { spawn } from 'node:child_process';
import http from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { createConformanceServer } from './fixture';

const require = createRequire(import.meta.url);
const modeIndex = process.argv.indexOf('--mode');
const mode = modeIndex === -1 ? undefined : process.argv[modeIndex + 1];

if (mode !== 'modern' && mode !== 'legacy-interoperability') {
  throw new Error('Usage: pnpm test:conformance -- --mode modern|legacy-interoperability');
}

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

async function assertStdioInteroperability(protocolVersion: '2025-11-25' | '2026-07-28') {
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');
  const fixturePath = fileURLToPath(new URL('./stdio-server.ts', import.meta.url));
  const client = new Client(
    { name: `mastra-conformance-${protocolVersion}`, version: '1.0.0' },
    { versionNegotiation: { mode: protocolVersion === '2026-07-28' ? { pin: protocolVersion } : 'legacy' } },
  );
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, fixturePath],
    stderr: 'pipe',
  });
  transport.stderr?.on('data', chunk => process.stderr.write(chunk));

  await client.connect(transport);
  try {
    const result = await client.listTools();
    if (!result.tools.some(tool => tool.name === 'conformanceEcho')) {
      throw new Error(`stdio ${protocolVersion} tools/list omitted conformanceEcho`);
    }
  } finally {
    await client.close();
  }
}

if (mode === 'modern') {
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
  await assertStdioInteroperability('2026-07-28');
  console.log('MCP conformance smoke passed: official 2026 HTTP scenario and modern stdio');
} else {
  const server = await startHttpServer();
  const client = new Client(
    { name: 'mastra-conformance-legacy', version: '1.0.0' },
    { versionNegotiation: { mode: 'legacy' } },
  );
  try {
    await client.connect(new StreamableHTTPClientTransport(server.url));
    const result = await client.listTools();
    if (!result.tools.some(tool => tool.name === 'conformanceEcho')) {
      throw new Error('HTTP 2025 interoperability tools/list omitted conformanceEcho');
    }
  } finally {
    await client.close().catch(() => {});
    await server.close();
  }
  await assertStdioInteroperability('2025-11-25');
  console.log('MCP legacy interoperability smoke passed: explicit 2025 HTTP and stdio');
}

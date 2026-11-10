import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, fromJsonSchema, McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

const [transportKind, events, ready, modeFile] = process.argv.slice(2);
const record = event => appendFileSync(events, JSON.stringify({ event, pid: process.pid }) + '\n');
const mode = () => (modeFile ? readFileSync(modeFile, 'utf8').trim() : '');

const INPUT_SCHEMA = {
  type: 'object',
  properties: { city: { type: 'string' } },
  required: ['city'],
  additionalProperties: false,
};
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: { celsius: { type: 'number' } },
  required: ['celsius'],
  additionalProperties: false,
};

function server() {
  const instance = new McpServer({ name: 'typegen-fixture', version: '1.0.0' });

  // `fail` and `stall` model a server that never answers `tools/list`, which the
  // high-level API cannot express, so they install a raw handler on the underlying
  // server — the documented escape hatch for custom request handlers.
  if (mode() === 'fail' || mode() === 'stall') {
    instance.server.registerCapabilities({ tools: {} });
    instance.server.setRequestHandler('tools/list', async () => {
      record('list');
      if (mode() === 'fail') throw new Error('SENTINEL_SERVER_SECRET');
      return new Promise(() => {});
    });
    return instance;
  }

  instance.registerTool(
    'measure',
    {
      description: 'SENTINEL_DESCRIPTION_SECRET */',
      inputSchema: fromJsonSchema(INPUT_SCHEMA),
      outputSchema: fromJsonSchema(mode() === 'invalid' ? { type: 'SENTINEL_SCHEMA_SECRET' } : OUTPUT_SCHEMA),
    },
    async () => {
      record('call');
      return { content: [{ type: 'text', text: '21 degrees' }], structuredContent: { celsius: 21 } };
    },
  );

  return instance;
}

record('start');
process.on('exit', () => record('exit'));
process.on('SIGTERM', () => process.exit(0));
if (transportKind === 'stdio') {
  serveStdio(() => server());
  process.stdin.on('end', () => process.exit(0));
} else {
  const handler = toNodeHandler(createMcpHandler(() => server(), { legacy: 'reject' }));
  const http = createServer((req, res) => {
    if (mode() === 'auth') {
      res.writeHead(401);
      res.end('SENTINEL_AUTH_SECRET');
      return;
    }
    res.on('close', () => record('closed'));
    void handler(req, res);
  });
  http.listen(0, '127.0.0.1', () => writeFileSync(ready, `http://127.0.0.1:${http.address().port}/mcp`));
}

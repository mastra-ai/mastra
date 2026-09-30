import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { createMcpHandler, Server } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

const [transportKind, events, ready, modeFile] = process.argv.slice(2);
const record = event => appendFileSync(events, JSON.stringify({ event, pid: process.pid }) + '\n');
const mode = () => (modeFile ? readFileSync(modeFile, 'utf8').trim() : '');
function server() {
  const instance = new Server({ name: 'typegen-fixture', version: '1.0.0' }, { capabilities: { tools: {} } });
  instance.setRequestHandler('tools/list', async () => {
    record('list');
    if (mode() === 'fail') throw new Error('SENTINEL_SERVER_SECRET');
    if (mode() === 'stall') await new Promise(resolve => setTimeout(resolve, 60_000));
    return {
      tools: [
        {
          name: 'measure',
          description: 'SENTINEL_DESCRIPTION_SECRET */',
          inputSchema: {
            type: 'object',
            properties: { city: { type: 'string' } },
            required: ['city'],
            additionalProperties: false,
          },
          outputSchema:
            mode() === 'invalid'
              ? { type: 'SENTINEL_SCHEMA_SECRET' }
              : {
                  type: 'object',
                  properties: { celsius: { type: 'number' } },
                  required: ['celsius'],
                  additionalProperties: false,
                },
        },
      ],
    };
  });
  instance.setRequestHandler('tools/call', async () => {
    record('call');
    return { content: [{ type: 'text', text: '21 degrees' }], structuredContent: { celsius: 21 } };
  });
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

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { MCPClient } from '../client/configuration.js';

// A real host that replaced `process.off` with something that refuses to remove the SIGTERM
// listener (#30820). A connect that fails against this host must still settle with its own
// error, must not leave the failure as an unhandled rejection, and must not abandon the
// listeners the release could still remove.
//
// The `logger` mode adds a server logger that refuses the client's failed-release report: a host
// logger that throws must not keep a rejected connect attempt cached for the next connect().
const mode = process.argv[2] === 'logger' ? 'logger' : 'hooks';

process.on('unhandledRejection', reason => {
  console.log(`host: unhandled ${reason instanceof Error ? reason.message : String(reason)}`);
});

const originalOff = process.off.bind(process);
process.off = ((event: string | symbol, listener: (...args: unknown[]) => void) => {
  if (event === 'SIGTERM') throw new Error('process.off blocked by host');
  return originalOff(event, listener);
}) as typeof process.off;

// A host logger that throws on the failed-release report. `process hooks` matches the report in
// both its old and new wording, so the throw lands on the report whichever one the client sends.
const throwOnHookReleaseReport = (logMessage: { message: string }) => {
  if (logMessage.message.includes('process hooks')) throw new Error('logger blocked by host');
};

// Answers every request with a 404, like a mistyped endpoint. Counting requests lets the
// test tell a fresh connect from a replayed one: a cached rejected attempt sends none.
let requests = 0;
const server = createServer((_request, response) => {
  requests += 1;
  response.writeHead(404, { 'content-type': 'text/plain' });
  response.end('not found');
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address() as AddressInfo;

const mcp = new MCPClient({
  id: 'connect-cleanup-host',
  timeout: 5000,
  servers: {
    broken: {
      url: new URL(`http://127.0.0.1:${port}/mcp`),
      ...(mode === 'logger' ? { logger: throwOnHookReleaseReport } : {}),
    },
  },
});

// No per-server timeout: discovery must settle because the connect settles, not because
// a wrapper gave up on it. A wrapper timeout would hide the hang this host triggers.
const first = await mcp.listToolsWithErrors();
const requestsAfterFirst = requests;
console.log(`host: settled ${JSON.stringify(first.errors)}`);

// A failed connect must not leave its rejected attempt cached: a second call has to open a
// fresh connection, so it reaches the server again instead of replaying the first rejection.
const second = await mcp.listToolsWithErrors();
console.log(
  `host: retried ${JSON.stringify({
    errors: second.errors,
    requests: { first: requestsAfterFirst, second: requests },
  })}`,
);

// The host refuses only the SIGTERM removal, so SIGHUP is the listener that shows whether the
// release carried on past the refusal or abandoned what it could still have removed.
console.log(
  `host: listeners ${JSON.stringify({
    SIGTERM: process.listenerCount('SIGTERM'),
    SIGHUP: process.listenerCount('SIGHUP'),
  })}`,
);
process.exit(0);

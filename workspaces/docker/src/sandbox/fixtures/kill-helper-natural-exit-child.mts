import { once } from 'node:events';
import { createServer, connect } from 'node:net';
import { Duplex } from 'node:stream';

import { DockerProcessManager } from '../process-manager';

const mode = process.argv[2];
if (mode !== 'with-stdin' && mode !== 'without-stdin') {
  throw new Error(`Unknown stdin mode: ${mode}`);
}

const server = createServer({ allowHalfOpen: false }, socket => socket.resume());
await once(server.listen(0, '127.0.0.1'), 'listening');
server.unref();
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Unable to determine loopback port');

const processStream = new Duplex({
  read() {},
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const processExec = {
  id: 'process-exec',
  start: async () => processStream,
  inspect: async () => ({ Running: false, ExitCode: 0 }),
};
const killExec = {
  id: 'kill-exec',
  start: async () => {
    const response = connect({ host: '127.0.0.1', port: address.port });
    await once(response, 'connect');
    return response;
  },
  inspect: async () => ({ Running: false, ExitCode: 0 }),
};
let execCount = 0;
const container = {
  exec: async () => (execCount++ === 0 ? processExec : killExec),
};

const manager = new DockerProcessManager();
manager.sandbox = { ensureRunning: async () => {}, getEnv: () => ({}) } as never;
manager.setContainer(container as never);
const handle = await manager.spawn('sleep 60');

if (mode === 'with-stdin') {
  await handle.sendStdin('probe');
  await handle.closeStdin();
}

if (!(await handle.kill())) throw new Error('Expected helper kill to succeed');
const result = await handle.wait();
if (result.exitCode !== 137 || !result.killed) throw new Error(`Unexpected kill result: ${JSON.stringify(result)}`);

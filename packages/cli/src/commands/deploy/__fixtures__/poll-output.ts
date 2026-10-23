import { once } from 'node:events';
import { createServer } from 'node:http';
import * as p from '@clack/prompts';

import { pollEnvironmentDeploy } from '../index.js';

let polls = 0;
let logLines = 0;
const server = createServer((req, res) => {
  if (req.url?.endsWith('/logs/stream')) {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.flushHeaders();
    const timer = setInterval(() => res.write(`data: build-output-${++logLines}\n\n`), 50);
    res.on('close', () => clearInterval(timer));
    return;
  }
  polls += 1;
  if (polls === 3) {
    res.writeHead(504, 'Gateway Timeout');
    res.end('<html>Gateway Timeout</html>');
    return;
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ deploy: { id: 'dep-1', status: polls >= 5 ? 'running' : 'building' } }));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Missing HTTP port');
process.env.MASTRA_PLATFORM_API_URL = `http://127.0.0.1:${address.port}`;
try {
  const deploy = await pollEnvironmentDeploy('test-token', 'org-1', 'proj-1', 'env-1', 'dep-1', 15_000);
  if (deploy.status !== 'running' || polls !== 5 || logLines < 40) throw new Error('Incomplete polling scenario');
  p.log.success('Deployment is running.');
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
}

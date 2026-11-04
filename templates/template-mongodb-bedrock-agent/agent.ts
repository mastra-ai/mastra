/**
 * AgentCore Runtime entrypoint.
 *
 * A BYO container must implement the AgentCore HTTP service contract:
 *   - POST /invocations  -> run the agent, return JSON
 *   - GET  /ping         -> health check (200 {"status":"Healthy"})
 *   - listen on 0.0.0.0:8080
 *
 * We serve it with Node's built-in http server (no extra deps). AgentCore's
 * per-invocation session id (passed as a header) maps to a Mastra memory
 * thread, so conversation history persists in MongoDB per session.
 */
import { createServer, type IncomingMessage } from 'node:http';
import { mastra } from './src/mastra/index.js';

// Log asynchronous backend rejections; invocation failures return HTTP 500 below.
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));

const PORT = Number(process.env.PORT ?? 8080);
const SESSION_HEADER = 'x-amzn-bedrock-agentcore-runtime-session-id';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'Healthy' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/invocations') {
    try {
      const raw = await readBody(req);
      const payload = raw ? (JSON.parse(raw) as { prompt?: string; message?: string; sessionId?: string }) : {};
      const prompt = payload.prompt ?? payload.message ?? '';
      const sessionId = (req.headers[SESSION_HEADER] as string) || payload.sessionId || 'default';

      const agent = mastra.getAgentById('docs-agent');
      const response = await agent.generate(prompt, { memory: { resource: sessionId, thread: sessionId } });

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ response: response.text, status: 'success' }));
    } catch (err) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message, status: 'error' }));
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mastra Docs Agent (AgentCore runtime) listening on 0.0.0.0:${PORT}`);
});

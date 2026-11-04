/**
 * AgentCore Runtime entrypoint.
 *
 * A BYO container must implement the AgentCore HTTP service contract:
 *   - POST /invocations  -> run the agent, return JSON
 *   - GET  /ping         -> health check (200 {"status":"Healthy"})
 *   - listen on 0.0.0.0:8080
 *
 * We serve it with Node's built-in http server (no extra deps). AgentCore's
 * user and session headers map to a Mastra memory thread. IAM must restrict
 * invocation to a trusted backend that authenticates users and owns sessions.
 */
import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';
import { z } from 'zod';
import { mastra } from './src/mastra/index.js';

// Log asynchronous backend rejections; invocation failures return HTTP 500 below.
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));

const PORT = Number(process.env.PORT ?? 8080);
const SESSION_HEADER = 'x-amzn-bedrock-agentcore-runtime-session-id';
const USER_HEADER = 'x-amzn-bedrock-agentcore-runtime-user-id';
const invocationSchema = z
  .object({ prompt: z.string().min(1).optional(), message: z.string().min(1).optional() })
  .strict()
  .refine(value => value.prompt || value.message);

class InvocationError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'Healthy' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/invocations') {
    try {
      const session = z.string().min(33).max(256).safeParse(req.headers[SESSION_HEADER]);
      if (!session.success) throw new InvocationError(400, 'A valid AgentCore session header is required');
      const user = z.string().trim().min(1).max(256).safeParse(req.headers[USER_HEADER]);
      if (!user.success) throw new InvocationError(403, 'Trusted AgentCore user context is required');

      const raw = await readBody(req);
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new InvocationError(400, 'Invalid JSON');
      }
      const parsed = invocationSchema.safeParse(payload);
      if (!parsed.success) throw new InvocationError(400, 'Expected only a prompt or message');
      const prompt = parsed.data.prompt ?? parsed.data.message!;

      // The trusted IAM caller derives user-id from authenticated identity. Neither
      // AgentCore nor this header authenticates an arbitrary end-user-supplied ID.
      const resource = `agentcore:${createHash('sha256')
        .update(JSON.stringify([user.data]))
        .digest('hex')}`;
      const thread = `agentcore:${createHash('sha256')
        .update(JSON.stringify([user.data, session.data]))
        .digest('hex')}`;

      const agent = mastra.getAgentById('docs-agent');
      const response = await agent.generate(prompt, { memory: { resource, thread } });

      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ response: response.text, status: 'success' }));
    } catch (err) {
      res.writeHead(err instanceof InvocationError ? err.statusCode : 500, { 'content-type': 'application/json' });
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

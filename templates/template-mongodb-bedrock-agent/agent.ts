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
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { z } from 'zod';
import { mastra } from './src/mastra/index.js';

// Log asynchronous backend rejections; invocation failures return HTTP 500 below.
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));

const PORT = Number(process.env.PORT ?? 8080);
const SESSION_HEADER = 'x-amzn-bedrock-agentcore-runtime-session-id';
const USER_HEADER = 'x-amzn-bedrock-agentcore-runtime-user-id';
const MAX_BODY_BYTES = 64 * 1024;
const UPLOAD_TIMEOUT_MS = 30_000;
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

/** Read a UTF-8 body within the byte limit and upload deadline, rejecting oversized or incomplete requests. */
function readBody(req: IncomingMessage): Promise<string> {
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
    return Promise.reject(new InvocationError(413, 'Request body exceeds 64 KiB'));
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const timer = setTimeout(() => finish(new InvocationError(408, 'Upload timed out')), UPLOAD_TIMEOUT_MS);
    /** Settle the body read and release its deadline and data listeners on success or failure. */
    function finish(error?: Error) {
      clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('aborted', onAborted);
      if (error) {
        req.pause();
        reject(error);
      } else {
        resolve(Buffer.concat(chunks, bytes).toString('utf8'));
      }
    }
    /** Count raw bytes before buffering so chunked uploads cannot bypass the size limit. */
    function onData(chunk: Buffer) {
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) finish(new InvocationError(413, 'Request body exceeds 64 KiB'));
      else chunks.push(chunk);
    }
    function onEnd() {
      finish();
    }
    function onAborted() {
      finish(new InvocationError(400, 'Upload aborted'));
    }
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('aborted', onAborted);
    req.once('error', finish);
  });
}

/** Validate trusted invocation context before reading uploads or accessing shared conversation memory. */
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
      // Deliver the error before closing an unfinished or oversized upload.
      res.setHeader('connection', 'close');
      res.once('finish', () => req.destroy());
      res.writeHead(err instanceof InvocationError ? err.statusCode : 500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message, status: 'error' }));
    }
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.headersTimeout = 10_000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mastra Docs Agent (AgentCore runtime) listening on 0.0.0.0:${PORT}`);
});

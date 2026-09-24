import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { RenderSubmissionUnknownError } from '@renderinc/mastra';
import { provider } from './provider.js';
import { editorialReview, inputSchema, reviewMode } from './workflow.js';
import './mastra.js';

export function createExampleServer(tokens: Record<string, string>) {
  const principals = Object.entries(tokens);
  if (!principals.length || principals.some(([user, token]) => !user || token.length < 16))
    throw new Error('Provide named demo API tokens of at least 16 characters');
  const authenticate = (request: IncomingMessage): string | undefined => {
    const token = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const bytes = Buffer.from(token);
    return principals.find(
      ([, expected]) => bytes.length === Buffer.byteLength(expected) && timingSafeEqual(bytes, Buffer.from(expected)),
    )?.[0];
  };
  return createServer(async (request, response) => {
    const send = (status: number, value: unknown) => {
      response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(value));
    };
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/healthz') {
        send(200, { status: 'ok' });
        return;
      }
      if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/app.js')) {
        const file = url.pathname === '/' ? 'index.html' : 'app.js';
        const body = await readFile(new URL(`./public/${file}`, import.meta.url));
        response.writeHead(200, {
          'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript',
          'content-security-policy':
            "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
          'x-content-type-options': 'nosniff',
          'cache-control': 'no-store',
        });
        response.end(body);
        return;
      }
      const owner = authenticate(request);
      if (!owner) {
        send(401, { error: 'A valid demo API token is required.' });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/api/config') {
        send(200, { mode: reviewMode, owner });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/api/jobs') {
        let body = '';
        for await (const chunk of request) {
          body += String(chunk);
          if (Buffer.byteLength(body) > 200000) {
            send(413, { error: 'Draft request is too large.' });
            return;
          }
        }
        let raw: unknown;
        try {
          raw = JSON.parse(body);
        } catch {
          send(400, { error: 'Invalid JSON.' });
          return;
        }
        const parsed = inputSchema.safeParse(raw);
        if (!parsed.success) {
          send(400, { error: parsed.error.message });
          return;
        }
        const identity = z.object({ runId: z.string().uuid().optional() }).safeParse(raw);
        if (!identity.success) {
          send(400, { error: 'Invalid run ID.' });
          return;
        }
        const runId = identity.data.runId;
        if (runId) {
          const existing = await provider.store.get(editorialReview.id, runId);
          if (existing) {
            if (existing.resourceId !== owner) {
              send(404, { error: 'Job not found.' });
              return;
            }
            if (JSON.stringify(existing.input) !== JSON.stringify(parsed.data)) {
              send(409, { error: 'This run ID belongs to another input.' });
              return;
            }
            if (!existing.providerId) {
              send(503, {
                runId,
                status: 'submission-unknown',
                error: 'Inspect the existing submission before trying again.',
              });
              return;
            }
            send(202, { runId });
            return;
          }
        }
        const run = await editorialReview.createRun({ runId, resourceId: owner });
        // Core startAsync waits for provider acceptance and binding persistence, not final job completion.
        const result = await run.startAsync({ inputData: parsed.data });
        send(202, result);
        return;
      }
      const match = /^\/api\/jobs\/([a-zA-Z0-9-]+)(\/cancel)?$/.exec(url.pathname);
      if (match) {
        const runId = match[1]!;
        // Check ownership before provider calls or exposing state. No browser-supplied owner field is used.
        const stored = await provider.store.get(editorialReview.id, runId);
        if (!stored || stored.resourceId !== owner) {
          send(404, { error: 'Job not found.' });
          return;
        }
        if (request.method === 'POST' && match[2]) {
          await provider.cancel(editorialReview.id, runId);
          send(202, { runId, status: (await provider.getRun(editorialReview.id, runId))?.status });
          return;
        }
        if (request.method === 'GET' && !match[2]) {
          const record = await provider.getRun(editorialReview.id, runId);
          send(200, {
            runId,
            status: record!.status,
            result: record!.status === 'success' ? record!.result : undefined,
            error: record!.error?.message,
          });
          return;
        }
      }
      send(404, { error: 'Not found.' });
    } catch (error) {
      if (error instanceof RenderSubmissionUnknownError) {
        send(503, { error: error.message, runId: error.runId, status: 'submission-unknown' });
        return;
      }
      if (error instanceof z.ZodError) {
        send(400, { error: error.message });
        return;
      }
      send(503, { error: 'Job service unavailable. Your existing job has not been resubmitted.' });
    }
  });
}

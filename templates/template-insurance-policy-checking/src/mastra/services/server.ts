import type { ServerConfig } from '@mastra/core/server';
import { safeFailure } from './errors.js';
import type { InputLimits } from '../../../config/limits.js';

const modelUnavailable =
  'The conversation model is unavailable. Read /status to check captured documents before retrying.';
function scrubErrors(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubErrors);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (typeof record.type === 'string' && (record.type === 'error' || record.type.endsWith('-error'))) {
    return {
      type: record.type,
      runId: record.runId,
      from: record.from,
      errorText: modelUnavailable,
      error: { code: 'MODEL_UNAVAILABLE', message: modelUnavailable },
      payload: { message: modelUnavailable, error: { code: 'MODEL_UNAVAILABLE', message: modelUnavailable } },
    };
  }
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, scrubErrors(item)]));
}

export function createLocalServer(port: number, limits: InputLimits): ServerConfig {
  const origin = `http://127.0.0.1:${port}`;
  return {
    host: '127.0.0.1',
    port,
    bodySizeLimit: limits.maxDocumentsPerCase * (Math.ceil(limits.pdf.maxBytesPerFile / 3) * 4 + 1024) + 1024 * 1024,
    cors: { origin, allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] },
    middleware: [
      {
        path: '/*',
        handler: async (context, next) => {
          if (
            context.req.header('host') !== `127.0.0.1:${port}` ||
            (context.req.header('origin') && context.req.header('origin') !== origin)
          ) {
            return context.json(
              {
                ok: false,
                code: 'LOCAL_ACCESS_ONLY',
                message: 'This request is not from the configured local Studio address.',
                nextAction: `Open ${origin} and submit from that page.`,
              },
              403,
            );
          }
          await next();
          // Stream errors from provider/runtime boundaries must not expose provider bodies or stacks.
          const contentType = context.res.headers.get('content-type') ?? '';
          if (contentType.includes('text/event-stream') && context.res.body) {
            let pending = '';
            const transformer = new TransformStream<string, string>({
              transform(chunk, controller) {
                pending += chunk;
                let boundary;
                while ((boundary = pending.indexOf('\n\n')) >= 0) {
                  const event = pending.slice(0, boundary);
                  pending = pending.slice(boundary + 2);
                  const data = event.startsWith('data: ') ? event.slice(6) : '';
                  try {
                    const parsed = JSON.parse(data) as Record<string, unknown>;
                    controller.enqueue(`data: ${JSON.stringify(scrubErrors(parsed))}\n\n`);
                  } catch {
                    controller.enqueue(`${event}\n\n`);
                  }
                }
              },
              flush(controller) {
                if (pending) controller.enqueue(pending);
              },
            });
            context.res = new Response(
              context.res.body
                .pipeThrough(new TextDecoderStream())
                .pipeThrough(transformer)
                .pipeThrough(new TextEncoderStream()),
              { status: context.res.status, headers: context.res.headers },
            );
          } else if (context.res.status >= 500) {
            context.res = Response.json(safeFailure(undefined), { status: 503 });
          } else if (context.res.status >= 400) {
            context.res = Response.json(
              {
                ok: false,
                code: 'REQUEST_REJECTED',
                message: 'The request could not be accepted.',
                nextAction: 'Use the supported Studio input and current conversation identifiers.',
              },
              { status: context.res.status },
            );
          } else if (contentType.includes('application/json')) {
            context.res = Response.json(scrubErrors(await context.res.json()), {
              status: context.res.status,
              headers: context.res.headers,
            });
          }
        },
      },
    ],
    onError: (_error, context) => context.json(safeFailure(undefined), 503),
    onValidationError: () => ({
      status: 400,
      body: {
        ok: false,
        code: 'INVALID_INPUT',
        message: 'The request does not match the supported input format.',
        nextAction: 'Use Studio with direct textual PDF attachments and valid case/source identifiers.',
      },
    }),
  };
}
